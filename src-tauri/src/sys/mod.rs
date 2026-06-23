use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::HashMap;

/// Network protocol for a bound port. Serializes as `"TCP"` / `"UDP"` or the raw OS string for unknown values.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Protocol {
    Tcp,
    Udp,
    Other(String),
}

impl Protocol {
    pub(crate) fn parse_known(s: &str) -> Option<Self> {
        match s {
            "TCP" => Some(Self::Tcp),
            "UDP" => Some(Self::Udp),
            _ => None,
        }
    }

    fn as_str(&self) -> &str {
        match self {
            Self::Tcp => "TCP",
            Self::Udp => "UDP",
            Self::Other(s) => s.as_str(),
        }
    }
}

impl std::fmt::Display for Protocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.as_str())
    }
}

impl Serialize for Protocol {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.as_str())
    }
}

impl<'de> Deserialize<'de> for Protocol {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Ok(match s.as_str() {
            "TCP" => Self::Tcp,
            "UDP" => Self::Udp,
            other => Self::Other(other.to_string()),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub port: u16,
    pub protocol: Protocol,
    pub pid: u32,
    pub process_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum PortPurgeError {
    #[error("Access Denied. Try running with admin/sudo privileges.")]
    AccessDenied,
    #[error("Process not found (it may have already exited).")]
    ProcessNotFound,
    #[error("Command error: {0}")]
    CommandError(String),
    #[error("Unknown error: {0}")]
    Unknown(String),
}

/// Deduplicate by `(port, protocol)`, preferring a known process name over `"Unknown"`, then sort by port.
pub(crate) fn dedupe_and_sort_ports(ports: Vec<PortInfo>) -> Vec<PortInfo> {
    let mut unique_ports = HashMap::new();
    for p in ports {
        let key = (p.port, p.protocol.clone());
        unique_ports
            .entry(key)
            .and_modify(|existing: &mut PortInfo| {
                if (existing.process_name == "Unknown" || existing.process_name.is_empty())
                    && p.process_name != "Unknown"
                {
                    *existing = p.clone();
                }
            })
            .or_insert(p);
    }

    let mut result: Vec<PortInfo> = unique_ports.into_values().collect();
    result.sort_by_key(|p| p.port);
    result
}

/// Partial port entry from a netstat line (process name resolved separately on Windows).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPort {
    pub port: u16,
    pub protocol: Protocol,
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
    let h = host.trim_matches(['[', ']']);
    h == "::1" || h.eq_ignore_ascii_case("127.0.0.1") || h.eq_ignore_ascii_case("localhost")
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
    use super::{
        dedupe_and_sort_ports, host_from_addr_port, is_localhost_address, PortInfo, PortPurgeError,
        Protocol,
    };

    fn port_info(port: u16, protocol: Protocol, pid: u32, process_name: &str) -> PortInfo {
        PortInfo {
            port,
            protocol,
            pid,
            process_name: process_name.into(),
        }
    }

    #[test]
    fn dedupe_and_sort_ports_prefers_known_name_over_unknown() {
        let ports = vec![
            port_info(3000, Protocol::Tcp, 1, "Unknown"),
            port_info(3000, Protocol::Tcp, 1, "node"),
        ];
        let result = dedupe_and_sort_ports(ports);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].process_name, "node");
    }

    #[test]
    fn dedupe_and_sort_ports_prefers_known_name_over_empty() {
        let ports = vec![
            port_info(8080, Protocol::Udp, 2, ""),
            port_info(8080, Protocol::Udp, 2, "nginx"),
        ];
        let result = dedupe_and_sort_ports(ports);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].process_name, "nginx");
    }

    #[test]
    fn dedupe_and_sort_ports_sorts_by_port_ascending() {
        let ports = vec![
            port_info(9000, Protocol::Tcp, 3, "a"),
            port_info(3000, Protocol::Tcp, 1, "b"),
            port_info(5173, Protocol::Udp, 2, "c"),
        ];
        let result = dedupe_and_sort_ports(ports);
        assert_eq!(
            result.iter().map(|p| p.port).collect::<Vec<_>>(),
            vec![3000, 5173, 9000]
        );
    }

    #[test]
    fn port_purge_error_display_strings_match_ipc_contract() {
        assert_eq!(
            PortPurgeError::AccessDenied.to_string(),
            "Access Denied. Try running with admin/sudo privileges."
        );
        assert_eq!(
            PortPurgeError::ProcessNotFound.to_string(),
            "Process not found (it may have already exited)."
        );
        assert_eq!(
            PortPurgeError::CommandError("spawn failed".into()).to_string(),
            "Command error: spawn failed"
        );
        assert_eq!(
            PortPurgeError::Unknown("unexpected".into()).to_string(),
            "Unknown error: unexpected"
        );
    }

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
            protocol: Protocol::Tcp,
            pid: 1,
            process_name: "node".into(),
        };
        let json: serde_json::Value = serde_json::to_value(&info).unwrap();
        assert_eq!(json["processName"], "node");
        assert_eq!(json["port"], 3000);
        assert_eq!(json["protocol"], "TCP");
        assert_eq!(json["pid"], 1);
    }

    #[test]
    fn protocol_serializes_other_as_raw_os_string() {
        let protocol = Protocol::Other("SCTP".into());
        let json = serde_json::to_value(&protocol).unwrap();
        assert_eq!(json, "SCTP");
    }
}
