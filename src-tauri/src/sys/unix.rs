use super::{PortInfo, PortPurgeError};
use std::collections::HashMap;
use std::process::Command;

/// Scans active TCP/UDP ports using `lsof -i -P -n` on Unix systems and parses the process mapping.
pub async fn get_active_ports() -> Result<Vec<PortInfo>, PortPurgeError> {
    let mut ports = Vec::new();
    let mut cmd = Command::new("lsof");
    cmd.args(&["-i", "-P", "-n"]);

    let output = cmd.output().map_err(|e| PortPurgeError::CommandError(e.to_string()))?;
    if !output.status.success() {
        // Note: lsof returns exit status 1 if no matches are found, which is a normal state.
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        if stdout_str.trim().is_empty() {
            return Ok(vec![]);
        }
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(PortPurgeError::CommandError(stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("COMMAND") {
            continue;
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let process_name = parts[0].to_string();
        
        let pid = match parts[1].parse::<u32>() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let protocol = parts[7]; // TCP or UDP
        if protocol != "TCP" && protocol != "UDP" {
            continue;
        }

        let name_col = parts[8]; // e.g. *:8080 or *:8080 (LISTEN)
        
        // For TCP, filter only listening sockets
        if protocol == "TCP" && !name_col.contains("(LISTEN)") {
            continue;
        }

        // Extract address portion
        let addr_port = name_col.split_whitespace().next().unwrap_or(name_col);
        
        // Find last colon for port parsing
        let port = match addr_port.rfind(':') {
            Some(pos) => {
                match addr_port[pos + 1..].parse::<u16>() {
                    Ok(p) => p,
                    Err(_) => continue,
                }
            }
            None => continue,
        };

        ports.push(PortInfo {
            port,
            protocol: protocol.to_string(),
            pid,
            process_name,
        });
    }

    // Deduplicate: Group by port + protocol, prioritizing non-empty/non-unknown process names
    let mut unique_ports = HashMap::new();
    for p in ports {
        let key = (p.port, p.protocol.clone());
        unique_ports.entry(key)
            .and_modify(|existing: &mut PortInfo| {
                if (existing.process_name == "Unknown" || existing.process_name.is_empty()) && p.process_name != "Unknown" {
                    *existing = p.clone();
                }
            })
            .or_insert(p);
    }

    let mut result: Vec<PortInfo> = unique_ports.into_values().collect();
    // Sort by port ascending
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
