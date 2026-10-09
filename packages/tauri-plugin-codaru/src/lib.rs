//! Native services for Codaru embedded inside an existing Tauri 2 host.
//! This plugin creates no windows or webviews and does not own editor state.

mod export_content;
mod agent_transport;
mod bridge;
mod commands;

use std::path::PathBuf;
use tauri::{plugin::TauriPlugin, Manager, Runtime};

pub use bridge::AgentRequest;

enum AgentState {
    Ready(bridge::AgentBridge),
    Unavailable(String),
}

impl AgentState {
    fn new(enabled: bool, path: Option<PathBuf>) -> Self {
        if !enabled {
            return Self::Unavailable("CLI_DISABLED: This host disabled the local Codaru CLI bridge.".into());
        }
        #[cfg(unix)]
        {
            let bridge = match path {
                Some(path) => bridge::AgentBridge::at(path),
                None => bridge::AgentBridge::start(),
            };
            match bridge {
                Ok(bridge) => Self::Ready(bridge),
                Err(error) => Self::Unavailable(error.to_string()),
            }
        }
        #[cfg(not(unix))]
        {
            let _ = path;
            Self::Unavailable("UNSUPPORTED_PLATFORM: The local Codaru CLI bridge requires a Unix socket. The embedded editor and native document dialogs remain available.".into())
        }
    }

    fn bridge(&self) -> Result<&bridge::AgentBridge, String> {
        match self {
            Self::Ready(bridge) => Ok(bridge),
            Self::Unavailable(error) => Err(error.clone()),
        }
    }
}

/// Configure native services without creating a second window, process, or webview.
/// The CLI bridge is enabled by default, with its existing socket path/env override.
pub struct Builder {
    agent_enabled: bool,
    socket_path: Option<PathBuf>,
}

impl Default for Builder {
    fn default() -> Self {
        Self { agent_enabled: true, socket_path: None }
    }
}

impl Builder {
    pub fn new() -> Self { Self::default() }

    /// Disable the local CLI while preserving the embedded editor and dialogs.
    pub fn agent_enabled(mut self, enabled: bool) -> Self {
        self.agent_enabled = enabled;
        self
    }

    /// Override the socket path for this host. This takes precedence over
    /// CODARU_AGENT_SOCKET. Each simultaneously running host needs a private directory.
    pub fn socket_path(mut self, path: impl Into<PathBuf>) -> Self {
        self.socket_path = Some(path.into());
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        tauri::plugin::Builder::new("codaru")
            .invoke_handler(tauri::generate_handler![
                commands::agent_poll,
                commands::agent_respond,
                commands::save_document,
                commands::open_document,
            ])
            .setup(move |app, _api| {
                // CLI availability must not decide whether the containing app opens.
                // A socket conflict or unsupported OS is reported by poll/respond.
                app.manage(AgentState::new(self.agent_enabled, self.socket_path));
                Ok(())
            })
            .build()
    }
}

/// Register the four `plugin:codaru|...` commands with the default CLI configuration.
pub fn init<R: Runtime>() -> TauriPlugin<R> { Builder::new().build() }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn disabling_cli_does_not_attempt_to_bind_a_socket() {
        let state = AgentState::new(false, Some(PathBuf::from("relative/invalid/path")));
        assert!(matches!(state, AgentState::Unavailable(ref error) if error.starts_with("CLI_DISABLED:")));
        assert!(state.bridge().is_err());
    }

    #[cfg(unix)]
    #[test]
    fn socket_failure_is_reported_without_failing_host_initialization() {
        let state = AgentState::new(true, Some(PathBuf::from("relative/invalid/path")));
        assert!(matches!(state, AgentState::Unavailable(ref error) if error.starts_with("INVALID_SOCKET_PATH:")));
    }
}
