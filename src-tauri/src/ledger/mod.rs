use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{App, AppHandle, Emitter, Manager, State};

const MAX_LEDGER_ENTRIES: usize = 100;
const LEDGER_FILENAME: &str = "purge-ledger.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum KillSource {
    Ui,
    Tray,
    Group,
    Inspect,
}

#[derive(Debug, Clone)]
pub struct KillContext {
    pub pid: u32,
    pub port: u16,
    pub protocol: String,
    pub process_name: String,
    pub source: KillSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
    pub id: String,
    pub timestamp: String,
    pub pid: u32,
    pub port: u16,
    pub protocol: String,
    pub process_name: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub source: KillSource,
}

pub struct LedgerState {
    pub entries: Mutex<Vec<LedgerEntry>>,
    path: PathBuf,
}

fn unix_days_to_ymd(mut days: u64) -> (u32, u32, u32) {
    days += 719_468;
    let era = days / 146_097;
    let doe = days % 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era as i64 * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let m = (5 * doy + 2) / 153;
    let d = doy - (153 * m + 2) / 5;
    let month = if m < 10 { m + 3 } else { m - 9 };
    let year = if month <= 2 { y + 1 } else { y };
    (year as u32, month as u32, d as u32 + 1)
}

fn format_utc_rfc3339(unix_secs: u64) -> String {
    let (year, month, day) = unix_days_to_ymd(unix_secs / 86_400);
    let time_of_day = unix_secs % 86_400;
    let hours = time_of_day / 3600;
    let minutes = (time_of_day % 3600) / 60;
    let seconds = time_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hours:02}:{minutes:02}:{seconds:02}Z")
}

fn record_kill_outcome(
    app: &AppHandle,
    ctx: KillContext,
    unix_secs: u64,
    result: &Result<(), crate::sys::PortPurgeError>,
) -> Result<(), crate::sys::PortPurgeError> {
    let (success, error_message) = match result {
        Ok(()) => (true, None),
        Err(err) => (false, Some(err.to_string())),
    };

    let entry = LedgerEntry {
        id: format!("{unix_secs}-{}", ctx.pid),
        timestamp: format_utc_rfc3339(unix_secs),
        pid: ctx.pid,
        port: ctx.port,
        protocol: ctx.protocol,
        process_name: ctx.process_name,
        success,
        error_message,
        source: ctx.source,
    };

    append(app, entry.clone());

    if let Err(err) = app.emit("ledger-updated", &entry) {
        eprintln!("Failed to emit ledger-updated event: {err}");
    }

    result.clone()
}

pub async fn kill_and_record(
    app: &AppHandle,
    ctx: KillContext,
) -> Result<(), crate::sys::PortPurgeError> {
    let now = SystemTime::now();
    let unix_secs = now
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    let config = app.state::<crate::config::ConfigState>();
    if config.is_protected(&ctx.process_name) {
        let err = crate::sys::PortPurgeError::ProtectedProcess(ctx.process_name.clone());
        let result = Err(err);
        return record_kill_outcome(app, ctx, unix_secs, &result);
    }

    let result = crate::sys::kill_process_by_pid(ctx.pid).await;
    record_kill_outcome(app, ctx, unix_secs, &result)
}

fn load_entries_from_disk(path: &PathBuf) -> Vec<LedgerEntry> {
    if !path.exists() {
        return Vec::new();
    }

    match fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str(&contents) {
            Ok(entries) => entries,
            Err(err) => {
                eprintln!(
                    "Warning: purge ledger file is corrupt or invalid, starting empty: {err}"
                );
                Vec::new()
            }
        },
        Err(err) => {
            eprintln!("Warning: failed to read purge ledger file, starting empty: {err}");
            Vec::new()
        }
    }
}

fn write_entries_to_disk(
    path: &PathBuf,
    entries: &[LedgerEntry],
) -> Result<(), Box<dyn std::error::Error>> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = path.with_extension("json.tmp");
    let json = serde_json::to_string_pretty(entries)?;
    fs::write(&tmp_path, &json)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

pub fn init(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let path = app_data_dir.join(LEDGER_FILENAME);
    let entries = load_entries_from_disk(&path);

    app.manage(LedgerState {
        entries: Mutex::new(entries),
        path,
    });

    Ok(())
}

pub fn append(app: &AppHandle, entry: LedgerEntry) {
    let state = app.state::<LedgerState>();
    let Ok(mut entries) = state.entries.lock() else {
        eprintln!("Failed to lock purge ledger state");
        return;
    };

    entries.insert(0, entry);
    entries.truncate(MAX_LEDGER_ENTRIES);

    if let Err(err) = write_entries_to_disk(&state.path, &entries) {
        eprintln!("Failed to persist purge ledger: {err}");
    }
}

#[tauri::command]
pub fn get_ledger_entries(state: State<'_, LedgerState>) -> Result<Vec<LedgerEntry>, String> {
    let entries = state.entries.lock().map_err(|e| e.to_string())?;
    Ok(entries.clone())
}

#[tauri::command]
pub fn clear_ledger_entries(state: State<'_, LedgerState>) -> Result<(), String> {
    let mut entries = state.entries.lock().map_err(|e| e.to_string())?;
    entries.clear();
    write_entries_to_disk(&state.path, &entries).map_err(|e| e.to_string())?;
    Ok(())
}
