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

/// Partial port entry from a netstat line (process name resolved separately on Windows).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPort {
    pub port: u16,
    pub protocol: String,
    pub pid: u32,
}

/// Returns the host portion of an address:port string (e.g. `127.0.0.1:8080`, `[::1]:3000`).
pub(crate) fn host_from_addr_port(addr_port: &str) -> Option<&str> {
    if let Some(rest) = addr_port.strip_prefix('[') {
        let end = rest.find(']')?;
        Some(&rest[..end])
    } else {
        let colon = addr_port.rfind(':')?;
        Some(&addr_port[..colon])
    }
}

/// True when the bind address is loopback-only.
pub(crate) fn is_localhost_address(host: &str) -> bool {
    let h = host.trim_matches(['[', ']']).to_ascii_lowercase();
    h == "127.0.0.1" || h == "::1" || h == "localhost"
}

// Platform-specific conditional compilation
#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::{get_active_ports, kill_process_by_pid};

#[cfg(not(target_os = "windows"))]
mod unix;
#[cfg(not(target_os = "windows"))]
pub use unix::{get_active_ports, kill_process_by_pid};

#[cfg(test)]
mod tests {
    use super::{host_from_addr_port, is_localhost_address, PortInfo};

    #[test]
    fn is_localhost_address_accepts_loopback_hosts() {
        assert!(is_localhost_address("127.0.0.1"));
        assert!(is_localhost_address("::1"));
        assert!(is_localhost_address("[::1]"));
        assert!(is_localhost_address("localhost"));
        assert!(is_localhost_address("LOCALHOST"));
    }

    #[test]
    fn is_localhost_address_rejects_non_loopback_hosts() {
        assert!(!is_localhost_address("0.0.0.0"));
        assert!(!is_localhost_address("*"));
        assert!(!is_localhost_address("192.168.1.10"));
        assert!(!is_localhost_address("[::]"));
    }

    #[test]
    fn host_from_addr_port_parses_ipv4_and_ipv6() {
        assert_eq!(host_from_addr_port("127.0.0.1:8080"), Some("127.0.0.1"));
        assert_eq!(host_from_addr_port("[::1]:3000"), Some("::1"));
        assert_eq!(host_from_addr_port("localhost:5173"), Some("localhost"));
    }

    #[test]
    fn port_info_serializes_camel_case() {
        let info = PortInfo {
            port: 3000,
            protocol: "TCP".into(),
            pid: 1,
            process_name: "node".into(),
        };
        let json: serde_json::Value = serde_json::to_value(&info).unwrap();
        assert_eq!(json["processName"], "node");
        assert_eq!(json["port"], 3000);
        assert_eq!(json["protocol"], "TCP");
        assert_eq!(json["pid"], 1);
    }
}
