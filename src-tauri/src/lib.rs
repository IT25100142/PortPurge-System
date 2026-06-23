mod ledger;
mod sys;
mod tray;

use ledger::{clear_ledger_entries, get_ledger_entries, KillContext, KillSource};
use serde::Deserialize;
use sys::{PortInfo, ProcessDetails, Protocol};
use tauri::{AppHandle, Manager};
#[tauri::command]
async fn get_active_ports() -> Result<Vec<PortInfo>, String> {
    sys::get_active_ports().await.map_err(|e| e.to_string())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct KillProcessArgs {
    pid: u32,
    port: Option<u16>,
    protocol: Option<Protocol>,
    process_name: Option<String>,
    source: Option<KillSource>,
}

#[tauri::command]
async fn kill_process_by_pid(app: AppHandle, args: KillProcessArgs) -> Result<(), String> {
    let ctx = KillContext {
        pid: args.pid,
        port: args.port,
        protocol: args.protocol,
        process_name: args
            .process_name
            .filter(|name| !name.trim().is_empty())
            .unwrap_or_else(|| "Unknown".to_string()),
        source: args.source.unwrap_or(KillSource::Ui),
    };

    ledger::kill_and_record(&app, ctx)
        .await
        .map_err(|err| err.to_string())
}
#[tauri::command]
async fn get_process_details(pid: u32) -> Result<ProcessDetails, String> {
    sys::get_process_details(pid)
        .await
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            ledger::init(app)?;
            tray::init(app)
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_active_ports,
            kill_process_by_pid,
            get_process_details,
            get_ledger_entries,
            clear_ledger_entries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_active_ports() {
        tauri::async_runtime::block_on(async {
            let ports = sys::get_active_ports().await;
            assert!(ports.is_ok());
            let ports = ports.unwrap();
            println!("\nFound {} active ports:", ports.len());
            for port in &ports[..std::cmp::min(15, ports.len())] {
                println!(
                    "  Port: {}, Protocol: {}, PID: {}, Process: {}",
                    port.port, port.protocol, port.pid, port.process_name
                );
            }
        });
    }
}
