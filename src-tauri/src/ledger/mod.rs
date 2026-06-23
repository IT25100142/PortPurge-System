use crate::sys::{self, PortPurgeError, Protocol};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{App, AppHandle, Emitter, Manager, State};
pub const MAX_LEDGER_ENTRIES: usize = 100;

/// Origin of a kill action recorded in the Purge Ledger.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum KillSource {
    Ui,
    Tray,
    Group,
    Inspect,
}

/// Metadata captured at kill time for the Purge Ledger.
#[derive(Debug, Clone)]
pub struct KillContext {
    pub pid: u32,
    pub port: Option<u16>,
    pub protocol: Option<Protocol>,
    pub process_name: String,
    pub source: KillSource,
}

/// A single persisted kill attempt in the Purge Ledger.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
    pub id: String,
    pub timestamp: String,
    pub pid: u32,
    pub port: Option<u16>,
    pub protocol: Option<Protocol>,
    pub process_name: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub source: KillSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LedgerFile {
    version: u32,
    entries: Vec<LedgerEntry>,
}

/// Managed in-memory ledger backed by a JSON file in the app data directory.
pub struct LedgerState {
    file_path: PathBuf,
    entries: Mutex<Vec<LedgerEntry>>,
}

/// Initializes ledger state from disk (or empty if missing/corrupt) and registers it with Tauri.
pub fn init(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&data_dir)?;

    let file_path = data_dir.join("purge-ledger.json");
    let entries = load_from_disk(&file_path);

    app.manage(LedgerState {
        file_path,
        entries: Mutex::new(entries),
    });

    Ok(())
}

/// Prepends an entry (newest first), truncates to [`MAX_LEDGER_ENTRIES`], and persists to disk.
pub fn append(app: &AppHandle, entry: LedgerEntry) -> Result<(), String> {
    let state = app.state::<LedgerState>();
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "ledger mutex poisoned".to_string())?;

    entries.insert(0, entry);
    entries.truncate(MAX_LEDGER_ENTRIES);
    persist(&state.file_path, &entries)
}

/// Executes a kill, records the outcome in the ledger, and emits `ledger-updated` to the frontend.
pub async fn kill_and_record(app: &AppHandle, ctx: KillContext) -> Result<(), PortPurgeError> {
    let now = SystemTime::now();
    let kill_result = sys::kill_process_by_pid(ctx.pid).await;
    let entry = ledger_entry_from_kill(&ctx, now, &kill_result);

    if let Err(err) = append(app, entry.clone()) {
        eprintln!("Ledger: failed to persist entry: {err}");
    } else if let Err(err) = app.emit("ledger-updated", &entry) {
        eprintln!("Ledger: failed to emit ledger-updated: {err}");
    }

    kill_result
}

#[tauri::command]
pub fn get_ledger_entries(state: State<'_, LedgerState>) -> Result<Vec<LedgerEntry>, String> {
    let entries = state
        .entries
        .lock()
        .map_err(|_| "ledger mutex poisoned".to_string())?;
    Ok(entries.clone())
}

#[tauri::command]
pub fn clear_ledger_entries(state: State<'_, LedgerState>) -> Result<(), String> {
    let mut entries = state
        .entries
        .lock()
        .map_err(|_| "ledger mutex poisoned".to_string())?;
    entries.clear();
    persist(&state.file_path, &entries)
}

fn ledger_entry_from_kill(
    ctx: &KillContext,
    now: SystemTime,
    kill_result: &Result<(), PortPurgeError>,
) -> LedgerEntry {
    let millis = now
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);

    let (success, error_message) = match kill_result {
        Ok(()) => (true, None),
        Err(err) => (false, Some(err.to_string())),
    };

    LedgerEntry {
        id: format!("{millis}-{}", ctx.pid),
        timestamp: format_utc_timestamp(now),
        pid: ctx.pid,
        port: ctx.port,
        protocol: ctx.protocol.clone(),
        process_name: ctx.process_name.clone(),
        success,
        error_message,
        source: ctx.source,
    }
}

fn format_utc_timestamp(time: SystemTime) -> String {
    let secs = time
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    let days = (secs / 86_400) as i64;
    let sod = secs % 86_400;
    let (year, month, day) = civil_from_days(days);

    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        sod / 3600,
        (sod % 3600) / 60,
        sod % 60
    )
}

/// Converts days since the Unix epoch to a civil (Y, M, D) date (UTC).
fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u32;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let mut year = yoe as i32 + (era * 400) as i32;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    if mp >= 10 {
        year += 1;
    }
    (year, month, day)
}

fn load_from_disk(path: &Path) -> Vec<LedgerEntry> {
    let contents = match std::fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(err) => {
            eprintln!(
                "Ledger: failed to read {} — starting empty: {err}",
                path.display()
            );
            return Vec::new();
        }
    };

    match serde_json::from_str::<LedgerFile>(&contents) {
        Ok(file) => {
            let mut entries = file.entries;
            entries.truncate(MAX_LEDGER_ENTRIES);
            entries
        }
        Err(err) => {
            eprintln!(
                "Ledger: corrupt file at {} — starting empty: {err}",
                path.display()
            );
            Vec::new()
        }
    }
}

fn persist(path: &Path, entries: &[LedgerEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }

    let file = LedgerFile {
        version: 1,
        entries: entries.to_vec(),
    };
    let json = serde_json::to_string_pretty(&file).map_err(|err| err.to_string())?;

    let tmp_path = path.with_extension("json.tmp");
    std::fs::write(&tmp_path, json).map_err(|err| err.to_string())?;
    std::fs::rename(&tmp_path, path).map_err(|err| err.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static TEST_SEQ: AtomicU32 = AtomicU32::new(0);

    fn sample_entry(id_suffix: &str) -> LedgerEntry {
        LedgerEntry {
            id: id_suffix.to_string(),
            timestamp: "2026-01-01T00:00:00Z".to_string(),
            pid: 1234,
            port: Some(8080),
            protocol: Some(Protocol::Tcp),
            process_name: "node".to_string(),
            success: true,
            error_message: None,
            source: KillSource::Ui,
        }
    }

    fn unique_temp_path(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before epoch")
            .as_nanos();
        let seq = TEST_SEQ.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("portpurge-ledger-{label}-{nanos}-{seq}.json"))
    }

    #[test]
    fn load_missing_file_returns_empty() {
        let path = unique_temp_path("missing");
        assert!(load_from_disk(&path).is_empty());
    }

    #[test]
    fn load_corrupt_file_returns_empty() {
        let path = unique_temp_path("corrupt");
        std::fs::write(&path, "{ not valid json").expect("write corrupt file");
        assert!(load_from_disk(&path).is_empty());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn persist_and_load_round_trip() {
        let path = unique_temp_path("roundtrip");
        let entries = vec![sample_entry("entry-1")];

        persist(&path, &entries).expect("persist");
        let loaded = load_from_disk(&path);
        assert_eq!(loaded, entries);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn persist_truncates_to_max_entries_on_load() {
        let path = unique_temp_path("truncate");
        let entries: Vec<LedgerEntry> = (0..MAX_LEDGER_ENTRIES + 5)
            .map(|index| sample_entry(&format!("entry-{index}")))
            .collect();

        persist(&path, &entries).expect("persist");
        let loaded = load_from_disk(&path);
        assert_eq!(loaded.len(), MAX_LEDGER_ENTRIES);

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn ledger_entry_serde_uses_camel_case() {
        let entry = sample_entry("serde-test");
        let json = serde_json::to_string(&entry).expect("serialize");
        assert!(json.contains("\"processName\":\"node\""));
        assert!(json.contains("\"errorMessage\":null"));
        assert!(json.contains("\"source\":\"ui\""));
    }

    #[test]
    fn format_utc_timestamp_uses_iso8601_z_suffix() {
        let timestamp = format_utc_timestamp(UNIX_EPOCH);
        assert_eq!(timestamp, "1970-01-01T00:00:00Z");
    }

    #[test]
    fn ledger_entry_from_kill_records_failure() {
        let ctx = KillContext {
            pid: 99,
            port: Some(3000),
            protocol: Some(Protocol::Tcp),
            process_name: "node".to_string(),
            source: KillSource::Tray,
        };
        let entry = ledger_entry_from_kill(&ctx, UNIX_EPOCH, &Err(PortPurgeError::AccessDenied));
        assert!(!entry.success);
        assert_eq!(
            entry.error_message.as_deref(),
            Some("Access Denied. Try running with admin/sudo privileges.")
        );
        assert_eq!(entry.id, "0-99");
        assert_eq!(entry.source, KillSource::Tray);
    }
}
