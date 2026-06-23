mod config;
mod ledger;
mod sys;
mod tray;

use config::get_protected_process_names;
use ledger::{clear_ledger_entries, get_ledger_entries, kill_and_record, KillContext, KillSource};
use sys::{PortInfo, ProcessDetails};
use tauri::Manager;

#[tauri::command]
async fn get_active_ports() -> Result<Vec<PortInfo>, String> {
    sys::get_active_ports().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_process_by_pid(
    app: tauri::AppHandle,
    pid: u32,
    port: u16,
    protocol: String,
    process_name: String,
    source: KillSource,
) -> Result<(), String> {
    kill_and_record(
        &app,
        KillContext {
            pid,
            port,
            protocol,
            process_name,
            source,
        },
    )
    .await
    .map_err(|e| e.to_string())
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
            config::init(app)?;
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
            clear_ledger_entries,
            get_protected_process_names
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
