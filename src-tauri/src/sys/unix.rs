use super::{
    dedupe_and_sort_ports, host_from_addr_port, is_localhost_address, PortInfo, PortPurgeError,
    ProcessDetails, Protocol,
};
use std::process::Command;

/// Parsed fields from `ps -p <PID> -o pid=,user=,rss=,lstart=,command= -ww`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ParsedPsDetails {
    pub pid: u32,
    pub user: String,
    pub memory_bytes: u64,
    pub started_at: String,
    pub command_line: String,
    pub process_name: String,
}

fn process_name_from_command(command: &str) -> String {
    let first_token = command.split_whitespace().next().unwrap_or("unknown");
    first_token
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(first_token)
        .to_string()
}

/// Parse a single-line `ps` output for process inspection.
pub(crate) fn parse_ps_details_line(line: &str) -> Option<ParsedPsDetails> {
    let line = line.trim();
    if line.is_empty() {
        return None;
    }

    // pid user rss Day Mon DD HH:MM:SS YYYY command...
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return None;
    }

    let pid = parts[0].parse::<u32>().ok()?;
    let user = parts[1].to_string();
    let rss_kb = parts[2].parse::<u64>().ok()?;
    let started_at = parts[3..8].join(" ");
    let command_line = parts[8..].join(" ");

    if command_line.is_empty() {
        return None;
    }

    Some(ParsedPsDetails {
        pid,
        user,
        memory_bytes: rss_kb.saturating_mul(1024),
        started_at,
        process_name: process_name_from_command(&command_line),
        command_line,
    })
}

/// Extract executable path from `lsof -a -p <PID> -d txt -Fn` output (`n` lines).
pub(crate) fn parse_lsof_exe_output(output: &str) -> Option<String> {
    for line in output.lines() {
        let line = line.trim();
        if let Some(path) = line.strip_prefix('n') {
            let path = path.trim();
            if !path.is_empty() {
                return Some(path.to_string());
            }
        }
    }
    None
}

fn is_permission_denied_message(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("operation not permitted")
        || lower.contains("permission denied")
        || lower.contains("not permitted")
        || lower.contains("access denied")
}

#[cfg(target_os = "linux")]
fn resolve_executable_path(pid: u32) -> (Option<String>, bool) {
    let proc_exe = format!("/proc/{pid}/exe");
    let output = Command::new("readlink").args(["-f", &proc_exe]).output();

    match output {
        Ok(output) if output.status.success() => {
            let resolved = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if resolved.is_empty() {
                (None, false)
            } else {
                (Some(resolved), false)
            }
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let denied = is_permission_denied_message(&stderr);
            (None, denied)
        }
        Err(_) => (None, false),
    }
}

#[cfg(target_os = "macos")]
fn resolve_executable_path(pid: u32) -> (Option<String>, bool) {
    let output = Command::new("lsof")
        .args(["-a", "-p", &pid.to_string(), "-d", "txt", "-Fn"])
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let path = parse_lsof_exe_output(&stdout);
            (path, false)
        }
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let denied = is_permission_denied_message(&stderr);
            (None, denied)
        }
        Err(_) => (None, false),
    }
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
fn resolve_executable_path(_pid: u32) -> (Option<String>, bool) {
    (None, false)
}

fn get_process_details_blocking(pid: u32) -> Result<ProcessDetails, PortPurgeError> {
    let mut cmd = Command::new("ps");
    cmd.args([
        "-p",
        &pid.to_string(),
        "-o",
        "pid=,user=,rss=,lstart=,command=",
        "-ww",
    ]);

    let output = cmd
        .output()
        .map_err(|e| PortPurgeError::CommandError(e.to_string()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    if stdout.trim().is_empty() {
        return Err(PortPurgeError::ProcessNotFound);
    }

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("No such process") {
            return Err(PortPurgeError::ProcessNotFound);
        }
        return Err(PortPurgeError::CommandError(stderr.to_string()));
    }

    let parsed = parse_ps_details_line(&stdout).ok_or(PortPurgeError::CommandError(
        "Failed to parse ps output for process details".into(),
    ))?;

    let (executable_path, exe_access_denied) = resolve_executable_path(pid);
    let permissions_limited = exe_access_denied && executable_path.is_none();

    Ok(ProcessDetails {
        pid: parsed.pid,
        process_name: parsed.process_name,
        executable_path,
        command_line: Some(parsed.command_line),
        memory_bytes: Some(parsed.memory_bytes),
        user: Some(parsed.user),
        started_at: Some(parsed.started_at),
        permissions_limited,
    })
}

/// Fetches extended process details for a PID using `ps` and platform-specific exe resolution.
pub async fn get_process_details(pid: u32) -> Result<ProcessDetails, PortPurgeError> {
    tauri::async_runtime::spawn_blocking(move || get_process_details_blocking(pid))
        .await
        .map_err(|e| PortPurgeError::Unknown(e.to_string()))?
}

/// Scans active TCP/UDP ports using `lsof -i -P -n` on Unix systems and parses the process mapping.
pub(crate) fn parse_lsof_line(line: &str) -> Option<PortInfo> {
    let line = line.trim();
    if line.is_empty() || line.starts_with("COMMAND") {
        return None;
    }

    let mut parts = line.split_whitespace();
    let process_name = parts.next()?.to_string();
    let pid = parts.next()?.parse::<u32>().ok()?;
    let _user = parts.next()?;
    let _fd = parts.next()?;
    let _type_field = parts.next()?;
    let _device = parts.next()?;
    let _size = parts.next()?;
    let protocol = Protocol::parse_known(parts.next()?)?;
    let name_col = parts.next()?;

    if matches!(protocol, Protocol::Tcp) && !name_col.contains("(LISTEN)") {
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
        protocol,
        pid,
        process_name,
    })
}

/// Scans active TCP/UDP ports using `lsof -i -P -n` on Unix systems and parses the process mapping.
pub async fn get_active_ports() -> Result<Vec<PortInfo>, PortPurgeError> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut ports = Vec::new();
        let mut cmd = Command::new("lsof");
        cmd.args(&["-i", "-P", "-n"]);

        let output = cmd
            .output()
            .map_err(|e| PortPurgeError::CommandError(e.to_string()))?;
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

        Ok(dedupe_and_sort_ports(ports))
    })
    .await
    .map_err(|e| PortPurgeError::Unknown(e.to_string()))?
}

/// Terminates a process on Unix using `kill -9 <pid>`.
pub async fn kill_process_by_pid(pid: u32) -> Result<(), PortPurgeError> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new("kill");
        cmd.args(&["-9", &pid.to_string()]);

        let output = cmd
            .output()
            .map_err(|e| PortPurgeError::CommandError(e.to_string()))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let error_msg = stderr.to_string();

            if error_msg.contains("Operation not permitted")
                || error_msg.contains("Permission denied")
            {
                return Err(PortPurgeError::AccessDenied);
            } else if error_msg.contains("No such process") {
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
    use super::parse_lsof_exe_output;
    use super::parse_lsof_line;
    use super::parse_ps_details_line;
    use super::Protocol;

    #[test]
    fn parse_ps_details_line_simple_command() {
        let parsed = parse_ps_details_line(
            "1234 chamidu 12345 Mon Jun 23 10:30:00 2024 /usr/bin/node server.js",
        )
        .unwrap();
        assert_eq!(parsed.pid, 1234);
        assert_eq!(parsed.user, "chamidu");
        assert_eq!(parsed.memory_bytes, 12_345 * 1024);
        assert_eq!(parsed.started_at, "Mon Jun 23 10:30:00 2024");
        assert_eq!(parsed.command_line, "/usr/bin/node server.js");
        assert_eq!(parsed.process_name, "node");
    }

    #[test]
    fn parse_ps_details_line_rejects_too_few_fields() {
        assert!(parse_ps_details_line("1234 chamidu 12345").is_none());
    }

    #[test]
    fn parse_lsof_exe_output_extracts_path() {
        let output = "p1234\nftxt\nn/usr/bin/node\n";
        assert_eq!(
            parse_lsof_exe_output(output).as_deref(),
            Some("/usr/bin/node")
        );
    }

    #[test]
    fn parse_lsof_exe_output_returns_none_when_missing() {
        assert!(parse_lsof_exe_output("p1234\n").is_none());
    }

    #[test]
    fn parse_lsof_line_tcp_ipv4_localhost() {
        let parsed = parse_lsof_line(
            "node    1234 chamidu   21u  IPv4 0xdeadbeef      0t0  TCP 127.0.0.1:3000 (LISTEN)",
        )
        .unwrap();
        assert_eq!(parsed.port, 3000);
        assert_eq!(parsed.protocol, Protocol::Tcp);
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
        assert_eq!(parsed.protocol, Protocol::Udp);
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
        assert!(
            parse_lsof_line("COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME").is_none()
        );
    }
}
