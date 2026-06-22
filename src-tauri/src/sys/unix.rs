use super::{host_from_addr_port, is_localhost_address, PortInfo, PortPurgeError};
use std::collections::HashMap;
use std::process::Command;

/// Parse a single `lsof -i -P -n` output line into a localhost-bound port entry.
pub(crate) fn parse_lsof_line(line: &str) -> Option<PortInfo> {
    let line = line.trim();
    if line.is_empty() || line.starts_with("COMMAND") {
        return None;
    }

    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let process_name = parts[0].to_string();
    let pid = parts[1].parse::<u32>().ok()?;
    let protocol = parts[7];

    if protocol != "TCP" && protocol != "UDP" {
        return None;
    }

    let name_col = parts[8];

    if protocol == "TCP" && !name_col.contains("(LISTEN)") {
        return None;
    }

    let addr_port = name_col.split_whitespace().next().unwrap_or(name_col);
    let host = host_from_addr_port(addr_port)?;
    if !is_localhost_address(host) {
        return None;
    }

    let port = match addr_port.rfind(':') {
        Some(pos) => addr_port[pos + 1..].parse::<u16>().ok()?,
        None => return None,
    };

    Some(PortInfo {
        port,
        protocol: protocol.to_string(),
        pid,
        process_name,
    })
}

/// Scans active TCP/UDP ports using `lsof -i -P -n` on Unix systems and parses the process mapping.
pub async fn get_active_ports() -> Result<Vec<PortInfo>, PortPurgeError> {
    let mut ports = Vec::new();
    let mut cmd = Command::new("lsof");
    cmd.args(&["-i", "-P", "-n"]);

    let output = cmd.output().map_err(|e| PortPurgeError::CommandError(e.to_string()))?;
    if !output.status.success() {
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        if stdout_str.trim().is_empty() {
            return Ok(vec![]);
        }
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(PortPurgeError::CommandError(stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        if let Some(port_info) = parse_lsof_line(line) {
            ports.push(port_info);
        }
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

/// Terminates a process on Unix using `kill -9 <pid>`.
pub async fn kill_process_by_pid(pid: u32) -> Result<(), PortPurgeError> {
    let mut cmd = Command::new("kill");
    cmd.args(&["-9", &pid.to_string()]);

    let output = cmd.output().map_err(|e| PortPurgeError::CommandError(e.to_string()))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let error_msg = stderr.to_string();

        if error_msg.contains("Operation not permitted") || error_msg.contains("Permission denied") {
            return Err(PortPurgeError::AccessDenied);
        } else if error_msg.contains("No such process") {
            return Err(PortPurgeError::ProcessNotFound);
        } else {
            return Err(PortPurgeError::CommandError(error_msg));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::parse_lsof_line;

    #[test]
    fn parse_lsof_line_tcp_ipv4_localhost() {
        let parsed = parse_lsof_line(
            "node    1234 chamidu   21u  IPv4 0xdeadbeef      0t0  TCP 127.0.0.1:3000 (LISTEN)",
        )
        .unwrap();
        assert_eq!(parsed.port, 3000);
        assert_eq!(parsed.protocol, "TCP");
        assert_eq!(parsed.pid, 1234);
        assert_eq!(parsed.process_name, "node");
    }

    #[test]
    fn parse_lsof_line_tcp_ipv6_loopback() {
        let parsed = parse_lsof_line(
            "node    5678 chamidu   22u  IPv6 0xdeadbeef      0t0  TCP [::1]:5173 (LISTEN)",
        )
        .unwrap();
        assert_eq!(parsed.port, 5173);
        assert_eq!(parsed.pid, 5678);
    }

    #[test]
    fn parse_lsof_line_udp_localhost() {
        let parsed = parse_lsof_line(
            "mDNSRes  100 chamidu   23u  IPv4 0xdeadbeef      0t0  UDP localhost:5353",
        )
        .unwrap();
        assert_eq!(parsed.port, 5353);
        assert_eq!(parsed.protocol, "UDP");
    }

    #[test]
    fn parse_lsof_line_rejects_wildcard_bind() {
        assert!(parse_lsof_line(
            "node    1234 chamidu   21u  IPv4 0xdeadbeef      0t0  TCP *:8080 (LISTEN)",
        )
        .is_none());
    }

    #[test]
    fn parse_lsof_line_rejects_non_listening_tcp() {
        assert!(parse_lsof_line(
            "node    1234 chamidu   21u  IPv4 0xdeadbeef      0t0  TCP 127.0.0.1:3000->1.2.3.4:443 (ESTABLISHED)",
        )
        .is_none());
    }

    #[test]
    fn parse_lsof_line_rejects_lan_address() {
        assert!(parse_lsof_line(
            "node    1234 chamidu   21u  IPv4 0xdeadbeef      0t0  TCP 192.168.1.5:3000 (LISTEN)",
        )
        .is_none());
    }

    #[test]
    fn parse_lsof_line_rejects_header() {
        assert!(parse_lsof_line("COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME").is_none());
    }
}
