use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{App, Manager, State};

const CONFIG_FILENAME: &str = "config.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(default = "default_protected_names")]
    pub protected_process_names: Vec<String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            protected_process_names: default_protected_names(),
        }
    }
}

pub struct ConfigState {
    config: Mutex<AppConfig>,
    _path: PathBuf,
}

/// Trim, lowercase, and strip a trailing `.exe` for cross-platform name matching.
pub fn normalize_process_name(name: &str) -> String {
    let trimmed = name.trim().to_lowercase();
    trimmed.strip_suffix(".exe").unwrap_or(&trimmed).to_string()
}

fn default_protected_names() -> Vec<String> {
    #[cfg(target_os = "windows")]
    {
        vec![
            "System".into(),
            "smss.exe".into(),
            "csrss.exe".into(),
            "wininit.exe".into(),
            "services.exe".into(),
            "lsass.exe".into(),
            "svchost.exe".into(),
            "explorer.exe".into(),
        ]
    }

    #[cfg(target_os = "macos")]
    {
        vec![
            "launchd".into(),
            "kernel_task".into(),
            "WindowServer".into(),
            "loginwindow".into(),
            "syspolicyd".into(),
        ]
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        vec!["systemd".into(), "systemd-journal".into(), "sshd".into()]
    }
}

fn load_config_from_disk(path: &PathBuf) -> AppConfig {
    if !path.exists() {
        return AppConfig::default();
    }

    match fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(config) => config,
            Err(err) => {
                eprintln!("Warning: config file is corrupt or invalid, using defaults: {err}");
                AppConfig::default()
            }
        },
        Err(err) => {
            eprintln!("Warning: failed to read config file, using defaults: {err}");
            AppConfig::default()
        }
    }
}

fn write_config_to_disk(
    path: &PathBuf,
    config: &AppConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(config)?;
    fs::write(&tmp_path, &json)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn init(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let path = app_data_dir.join(CONFIG_FILENAME);
    let seeded = !path.exists();
    let mut config = load_config_from_disk(&path);

    if seeded {
        write_config_to_disk(&path, &config)?;
    } else if config.protected_process_names.is_empty() {
        config.protected_process_names = default_protected_names();
        write_config_to_disk(&path, &config)?;
    }

    app.manage(ConfigState {
        config: Mutex::new(config),
        _path: path,
    });

    Ok(())
}

impl ConfigState {
    pub fn is_protected(&self, process_name: &str) -> bool {
        let normalized = normalize_process_name(process_name);
        if normalized.is_empty() || normalized == "unknown" {
            return false;
        }

        let Ok(config) = self.config.lock() else {
            eprintln!("Failed to lock config state");
            return false;
        };

        config
            .protected_process_names
            .iter()
            .any(|entry| normalize_process_name(entry) == normalized)
    }
}

#[tauri::command]
pub fn get_protected_process_names(state: State<'_, ConfigState>) -> Result<Vec<String>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.protected_process_names.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_process_name_trims_lowercases_and_strips_exe() {
        assert_eq!(normalize_process_name("  Node.EXE  "), "node");
        assert_eq!(normalize_process_name("explorer.exe"), "explorer");
        assert_eq!(normalize_process_name("launchd"), "launchd");
    }

    #[test]
    fn normalize_process_name_handles_empty_and_unknown() {
        assert_eq!(normalize_process_name(""), "");
        assert_eq!(normalize_process_name("   "), "");
        assert_eq!(normalize_process_name("Unknown"), "unknown");
    }

    #[test]
    fn is_protected_matches_normalized_names() {
        let state = ConfigState {
            config: Mutex::new(AppConfig {
                protected_process_names: vec!["svchost.exe".into(), "explorer".into()],
            }),
            _path: PathBuf::from("config.json"),
        };

        assert!(state.is_protected("SVCHOST.EXE"));
        assert!(state.is_protected("explorer.exe"));
        assert!(!state.is_protected("node.exe"));
    }

    #[test]
    fn is_protected_never_matches_unknown_or_empty() {
        let state = ConfigState {
            config: Mutex::new(AppConfig {
                protected_process_names: vec!["unknown".into(), "explorer.exe".into()],
            }),
            _path: PathBuf::from("config.json"),
        };

        assert!(!state.is_protected("Unknown"));
        assert!(!state.is_protected(""));
        assert!(!state.is_protected("   "));
    }

    #[test]
    fn default_protected_names_are_non_empty() {
        let names = default_protected_names();
        assert!(!names.is_empty());
        for name in names {
            assert!(!name.trim().is_empty());
        }
    }
}
