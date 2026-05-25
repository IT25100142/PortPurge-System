use super::{PortInfo, PortPurgeError};
use std::collections::HashMap;
use std::process::Command;
use std::os::windows::process::CommandExt;

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
            
            // Clean outer double quotes and split by ","
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
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        // Split by whitespace
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let proto = parts[0];
        if proto != "TCP" && proto != "UDP" {
            continue;
        }

        // Parse local address
        if parts.len() < 2 {
            continue;
        }
        let local_addr = parts[1];

        // Parse port from local address (e.g. 127.0.0.1:8080 or [::1]:8080)
        let port = match local_addr.rfind(':') {
            Some(pos) => {
                match local_addr[pos + 1..].parse::<u16>() {
                    Ok(p) => p,
                    Err(_) => continue,
                }
            }
            None => continue,
        };

        // Parse PID and state
        let pid = if proto == "TCP" {
            // TCP lines: Proto Local Foreign State PID
            if parts.len() < 5 {
                continue;
            }
            let state = parts[3];
            if state != "LISTENING" {
                continue;
            }
            match parts[4].parse::<u32>() {
                Ok(p) => p,
                Err(_) => continue,
            }
        } else {
            // UDP lines: Proto Local Foreign PID (no State)
            if parts.len() < 4 {
                continue;
            }
            match parts[3].parse::<u32>() {
                Ok(p) => p,
                Err(_) => continue,
            }
        };

        // Skip System Idle Process (PID 0)
        if pid == 0 {
            continue;
        }

        // Resolve process name
        let process_name = process_map.get(&pid).cloned().unwrap_or_else(|| "Unknown".to_string());

        ports.push(PortInfo {
            port,
            protocol: proto.to_string(),
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
                // If existing has an unknown/empty name but the new one has a valid name, update it
                if (existing.process_name == "Unknown" || existing.process_name.is_empty()) && p.process_name != "Unknown" {
                    *existing = p.clone();
                }
            })
            .or_insert(p);
    }
    
    let mut result: Vec<PortInfo> = unique_ports.into_values().collect();
    // Sort by port number ascending
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
