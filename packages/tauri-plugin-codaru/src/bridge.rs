use crate::agent_transport::{AgentError, Result, RESPONSE_TIMEOUT};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, VecDeque};
use std::sync::{atomic::{AtomicU64, Ordering}, mpsc, Arc, Mutex};
use std::time::Instant;

const MAX_PENDING: usize = 8;
const COMMANDS: &[&str] = &["schema", "context", "apply", "catalog", "select", "undo", "redo", "export", "lint", "find", "versions", "locale", "comments"];

#[derive(Clone, Serialize, Debug)]
pub struct AgentRequest { pub id: String, pub command: String, pub params: Value }

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct WireRequest {
    command: String,
    #[serde(default = "empty_params")]
    params: Value,
}
fn empty_params() -> Value { json!({}) }
struct Pending { request: AgentRequest, since: Instant }
#[derive(Default)]
struct Queue {
    pending: VecDeque<Pending>,
    active: Option<String>,
    replies: HashMap<String, mpsc::SyncSender<Value>>,
}
#[derive(Default)]
struct Shared { queue: Mutex<Queue>, counter: AtomicU64 }
impl Shared {
    fn enqueue(&self, request: WireRequest) -> Result<(String, mpsc::Receiver<Value>)> {
        if !COMMANDS.contains(&request.command.as_str()) { return Err(AgentError::new("UNKNOWN_COMMAND", "Use schema, context, apply, catalog, select, undo, redo, export, lint, find, versions, locale, or comments.")); }
        if !request.params.is_object() { return Err(AgentError::new("INVALID_REQUEST", "Command params must be a JSON object.")); }
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        if queue.replies.len() >= MAX_PENDING { return Err(AgentError::new("BRIDGE_BUSY", "The local command queue is full. Wait for the current commands and retry.")); }
        let id = format!("{}-{}", std::process::id(), self.counter.fetch_add(1, Ordering::Relaxed));
        let (sender, receiver) = mpsc::sync_channel(1);
        queue.replies.insert(id.clone(), sender);
        queue.pending.push_back(Pending { request: AgentRequest { id: id.clone(), command: request.command, params: request.params }, since: Instant::now() });
        Ok((id, receiver))
    }
    fn poll(&self) -> Option<AgentRequest> {
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        if queue.active.is_some() { return None; }
        while let Some(pending) = queue.pending.pop_front() {
            if pending.since.elapsed() >= RESPONSE_TIMEOUT {
                if let Some(sender) = queue.replies.remove(&pending.request.id) { let _ = sender.send(timeout_error().json()); }
                continue;
            }
            queue.active = Some(pending.request.id.clone());
            return Some(pending.request);
        }
        None
    }
    fn respond(&self, id: &str, response: Value) -> std::result::Result<(), String> {
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        if queue.active.as_deref() != Some(id) { return Err("The request is no longer active; its connection may have timed out.".into()); }
        queue.active = None;
        let sender = queue.replies.remove(id).ok_or("The request has already completed.")?;
        sender.send(response).map_err(|_| "The CLI disconnected before the response was ready.".into())
    }
    fn cancel(&self, id: &str) {
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        queue.replies.remove(id); queue.pending.retain(|p| p.request.id != id);
        if queue.active.as_deref() == Some(id) { queue.active = None; }
    }
    fn close(&self) {
        let mut queue = self.queue.lock().unwrap_or_else(|e| e.into_inner());
        queue.pending.clear(); queue.active = None;
        for (_, sender) in queue.replies.drain() { let _ = sender.send(AgentError::new("APP_CLOSED", "Codaru Mockup is closing. Reopen it before sending another command.").json()); }
    }
}
fn timeout_error() -> AgentError {
    AgentError::new("TIMEOUT", "The editor did not respond within 20 seconds. Run context before retrying a change: the previous command may have applied.")
}

pub struct AgentBridge {
    shared: Arc<Shared>,
    #[cfg(unix)]
    _server: unix::Server,
}
impl AgentBridge {
    #[cfg(unix)]
    pub fn start() -> Result<Self> { Self::at(crate::agent_transport::socket_path()?) }
    #[cfg(unix)]
    pub(crate) fn at(path: std::path::PathBuf) -> Result<Self> {
        let shared = Arc::new(Shared::default());
        let server = unix::Server::start(path, shared.clone())?;
        Ok(Self { shared, _server: server })
    }
    #[cfg(not(unix))]
    pub fn start() -> Result<Self> { Ok(Self { shared: Arc::new(Shared::default()) }) }
    pub fn poll(&self) -> Option<AgentRequest> { self.shared.poll() }
    pub fn respond(&self, id: &str, response: Value) -> std::result::Result<(), String> { self.shared.respond(id, response) }
}
impl Drop for AgentBridge { fn drop(&mut self) { self.shared.close(); } }

#[cfg(unix)]
mod unix {
    use super::*;
    use crate::agent_transport::{read_frame, write_frame, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES, REQUEST_TIMEOUT};
    use std::fs::{self, File, OpenOptions};
    use std::io;
    use std::os::fd::AsRawFd;
    use std::os::unix::{ffi::OsStrExt, fs::{DirBuilderExt, FileTypeExt, MetadataExt, OpenOptionsExt, PermissionsExt}, net::{UnixListener, UnixStream}};
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicBool, AtomicUsize};
    use std::thread::{self, JoinHandle};
    use std::time::Duration;

    // These Unix ABI calls only query effective uid and hold an advisory file lock.
    extern "C" { fn geteuid() -> u32; fn flock(fd: i32, operation: i32) -> i32; }
    #[cfg(any(target_os = "linux", target_os = "android"))]
    const O_NOFOLLOW: i32 = 0x20000;
    #[cfg(not(any(target_os = "linux", target_os = "android")))]
    const O_NOFOLLOW: i32 = 0x100;
    fn uid() -> u32 { unsafe { geteuid() } }
    fn socket_error(e: io::Error) -> AgentError { AgentError::new("SOCKET_UNAVAILABLE", e.to_string()) }

    pub(super) struct Server {
        path: PathBuf, inode: u64, device: u64, stopped: Arc<AtomicBool>, thread: Option<JoinHandle<()>>, _lock: File,
    }
    impl Server {
        pub(super) fn start(path: PathBuf, shared: Arc<Shared>) -> Result<Self> {
            if !path.is_absolute() || path.as_os_str().as_bytes().len() >= 104 { return Err(AgentError::new("INVALID_SOCKET_PATH", "Use an absolute Unix socket path shorter than 104 bytes.")); }
            let parent = path.parent().ok_or_else(|| AgentError::new("INVALID_SOCKET_PATH", "The socket needs a private parent directory."))?;
            private_directory(parent)?;
            let lock = lock_directory(&parent.join("agent.lock"))?;
            remove_stale_socket(&path)?;
            let listener = UnixListener::bind(&path).map_err(socket_error)?;
            // The enclosing 0700 directory protects the socket while its mode is set.
            if let Err(error) = fs::set_permissions(&path, fs::Permissions::from_mode(0o600)) { let _ = fs::remove_file(&path); return Err(socket_error(error)); }
            listener.set_nonblocking(true).map_err(socket_error)?;
            let metadata = fs::symlink_metadata(&path).map_err(socket_error)?;
            let inode = metadata.ino(); let device = metadata.dev();
            let stopped = Arc::new(AtomicBool::new(false)); let stop = stopped.clone();
            let connections = Arc::new(AtomicUsize::new(0));
            let thread = thread::Builder::new().name("codaru-agent-listener".into()).spawn(move || {
                while !stop.load(Ordering::Relaxed) {
                    match listener.accept() {
                        Ok((mut stream, _)) => {
                            if connections.fetch_add(1, Ordering::SeqCst) >= MAX_PENDING {
                                connections.fetch_sub(1, Ordering::SeqCst);
                                let _ = write_frame(&mut stream, &AgentError::new("BRIDGE_BUSY", "Too many local connections. Wait and retry.").json(), MAX_RESPONSE_BYTES);
                                continue;
                            }
                            let shared = shared.clone(); let connections = connections.clone();
                            thread::spawn(move || { serve(&mut stream, shared); connections.fetch_sub(1, Ordering::SeqCst); });
                        }
                        Err(e) if e.kind() == io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                        Err(e) if e.kind() == io::ErrorKind::Interrupted => continue,
                        Err(_) => break,
                    }
                }
            }).map_err(socket_error)?;
            Ok(Self { path, inode, device, stopped, thread: Some(thread), _lock: lock })
        }
    }
    impl Drop for Server {
        fn drop(&mut self) {
            self.stopped.store(true, Ordering::Relaxed);
            if let Some(thread) = self.thread.take() { let _ = thread.join(); }
            // Do not unlink a replacement path created after this listener started.
            if let Ok(meta) = fs::symlink_metadata(&self.path) {
                if meta.file_type().is_socket() && meta.ino() == self.inode && meta.dev() == self.device { let _ = fs::remove_file(&self.path); }
            }
        }
    }
    fn private_directory(path: &Path) -> Result<()> {
        if !path.try_exists().map_err(socket_error)? { fs::DirBuilder::new().recursive(true).mode(0o700).create(path).map_err(socket_error)?; }
        let meta = fs::symlink_metadata(path).map_err(socket_error)?;
        if !meta.is_dir() || meta.file_type().is_symlink() || meta.uid() != uid() || meta.mode() & 0o777 != 0o700 {
            return Err(AgentError::new("UNSAFE_DIRECTORY", format!("{} must be a directory owned by this user with permissions 0700, not a symlink. Choose a private CODARU_AGENT_SOCKET directory.", path.display())));
        }
        Ok(())
    }
    fn lock_directory(path: &Path) -> Result<File> {
        if let Ok(meta) = fs::symlink_metadata(path) {
            if !meta.is_file() || meta.file_type().is_symlink() || meta.uid() != uid() { return Err(AgentError::new("UNSAFE_LOCK", "The agent lock path is not a regular file owned by this user.")); }
        }
        let file = OpenOptions::new().read(true).write(true).create(true).mode(0o600).custom_flags(O_NOFOLLOW).open(path).map_err(socket_error)?;
        let meta = file.metadata().map_err(socket_error)?;
        if !meta.is_file() || meta.uid() != uid() || meta.mode() & 0o777 != 0o600 { return Err(AgentError::new("UNSAFE_LOCK", "The agent lock must be a regular file owned by this user with permissions 0600.")); }
        // LOCK_EX | LOCK_NB: held until this File is dropped, including after crashes.
        if unsafe { flock(file.as_raw_fd(), 2 | 4) } != 0 { return Err(AgentError::new("APP_ALREADY_RUNNING", "Another Codaru Mockup instance owns this agent socket directory. Use that app or choose another CODARU_AGENT_SOCKET directory.")); }
        Ok(file)
    }
    fn remove_stale_socket(path: &Path) -> Result<()> {
        let meta = match fs::symlink_metadata(path) { Ok(meta) => meta, Err(e) if e.kind() == io::ErrorKind::NotFound => return Ok(()), Err(e) => return Err(socket_error(e)) };
        if !meta.file_type().is_socket() || meta.uid() != uid() { return Err(AgentError::new("UNSAFE_SOCKET", "The agent socket path exists but is not a Unix socket owned by this user. It will not be removed.")); }
        match crate::agent_transport::connect(path, Duration::from_millis(500)) {
            Ok(_) => return Err(AgentError::new("APP_ALREADY_RUNNING", "Another process is already listening on this socket. It will not be replaced.")),
            Err(e) if e.kind() == io::ErrorKind::ConnectionRefused => {},
            Err(e) => return Err(AgentError::new("SOCKET_UNAVAILABLE", format!("Cannot verify the existing socket is stale: {}", e))),
        }
        let current = fs::symlink_metadata(path).map_err(socket_error)?;
        if !current.file_type().is_socket() || current.ino() != meta.ino() || current.dev() != meta.dev() { return Err(AgentError::new("UNSAFE_SOCKET", "The socket changed while checking it; nothing was removed.")); }
        fs::remove_file(path).map_err(socket_error)
    }
    fn serve(stream: &mut UnixStream, shared: Arc<Shared>) {
        let result = (|| {
            let bytes = read_frame(stream, MAX_REQUEST_BYTES, REQUEST_TIMEOUT)?;
            let wire: WireRequest = serde_json::from_slice(&bytes).map_err(|e| AgentError::new("INVALID_JSON", format!("Expected one JSON command object: {}", e)))?;
            let (id, receiver) = shared.enqueue(wire)?;
            let result = receiver.recv_timeout(RESPONSE_TIMEOUT).map_err(|_| timeout_error());
            shared.cancel(&id);
            result
        })();
        let value = result.unwrap_or_else(|e| e.json());
        if let Err(error) = write_frame(stream, &value, MAX_RESPONSE_BYTES) {
            if error.code == "MESSAGE_TOO_LARGE" { let _ = write_frame(stream, &error.json(), MAX_RESPONSE_BYTES); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn comments_reach_the_editor_without_bypassing_queue_validation() {
        let shared = Shared::default();
        assert_eq!(shared.enqueue(WireRequest { command: "comments".into(), params: json!("invalid") }).unwrap_err().code, "INVALID_REQUEST");
        let (id, reply) = shared.enqueue(WireRequest { command: "comments".into(), params: json!({"id":"thread-1"}) }).unwrap();
        let request = shared.poll().unwrap();
        assert_eq!(request.command, "comments"); assert_eq!(request.params["id"], "thread-1");
        shared.respond(&id, json!({"ok":true})).unwrap(); assert_eq!(reply.recv().unwrap()["ok"], true);
    }
    #[test]
    fn locale_reaches_the_editor_with_its_requested_language() {
        let shared = Shared::default();
        let (id, reply) = shared.enqueue(WireRequest { command: "locale".into(), params: json!({"locale":"en"}) }).unwrap();
        let request = shared.poll().unwrap();
        assert_eq!(request.command, "locale"); assert_eq!(request.params["locale"], "en");
        shared.respond(&id, json!({"ok":true})).unwrap(); assert_eq!(reply.recv().unwrap()["ok"], true);
    }
    #[test]
    fn queue_serializes_commands_and_releases_after_response() {
        let shared = Shared::default();
        let (one, first) = shared.enqueue(WireRequest { command: "context".into(), params: json!({}) }).unwrap();
        let (two, second) = shared.enqueue(WireRequest { command: "undo".into(), params: json!({}) }).unwrap();
        assert_eq!(shared.poll().unwrap().id, one); assert!(shared.poll().is_none());
        assert!(shared.respond(&two, json!({"ok":true})).is_err());
        shared.respond(&one, json!({"ok":true,"revision":"r1"})).unwrap(); assert_eq!(first.recv().unwrap()["revision"], "r1");
        assert_eq!(shared.poll().unwrap().id, two); shared.cancel(&two); assert!(second.recv().is_err()); assert!(shared.poll().is_none());
    }
    #[test]
    fn queue_is_bounded_and_rejects_unknown_commands() {
        let shared = Shared::default();
        assert!(shared.enqueue(WireRequest { command: "shell".into(), params: json!({}) }).is_err());
        let mut receivers = Vec::new();
        for _ in 0..MAX_PENDING { receivers.push(shared.enqueue(WireRequest { command: "context".into(), params: json!({}) }).unwrap()); }
        assert_eq!(shared.enqueue(WireRequest { command: "context".into(), params: json!({}) }).unwrap_err().code, "BRIDGE_BUSY");
        shared.close(); assert!(receivers.iter().all(|(_, receiver)| receiver.recv().unwrap()["ok"] == false));
    }
    #[cfg(unix)]
    mod socket {
        use super::*;
        use std::os::unix::{fs::{MetadataExt, PermissionsExt, symlink}, net::UnixListener};
        use std::{fs, path::PathBuf, thread, time::Duration};
        struct Temporary(PathBuf);
        impl Temporary {
            fn new() -> Self {
                static COUNT: AtomicU64 = AtomicU64::new(0);
                let path = std::env::temp_dir().join(format!("codaru-{}-{}", std::process::id(), COUNT.fetch_add(1, Ordering::SeqCst)));
                fs::create_dir(&path).unwrap(); fs::set_permissions(&path, fs::Permissions::from_mode(0o700)).unwrap(); Self(path)
            }
            fn socket(&self) -> PathBuf { self.0.join("agent.sock") }
        }
        impl Drop for Temporary { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }
        #[test]
        fn real_socket_roundtrip_and_private_permissions() {
            let dir = Temporary::new(); let bridge = AgentBridge::at(dir.socket()).unwrap();
            assert_eq!(fs::metadata(dir.socket()).unwrap().mode() & 0o777, 0o600);
            let path = dir.socket(); let client = thread::spawn(move || crate::agent_transport::request(&path, &json!({"command":"context","params":{"scope":"selection"}})).unwrap());
            let started = Instant::now();
            let request = loop { if let Some(request) = bridge.poll() { break request; } assert!(started.elapsed() < Duration::from_secs(2), "command did not reach queue"); thread::sleep(Duration::from_millis(5)); };
            assert_eq!(request.params["scope"], "selection"); bridge.respond(&request.id, json!({"ok":true,"revision":"42"})).unwrap();
            assert_eq!(client.join().unwrap()["revision"], "42"); drop(bridge); assert!(!dir.socket().exists());
            assert_eq!(crate::agent_transport::request(&dir.socket(), &json!({})).unwrap_err().code, "APP_NOT_RUNNING");
        }
        #[test]
        fn refuses_duplicate_process_and_recovers_only_stale_socket() {
            let dir = Temporary::new(); let one = AgentBridge::at(dir.socket()).unwrap();
            assert!(matches!(AgentBridge::at(dir.socket()), Err(e) if e.code == "APP_ALREADY_RUNNING")); drop(one);
            let stale = UnixListener::bind(dir.socket()).unwrap(); drop(stale);
            let recovered = AgentBridge::at(dir.socket()).unwrap(); drop(recovered);
            fs::write(dir.socket(), "keep me").unwrap(); assert!(AgentBridge::at(dir.socket()).is_err()); assert_eq!(fs::read_to_string(dir.socket()).unwrap(), "keep me");
            fs::remove_file(dir.socket()).unwrap(); let target = dir.0.join("target"); fs::write(&target, "preserve").unwrap(); symlink(&target, dir.socket()).unwrap();
            assert!(AgentBridge::at(dir.socket()).is_err()); assert_eq!(fs::read_to_string(&target).unwrap(), "preserve"); assert!(fs::symlink_metadata(dir.socket()).unwrap().file_type().is_symlink());
        }
        #[test]
        fn rejects_unsafe_directory_and_malformed_requests() {
            let dir = Temporary::new(); fs::set_permissions(&dir.0, fs::Permissions::from_mode(0o755)).unwrap();
            assert!(matches!(AgentBridge::at(dir.socket()), Err(e) if e.code == "UNSAFE_DIRECTORY"));
            fs::set_permissions(&dir.0, fs::Permissions::from_mode(0o700)).unwrap(); let _bridge = AgentBridge::at(dir.socket()).unwrap();
            assert_eq!(crate::agent_transport::request(&dir.socket(), &json!({"command":"shell","params":{}})).unwrap()["error"]["code"], "UNKNOWN_COMMAND");
            assert_eq!(crate::agent_transport::request(&dir.socket(), &json!({"command":"context","params":[]})).unwrap()["error"]["code"], "INVALID_REQUEST");
        }
    }
}
