use tauri::{App, AppHandle, Emitter, Manager};

pub struct SummonOptions {
    pub emit_focus_event: bool,
}

/// Show, unminimize, and focus the main window. Optionally emit `window-summoned` for search focus.
pub fn summon_main_window(app: &AppHandle, opts: SummonOptions) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();

    if opts.emit_focus_event {
        if let Err(err) = app.emit("window-summoned", ()) {
            eprintln!("Failed to emit window-summoned event: {err}");
        }
    }
}

/// Register the OS-wide Summon shortcut (`Alt+Shift+P` / `Option+Shift+P` on macOS).
#[cfg(desktop)]
pub fn init_global_shortcut(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::ShortcutState;

    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_shortcuts(["Alt+Shift+P"])?
            .with_handler(|app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    summon_main_window(
                        app,
                        SummonOptions {
                            emit_focus_event: true,
                        },
                    );
                }
            })
            .build(),
    )?;

    Ok(())
}

#[cfg(not(desktop))]
pub fn init_global_shortcut(_app: &App) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
