use super::{
    dedupe_and_sort_ports, host_from_addr_port, is_localhost_address, ParsedPort, PortInfo,
    PortPurgeError, Protocol,
};
use std::collections::HashMap;
use std::os::windows::process::CommandExt;
use std::process::Command;

/// Parse a single `netstat -ano` output line into a localhost-bound port entry.
pub(crate) fn parse_netstat_line(line: &str) -> Option<ParsedPort> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    let mut parts = line.split_whitespace();
    let protocol = Protocol::parse_known(parts.next()?)?;

    let local_addr = parts.next()?;

    let host = host_from_addr_port(local_addr)?;
    if !is_localhost_address(host) {
        return None;
    }

    let port = match local_addr.rfind(':') {
        Some(pos) => local_addr[pos + 1..].parse::<u16>().ok()?,
        None => return None,
    };

    let pid = match protocol {
        Protocol::Tcp => {
            let _foreign = parts.next()?;
            let state = parts.next()?;
            if state != "LISTENING" {
                return None;
            }
            parts.next()?.parse::<u32>().ok()?
        }
        Protocol::Udp => {
            let _foreign = parts.next()?;
            parts.next()?.parse::<u32>().ok()?
        }
        Protocol::Other(_) => return None,
    };

    if pid == 0 {
        return None;
    }

    Some(ParsedPort {
        port,
        protocol,
        pid,
    })
}

fn build_port_info(parsed: ParsedPort, process_map: &HashMap<u32, String>) -> PortInfo {
    let process_name = process_map
        .get(&parsed.pid)
        .cloned()
        .unwrap_or_else(|| "Unknown".to_string());

    PortInfo {
        port: parsed.port,
        protocol: parsed.protocol,
        pid: parsed.pid,
        process_name,
    }
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
    tauri::async_runtime::spawn_blocking(|| {
        let process_map = get_process_map();
        let mut ports = Vec::new();

        let mut cmd = Command::new("netstat");
        cmd.arg("-ano");
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| PortPurgeError::CommandError(e.to_string()))?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(PortPurgeError::CommandError(stderr));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let Some(parsed) = parse_netstat_line(line) else {
                continue;
            };

            ports.push(build_port_info(parsed, &process_map));
        }

        Ok(dedupe_and_sort_ports(ports))
    })
    .await
    .map_err(|e| PortPurgeError::Unknown(e.to_string()))?
}

/// Terminates a process on Windows using `taskkill /F /PID <pid>`.
pub async fn kill_process_by_pid(pid: u32) -> Result<(), PortPurgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("taskkill");
        cmd.args(&["/F", "/PID", &pid.to_string()]);
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let output = cmd
            .output()
            .map_err(|e| PortPurgeError::CommandError(e.to_string()))?;

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
    })
    .await
    .map_err(|e| PortPurgeError::Unknown(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::parse_netstat_line;
    use super::Protocol;

    #[test]
    fn parse_netstat_line_tcp_localhost() {
        let parsed = parse_netstat_line(
            "  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1234",
        )
        .unwrap();
        assert_eq!(parsed.port, 3000);
        assert_eq!(parsed.protocol, Protocol::Tcp);
        assert_eq!(parsed.pid, 1234);
    }

    #[test]
    fn parse_netstat_line_tcp_ipv6_loopback() {
        let parsed = parse_netstat_line(
            "  TCP    [::1]:5173             [::]:0                 LISTENING       5678",
        )
        .unwrap();
        assert_eq!(parsed.port, 5173);
        assert_eq!(parsed.pid, 5678);
    }

    #[test]
    fn parse_netstat_line_udp_localhost() {
        let parsed = parse_netstat_line(
            "  UDP    127.0.0.1:5353         *:*                                    9999",
        )
        .unwrap();
        assert_eq!(parsed.port, 5353);
        assert_eq!(parsed.protocol, Protocol::Udp);
        assert_eq!(parsed.pid, 9999);
    }

    #[test]
    fn parse_netstat_line_rejects_non_listening_tcp() {
        assert!(parse_netstat_line(
            "  TCP    127.0.0.1:3000         0.0.0.0:0              ESTABLISHED     1234"
        )
        .is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_all_interfaces() {
        assert!(parse_netstat_line(
            "  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4"
        )
        .is_none());
        assert!(parse_netstat_line(
            "  TCP    [::]:8080              [::]:0                 LISTENING       4"
        )
        .is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_lan_address() {
        assert!(parse_netstat_line(
            "  TCP    192.168.1.10:3000      0.0.0.0:0              LISTENING       1234"
        )
        .is_none());
    }

    #[test]
    fn parse_netstat_line_rejects_header_and_malformed() {
        assert!(parse_netstat_line("  Proto  Local Address").is_none());
        assert!(parse_netstat_line(
            "  TCP    127.0.0.1:bad          0.0.0.0:0              LISTENING       1234"
        )
        .is_none());
    }

    #[test]
    fn throughput_baseline() {
        const FIXTURE: &str = "
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:80             0.0.0.0:0              LISTENING       4
  TCP    127.0.0.1:3000         0.0.0.0:0              LISTENING       1001
  TCP    127.0.0.1:3000         0.0.0.0:0              ESTABLISHED     1001
  TCP    [::1]:5173             [::]:0                 LISTENING       1002
  TCP    192.168.1.10:8080      0.0.0.0:0              LISTENING       1003
  UDP    127.0.0.1:5353         *:*                                    1004
  UDP    127.0.0.1:1900         *:*                                    1005
  TCP    127.0.0.1:1420         0.0.0.0:0              LISTENING       1006
  TCP    [::1]:1420             [::]:0                 LISTENING       1006
  TCP    127.0.0.1:5037         0.0.0.0:0              LISTENING       1007
  UDP    localhost:5353         *:*                                    1008
  TCP    localhost:7768         0.0.0.0:0              LISTENING       1009
  TCP    127.0.0.1:27015        0.0.0.0:0              LISTENING       1010
  TCP    [::]:443               [::]:0                 LISTENING       1011
  UDP    0.0.0.0:123            *:*                                    1012
  TCP    127.0.0.1:6188         0.0.0.0:0              LISTENING       1013
  TCP    127.0.0.1:6189         0.0.0.0:0              LISTENING       1014
  TCP    127.0.0.1:9080         0.0.0.0:0              LISTENING       1015
  UDP    127.0.0.1:50207        *:*                                    1016
  TCP    127.0.0.1:49202        0.0.0.0:0              LISTENING       1017
";

        let mut matches = 0usize;
        for _ in 0..100 {
            for line in FIXTURE.lines() {
                if parse_netstat_line(line).is_some() {
                    matches += 1;
                }
            }
        }

        assert!(matches > 0, "expected at least one localhost port match");
        assert_eq!(matches, 1500, "expected 15 matching lines per iteration");
    }
}
