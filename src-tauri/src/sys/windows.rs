use super::{host_from_addr_port, is_localhost_address, ParsedPort, PortInfo, PortPurgeError};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;

/// Parse a single `netstat -ano` output line into a localhost-bound port entry.
pub(crate) fn parse_netstat_line(line: &str) -> Option<ParsedPort> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let proto = parts[0];
    if proto != "TCP" && proto != "UDP" {
        return None;
    }

    if parts.len() < 2 {
        return None;
    }
    let local_addr = parts[1];

    let host = host_from_addr_port(local_addr)?;
    if !is_localhost_address(host) {
        return None;
    }

    let port = match local_addr.rfind(':') {
        Some(pos) => local_addr[pos + 1..].parse::<u16>().ok()?,
        None => return None,
    };

    let pid = if proto == "TCP" {
        if parts.len() < 5 {
            return None;
        }
        let state = parts[3];
        if state != "LISTENING" {
            return None;
        }
        parts[4].parse::<u32>().ok()?
    } else {
        if parts.len() < 4 {
            return None;
        }
        parts[3].parse::<u32>().ok()?
    };

    if pid == 0 {
        return None;
    }

    Some(ParsedPort {
        port,
        protocol: proto.to_string(),
        pid,
    })
}

/// Helper to build a map of PID -> Process Name using `tasklist` on Windows.
fn get_process_map() -> HashMap<u32, String> {
    let mut map = HashMap::new();
    let mut cmd = Command::new("tasklist");
    cmd.args(&["/FO", "CSV", "/NH"]);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    if let Ok(output) = cmd.output() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            let content = line.trim_matches('"');
            let parts: Vec<&str> = content.split("\",\"").collect();
            if parts.len() >= 2 {
                let name = parts[0].to_string();
                let pid_str = parts[1];
                if let Ok(pid) = pid_str.parse::<u32>() {
                    map.insert(pid, name);
                }
            }
        }
    }
    map
}

/// Scans active TCP/UDP ports using `netstat -ano` on Windows and parses the process mapping.
pub async fn get_active_ports() -> Result<Vec<PortInfo>, PortPurgeError> {
    let process_map = get_process_map();
    let mut ports = Vec::new();

    let mut cmd = Command::new("netstat");
    cmd.arg("-ano");
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| PortPurgeError::CommandError(e.to_string()))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(PortPurgeError::CommandError(stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let Some(parsed) = parse_netstat_line(line) else {
            continue;
        };

        let process_name = process_map
            .get(&parsed.pid)
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        ports.push(PortInfo {
            port: parsed.port,
            protocol: parsed.protocol,
            pid: parsed.pid,
            process_name,
        });
    }

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

    Ok(result)
}

/// Terminates a process on Windows using `taskkill /F /PID <pid>`.
pub async fn kill_process_by_pid(pid: u32) -> Result<(), PortPurgeError> {
    let mut cmd = Command::new("taskkill");
    cmd.args(&["/F", "/PID", &pid.to_string()]);
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

    let output = cmd.output().map_err(|e| PortPurgeError::CommandError(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let error_msg = format!("{}{}", stderr, stdout);

        if error_msg.contains("Access is denied") || error_msg.contains("denied") {
            return Err(PortPurgeError::AccessDenied);
        } else if error_msg.contains("not found") {
            return Err(PortPurgeError::ProcessNotFound);
        } else {
            return Err(PortPurgeError::CommandError(error_msg));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_netstat_line;

    #[test]
    fn parse_netstat_line_tcp_localhost() {
        let parsed = parse_netstat_line("  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234")
            .unwrap();
        assert_eq!(parsed.port, 3000);
        assert_eq!(parsed.protocol, "TCP");
        assert_eq!(parsed.pid, 1234);
    }

    #[test]
    fn parse_netstat_line_tcp_ipv6_loopback() {
        let parsed = parse_netstat_line("  TCP    [::1]:5173             [::]:0                 LISTENING       5678")
            .unwrap();
        assert_eq!(parsed.port, 5173);
        assert_eq!(parsed.pid, 5678);
    }

    #[test]
    fn parse_netstat_line_udp_localhost() {
        let parsed = parse_netstat_line("  UDP    127.0.0.1:5353         *:*                                    9999")
            .unwrap();
        assert_eq!(parsed.port, 5353);
        assert_eq!(parsed.protocol, "UDP");
        assert_eq!(parsed.pid, 9999);
    }

    #[test]
    fn parse_netstat_line_rejects_non_listening_tcp() {
        assert!(parse_netstat_line("  TCP    127.0.0.1:3000         0.0.0.0:0              ESTABLISHED     1234").is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_all_interfaces() {
        assert!(parse_netstat_line("  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4").is_none());
        assert!(parse_netstat_line("  TCP    [::]:8080              [::]:0                 LISTENING       4").is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_lan_address() {
        assert!(parse_netstat_line("  TCP    192.168.1.10:3000      0.0.0.0:0              LISTENING       1234").is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_header_and_malformed() {
        assert!(parse_netstat_line("  Proto  Local Address").is_none());
        assert!(parse_netstat_line("  TCP    127.0.0.1:bad          0.0.0.0:0              LISTENING       1234").is_none());
    }
}
