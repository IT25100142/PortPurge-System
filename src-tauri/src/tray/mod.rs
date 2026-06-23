use crate::ledger::{self, KillContext, KillSource};
use crate::sys::{self, PortInfo, PortPurgeError, Protocol};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

const POLL_INTERVAL_SECS: u64 = 3;
const TOP_PORT_SLOTS: usize = 5;
const MAX_PROCESS_NAME_LEN: usize = 20;
const AMBER_THRESHOLD: usize = 10;
const RED_THRESHOLD: usize = 20;

/// Visual tray icon state driven by active localhost port count.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TrayIconState {
    Normal,
    Amber,
    Red,
}

struct TrayTracking {
    slots: [Option<PortSlot>; TOP_PORT_SLOTS],
    first_seen: HashMap<(u16, Protocol), Instant>,
    icon_state: TrayIconState,
}

impl TrayTracking {
    fn new() -> Self {
        Self {
            slots: std::array::from_fn(|_| None),
            first_seen: HashMap::new(),
            icon_state: TrayIconState::Normal,
        }
    }
}

/// Managed application state holding the system tray icon and port tracking data.
pub struct TrayState {
    pub tray: TrayIcon,
    port_items: [MenuItem<tauri::Wry>; TOP_PORT_SLOTS],
    tracking: Mutex<TrayTracking>,
}

/// A port entry bound to a tray menu kill slot.
#[derive(Debug, Clone, PartialEq, Eq)]
struct PortSlot {
    pid: u32,
    port: u16,
    process_name: String,
    protocol: Protocol,
}

fn icon_state_for_port_count(count: usize) -> TrayIconState {
    if count >= RED_THRESHOLD {
        TrayIconState::Red
    } else if count >= AMBER_THRESHOLD {
        TrayIconState::Amber
    } else {
        TrayIconState::Normal
    }
}

fn icon_for_state(state: TrayIconState) -> Image<'static> {
    let bytes = match state {
        TrayIconState::Normal => include_bytes!("../../icons/tray-normal.png"),
        TrayIconState::Amber => include_bytes!("../../icons/tray-amber.png"),
        TrayIconState::Red => include_bytes!("../../icons/tray-red.png"),
    };
    Image::from_bytes(bytes).expect("failed to load tray state icon")
}

fn port_key(port: &PortInfo) -> (u16, Protocol) {
    (port.port, port.protocol.clone())
}

fn update_first_seen(
    first_seen: &mut HashMap<(u16, Protocol), Instant>,
    ports: &[PortInfo],
    now: Instant,
) {
    let current_keys: HashSet<_> = ports.iter().map(port_key).collect();
    first_seen.retain(|key, _| current_keys.contains(key));
    for port in ports {
        first_seen.entry(port_key(port)).or_insert(now);
    }
}

fn select_top_recent_ports(
    ports: &[PortInfo],
    first_seen: &HashMap<(u16, Protocol), Instant>,
    limit: usize,
) -> Vec<PortInfo> {
    let mut sorted: Vec<PortInfo> = ports.to_vec();
    sorted.sort_by(|a, b| {
        let a_ts = first_seen
            .get(&port_key(a))
            .copied()
            .unwrap_or(Instant::now());
        let b_ts = first_seen
            .get(&port_key(b))
            .copied()
            .unwrap_or(Instant::now());
        b_ts.cmp(&a_ts)
    });
    sorted.truncate(limit);
    sorted
}

fn truncate_process_name(name: &str, max_len: usize) -> String {
    if name.chars().count() <= max_len {
        return name.to_string();
    }
    let truncated: String = name.chars().take(max_len.saturating_sub(1)).collect();
    format!("{truncated}…")
}

fn format_kill_label(port: &PortInfo) -> String {
    let name = truncate_process_name(&port.process_name, MAX_PROCESS_NAME_LEN);
    format!("Kill :{} — {} (PID {})", port.port, name, port.pid)
}

fn handle_tray_kill(app: &AppHandle, slot_index: usize) {
    if slot_index >= TOP_PORT_SLOTS {
        return;
    }

    let slot = {
        let state = app.state::<TrayState>();
        let tracking = match state.tracking.lock() {
            Ok(guard) => guard,
            Err(_) => {
                eprintln!("Tray kill failed: tracking state mutex poisoned");
                return;
            }
        };
        tracking.slots[slot_index].clone()
    };

    let Some(slot) = slot else {
        return;
    };

    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let ctx = KillContext {
            pid: slot.pid,
            port: Some(slot.port),
            protocol: Some(slot.protocol),
            process_name: slot.process_name,
            source: KillSource::Tray,
        };

        if let Err(err) = ledger::kill_and_record(&app, ctx).await {
            match err {
                PortPurgeError::AccessDenied => {
                    eprintln!(
                        "Tray kill denied for PID {}: run PortPurge with admin/sudo privileges",
                        slot.pid
                    );
                }
                PortPurgeError::ProcessNotFound => {
                    eprintln!(
                        "Tray kill skipped for PID {}: process already exited",
                        slot.pid
                    );
                }
                other => {
                    eprintln!("Tray kill failed for PID {}: {other}", slot.pid);
                }
            }
        }
    });
}

async fn refresh_tray_ports(app: &AppHandle) -> Result<(), String> {
    let ports = sys::get_active_ports()
        .await
        .map_err(|err| err.to_string())?;
    let now = Instant::now();
    let new_icon_state = icon_state_for_port_count(ports.len());

    let (top_ports, icon_state_changed) = {
        let state = app.state::<TrayState>();
        let mut tracking = state
            .tracking
            .lock()
            .map_err(|_| "tray tracking mutex poisoned".to_string())?;

        update_first_seen(&mut tracking.first_seen, &ports, now);
        let top_ports = select_top_recent_ports(&ports, &tracking.first_seen, TOP_PORT_SLOTS);

        tracking.slots = std::array::from_fn(|_| None);
        for (index, port) in top_ports.iter().enumerate() {
            tracking.slots[index] = Some(PortSlot {
                pid: port.pid,
                port: port.port,
                process_name: port.process_name.clone(),
                protocol: port.protocol.clone(),
            });
        }

        let icon_state_changed = tracking.icon_state != new_icon_state;
        if icon_state_changed {
            tracking.icon_state = new_icon_state;
        }

        (top_ports, icon_state_changed)
    };

    if icon_state_changed {
        let state = app.state::<TrayState>();
        if let Err(err) = state.tray.set_icon(Some(icon_for_state(new_icon_state))) {
            eprintln!("Tray icon update failed: {err}");
        }
    }

    let state = app.state::<TrayState>();
    for index in 0..TOP_PORT_SLOTS {
        if let Some(port) = top_ports.get(index) {
            let _ = state.port_items[index].set_text(format_kill_label(port));
            let _ = state.port_items[index].set_enabled(true);
        } else {
            let _ = state.port_items[index].set_text("—");
            let _ = state.port_items[index].set_enabled(false);
        }
    }

    Ok(())
}

fn spawn_poll_loop(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Err(err) = refresh_tray_ports(&app_handle).await {
                eprintln!("Tray port refresh failed: {err}");
            }

            let _ = tauri::async_runtime::spawn_blocking(|| {
                std::thread::sleep(Duration::from_secs(POLL_INTERVAL_SECS));
            })
            .await;
        }
    });
}

fn handle_menu_event(app: &AppHandle, menu_id: &str) {
    if let Some(index_str) = menu_id.strip_prefix("tray_kill_") {
        if let Ok(index) = index_str.parse::<usize>() {
            handle_tray_kill(app, index);
        }
        return;
    }

    match menu_id {
        "quit" => {
            app.exit(0);
        }
        "show" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

/// Initializes the system tray icon, menu, and event handlers.
pub fn init(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let kill_items = [
        MenuItem::with_id(app, "tray_kill_0", "—", false, None::<&str>)?,
        MenuItem::with_id(app, "tray_kill_1", "—", false, None::<&str>)?,
        MenuItem::with_id(app, "tray_kill_2", "—", false, None::<&str>)?,
        MenuItem::with_id(app, "tray_kill_3", "—", false, None::<&str>)?,
        MenuItem::with_id(app, "tray_kill_4", "—", false, None::<&str>)?,
    ];

    let separator = PredefinedMenuItem::separator(app)?;
    let show_i = MenuItem::with_id(app, "show", "Show PortPurge", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit PortPurge", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &kill_items[0],
            &kill_items[1],
            &kill_items[2],
            &kill_items[3],
            &kill_items[4],
            &separator,
            &show_i,
            &quit_i,
        ],
    )?;

    let icon = icon_for_state(TrayIconState::Normal);

    let tray = TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("PortPurge")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| handle_menu_event(app, event.id.as_ref()))
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: tauri::tray::MouseButton::Left,
                button_state: tauri::tray::MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    app.manage(TrayState {
        tray,
        port_items: kill_items,
        tracking: Mutex::new(TrayTracking::new()),
    });

    spawn_poll_loop(app.handle().clone());

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_port(port: u16, pid: u32, name: &str) -> PortInfo {
        PortInfo {
            port,
            protocol: Protocol::Tcp,
            pid,
            process_name: name.to_string(),
        }
    }

    #[test]
    fn update_first_seen_prunes_disappeared_ports() {
        let mut first_seen = HashMap::new();
        let t0 = Instant::now();
        let ports = vec![sample_port(3000, 1, "node")];
        update_first_seen(&mut first_seen, &ports, t0);
        assert_eq!(first_seen.len(), 1);

        update_first_seen(&mut first_seen, &[], t0);
        assert!(first_seen.is_empty());
    }

    #[test]
    fn update_first_seen_preserves_original_timestamp_for_existing_port() {
        let mut first_seen = HashMap::new();
        let t0 = Instant::now();
        let t1 = t0 + Duration::from_secs(5);
        let ports = vec![sample_port(3000, 1, "node")];

        update_first_seen(&mut first_seen, &ports, t0);
        update_first_seen(&mut first_seen, &ports, t1);

        assert_eq!(first_seen.get(&(3000, Protocol::Tcp)), Some(&t0));
    }

    #[test]
    fn select_top_recent_ports_orders_newest_first() {
        let mut first_seen = HashMap::new();
        let t0 = Instant::now();
        let t1 = t0 + Duration::from_secs(1);
        let t2 = t0 + Duration::from_secs(2);

        first_seen.insert((3000, Protocol::Tcp), t0);
        first_seen.insert((4000, Protocol::Tcp), t1);
        first_seen.insert((5000, Protocol::Tcp), t2);

        let ports = vec![
            sample_port(3000, 1, "old"),
            sample_port(4000, 2, "mid"),
            sample_port(5000, 3, "new"),
        ];

        let top = select_top_recent_ports(&ports, &first_seen, 2);
        assert_eq!(top.len(), 2);
        assert_eq!(top[0].port, 5000);
        assert_eq!(top[1].port, 4000);
    }

    #[test]
    fn icon_state_for_port_count_uses_thresholds() {
        assert_eq!(icon_state_for_port_count(0), TrayIconState::Normal);
        assert_eq!(icon_state_for_port_count(9), TrayIconState::Normal);
        assert_eq!(icon_state_for_port_count(10), TrayIconState::Amber);
        assert_eq!(icon_state_for_port_count(19), TrayIconState::Amber);
        assert_eq!(icon_state_for_port_count(20), TrayIconState::Red);
        assert_eq!(icon_state_for_port_count(100), TrayIconState::Red);
    }

    #[test]
    fn format_kill_label_truncates_long_process_names() {
        let port = sample_port(8080, 42, "very-long-process-name-example");
        let label = format_kill_label(&port);
        assert!(label.starts_with("Kill :8080 — "));
        assert!(label.contains("(PID 42)"));
        assert!(label.len() < 60);
    }
}
