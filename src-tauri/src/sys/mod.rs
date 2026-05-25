use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub port: u16,
    pub protocol: String, // "TCP" or "UDP"
    pub pid: u32,
    pub process_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortPurgeError {
    AccessDenied,
    ProcessNotFound,
    CommandError(String),
    Unknown(String),
}

impl std::fmt::Display for PortPurgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AccessDenied => write!(f, "Access Denied. Try running with admin/sudo privileges."),
            Self::ProcessNotFound => write!(f, "Process not found (it may have already exited)."),
            Self::CommandError(err) => write!(f, "Command error: {}", err),
            Self::Unknown(err) => write!(f, "Unknown error: {}", err),
        }
    }
}

impl std::error::Error for PortPurgeError {}

// Platform-specific conditional compilation
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::{get_active_ports, kill_process_by_pid};

#[cfg(not(target_os = "windows"))]
mod unix;
#[cfg(not(target_os = "windows"))]
pub use unix::{get_active_ports, kill_process_by_pid};
