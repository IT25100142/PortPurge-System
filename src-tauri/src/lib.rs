mod sys;

use sys::PortInfo;
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

#[tauri::command]
async fn get_active_ports() -> Result<Vec<PortInfo>, String> {
    sys::get_active_ports().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn kill_process_by_pid(pid: u32) -> Result<(), String> {
    sys::kill_process_by_pid(pid).await.map_err(|e| e.to_string())
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
            // Setup System Tray Menu Items
            let show_i = MenuItem::with_id(app, "show", "Show PortPurge", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Retrieve default window icon
            let icon = app.default_window_icon().cloned().expect("failed to get default window icon");
            
            // Build the System Tray
            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_active_ports,
            kill_process_by_pid
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
                println!("  Port: {}, Protocol: {}, PID: {}, Process: {}", port.port, port.protocol, port.pid, port.process_name);
            }
        });
    }
}
