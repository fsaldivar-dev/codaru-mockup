use serde::Serialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::time::Duration;

pub const MAX_REQUEST_BYTES: usize = 20_000_000;
pub const MAX_RESPONSE_BYTES: usize = 64_000_000;
pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
pub const RESPONSE_TIMEOUT: Duration = Duration::from_secs(20);
pub const CLIENT_TIMEOUT: Duration = Duration::from_secs(30);
pub const WRITE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Serialize)]
pub struct AgentError {
    pub code: String,
    pub message: String,
}
impl AgentError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self { code: code.into(), message: message.into() }
    }
    pub fn json(&self) -> Value { json!({ "ok": false, "error": self }) }
}
impl std::fmt::Display for AgentError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{}: {}", self.code, self.message) }
}
impl std::error::Error for AgentError {}
pub type Result<T> = std::result::Result<T, AgentError>;

#[cfg(not(unix))]
pub fn socket_path() -> Result<PathBuf> {
    Err(AgentError::new("UNSUPPORTED_PLATFORM", "The local CLI bridge currently requires macOS or another Unix platform."))
}

#[cfg(unix)]
pub fn socket_path() -> Result<PathBuf> {
    if let Some(path) = std::env::var_os("CODARU_AGENT_SOCKET") {
        if path.is_empty() { return Err(AgentError::new("INVALID_SOCKET_PATH", "CODARU_AGENT_SOCKET must not be empty.")); }
        return Ok(PathBuf::from(path));
    }
    let home = std::env::var_os("HOME").ok_or_else(|| AgentError::new("INVALID_SOCKET_PATH", "HOME is unavailable. Set CODARU_AGENT_SOCKET to a private Unix socket path."))?;
    Ok(PathBuf::from(home).join(".local/share/codaru-mockup/agent.sock"))
}

#[cfg(unix)]
pub fn read_frame(stream: &mut std::os::unix::net::UnixStream, limit: usize, timeout: Duration) -> Result<Vec<u8>> {
    use std::io::Read;
    // Nonblocking reads also handle a peer that closed after leaving buffered
    // bytes; setting SO_RCVTIMEO on that Darwin socket can fail with EINVAL.
    stream.set_nonblocking(true).map_err(io_error)?;
    let started = std::time::Instant::now();
    let mut data = Vec::new();
    loop {
        let remaining = timeout.checked_sub(started.elapsed()).filter(|d| !d.is_zero()).ok_or_else(|| AgentError::new("TIMEOUT", "The local socket read timed out."))?;
        let mut buffer = [0_u8; 8192];
        let count = match stream.read(&mut buffer) {
            Ok(0) => return Err(AgentError::new("INCOMPLETE_MESSAGE", "The app closed the connection before sending a complete JSON response.")),
            Ok(count) => count,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => { std::thread::sleep(remaining.min(Duration::from_millis(2))); continue; },
            Err(e) => { let mut error = io_error(e); error.message = format!("Cannot read socket: {}", error.message); return Err(error); },
        };
        let end = buffer[..count].iter().position(|b| *b == b'\n');
        let part = &buffer[..end.unwrap_or(count)];
        if data.len() + part.len() > limit { return Err(AgentError::new("MESSAGE_TOO_LARGE", format!("The JSON message exceeds the {} byte limit.", limit))); }
        data.extend_from_slice(part);
        if end.is_some() { return Ok(data); }
    }
}

#[cfg(unix)]
pub fn write_frame(stream: &mut std::os::unix::net::UnixStream, value: &Value, limit: usize) -> Result<()> {
    write_frame_with_timeout(stream, value, limit, WRITE_TIMEOUT)
}

#[cfg(unix)]
fn write_frame_with_timeout(stream: &mut std::os::unix::net::UnixStream, value: &Value, limit: usize, timeout: Duration) -> Result<()> {
    use std::io::Write;
    let mut bytes = serde_json::to_vec(value).map_err(|e| AgentError::new("INVALID_JSON", e.to_string()))?;
    if bytes.len() > limit { return Err(AgentError::new("MESSAGE_TOO_LARGE", format!("The JSON message exceeds the {} byte limit.", limit))); }
    bytes.push(b'\n');
    // Wait in the kernel for send-buffer space. Timer-based retries can be
    // coalesced for a background macOS app and truncate a large export.
    stream.set_nonblocking(false).map_err(io_error)?;
    let started = std::time::Instant::now();
    let mut written = 0;
    while written < bytes.len() {
        let remaining = timeout.checked_sub(started.elapsed()).filter(|d| !d.is_zero()).ok_or_else(|| AgentError::new("TIMEOUT", "The local socket write timed out."))?;
        stream.set_write_timeout(Some(remaining)).map_err(io_error)?;
        match stream.write(&bytes[written..]) {
            Ok(0) => return Err(AgentError::new("SOCKET_UNAVAILABLE", "The local connection closed while writing JSON.")),
            Ok(count) => written += count,
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(e) if matches!(e.kind(), std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut) => continue,
            Err(e) => return Err(io_error(e)),
        }
    }
    Ok(())
}

#[cfg(unix)]
fn io_error(e: std::io::Error) -> AgentError {
    let code = match e.kind() {
        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut => "TIMEOUT",
        std::io::ErrorKind::ConnectionReset | std::io::ErrorKind::BrokenPipe | std::io::ErrorKind::UnexpectedEof => "INCOMPLETE_MESSAGE",
        _ => "SOCKET_UNAVAILABLE",
    };
    AgentError::new(code, e.to_string())
}

#[cfg(unix)]
pub fn request(path: &std::path::Path, payload: &Value) -> Result<Value> {
    use std::os::unix::fs::{FileTypeExt, MetadataExt};
    let metadata = std::fs::symlink_metadata(path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound { app_closed(path) } else { AgentError::new("SOCKET_UNAVAILABLE", format!("Cannot inspect {}: {}", path.display(), e)) }
    })?;
    if !metadata.file_type().is_socket() || metadata.mode() & 0o777 != 0o600 {
        return Err(AgentError::new("UNSAFE_SOCKET", format!("{} must be a Unix socket with permissions 0600.", path.display())));
    }
    let mut stream = connect(path, REQUEST_TIMEOUT).map_err(|e| {
        if [std::io::ErrorKind::NotFound, std::io::ErrorKind::ConnectionRefused].contains(&e.kind()) { app_closed(path) }
        else { AgentError::new("SOCKET_UNAVAILABLE", format!("Cannot connect to {}: {}", path.display(), e)) }
    })?;
    write_frame(&mut stream, payload, MAX_REQUEST_BYTES)?;
    let bytes = read_frame(&mut stream, MAX_RESPONSE_BYTES, CLIENT_TIMEOUT).map_err(|e| {
        if e.code == "TIMEOUT" { AgentError::new("TIMEOUT", "Codaru Mockup did not reply in time. Run context before retrying a change: the previous command may have applied.") } else { e }
    })?;
    serde_json::from_slice(&bytes).map_err(|e| AgentError::new("INVALID_RESPONSE", format!("The app returned invalid JSON: {}", e)))
}

#[cfg(unix)]
pub fn connect(path: &std::path::Path, timeout: Duration) -> std::io::Result<std::os::unix::net::UnixStream> {
    // std has no UnixStream::connect_timeout. A bounded waiter prevents a full
    // socket backlog from blocking the CLI or stale-socket check indefinitely.
    let path = path.to_owned(); let (sender, receiver) = std::sync::mpsc::sync_channel(1);
    std::thread::Builder::new().name("codaru-agent-connect".into()).spawn(move || { let _ = sender.send(std::os::unix::net::UnixStream::connect(path)); })?;
    receiver.recv_timeout(timeout).map_err(|_| std::io::Error::new(std::io::ErrorKind::TimedOut, "The local socket connection timed out."))?
}

#[cfg(unix)]
fn app_closed(path: &std::path::Path) -> AgentError {
    AgentError::new("APP_NOT_RUNNING", format!("Open Codaru Mockup and retry. No running app is listening at {}. Use the same CODARU_AGENT_SOCKET in the app and CLI for a custom path.", path.display()))
}

#[cfg(not(unix))]
pub fn request(_: &std::path::Path, _: &Value) -> Result<Value> {
    Err(AgentError::new("UNSUPPORTED_PLATFORM", "The local CLI bridge currently requires macOS or another Unix platform."))
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::{io::Write, os::unix::net::UnixStream};
    #[test]
    fn enforces_frame_size_and_total_read_timeout() {
        let (mut reader, mut writer) = UnixStream::pair().unwrap(); writer.write_all(b"123456\n").unwrap();
        assert_eq!(read_frame(&mut reader, 5, Duration::from_secs(1)).unwrap_err().code, "MESSAGE_TOO_LARGE");
        let (mut reader, _writer) = UnixStream::pair().unwrap();
        assert_eq!(read_frame(&mut reader, 5, Duration::from_millis(20)).unwrap_err().code, "TIMEOUT");
    }
    #[test]
    fn roundtrips_escaped_newlines_and_rejects_truncated_frames() {
        let (mut reader, mut writer) = UnixStream::pair().unwrap(); let payload = json!({"text":"line 1\nline 2"});
        write_frame(&mut writer, &payload, 100).unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&read_frame(&mut reader, 100, Duration::from_secs(1)).unwrap()).unwrap(), payload);
        writer.write_all(b"{unfinished").unwrap(); drop(writer);
        let error = read_frame(&mut reader, 100, Duration::from_secs(1)).unwrap_err();
        assert_eq!(error.code, "INCOMPLETE_MESSAGE", "{}", error.message);
    }
    #[test]
    fn roundtrips_large_export_with_socket_backpressure() {
        let (mut reader, mut writer) = UnixStream::pair().unwrap();
        let payload = json!({"content": "export-data ".repeat(800_000)});
        let expected = payload.clone();
        let sending = std::thread::spawn(move || write_frame(&mut writer, &payload, MAX_RESPONSE_BYTES));
        let received = read_frame(&mut reader, MAX_RESPONSE_BYTES, CLIENT_TIMEOUT).unwrap();
        sending.join().unwrap().unwrap();
        assert_eq!(serde_json::from_slice::<Value>(&received).unwrap(), expected);
    }
    #[test]
    fn stalled_export_write_has_a_total_deadline() {
        let (_reader, mut writer) = UnixStream::pair().unwrap();
        let payload = json!({"content": "export-data ".repeat(800_000)});
        let started = std::time::Instant::now();
        let error = write_frame_with_timeout(&mut writer, &payload, MAX_RESPONSE_BYTES, Duration::from_millis(60)).unwrap_err();
        assert_eq!(error.code, "TIMEOUT");
        assert!(started.elapsed() < Duration::from_secs(1), "stalled peer must not hold a worker indefinitely");
    }
}
