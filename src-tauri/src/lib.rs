use tauri::{LogicalSize, LogicalPosition, Size, Position, Emitter};
use std::sync::atomic::{AtomicBool, Ordering};

static ISLAND_SHORTCUTS_ACTIVE: AtomicBool = AtomicBool::new(false);
static SHORTCUT_THREAD_ID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[tauri::command]
fn enter_island_mode(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_decorations(false).map_err(|e| e.to_string())?;
    let _ = window.set_shadow(false);
    window.set_size(Size::Logical(LogicalSize { width, height })).map_err(|e| e.to_string())?;

    if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_width = monitor.size().width as f64 / monitor.scale_factor();
        let x = (screen_width - width) / 2.0;
        let _ = window.set_position(Position::Logical(LogicalPosition { x, y: 15.0 }));
    }

    ISLAND_SHORTCUTS_ACTIVE.store(true, Ordering::SeqCst);
    let thread_id = SHORTCUT_THREAD_ID.fetch_add(1, Ordering::SeqCst) + 1;
    let win_clone = window.clone();
    std::thread::spawn(move || {
        let mut prev_c_combo = false;
        let mut prev_m_combo = false;
        let mut prev_g_combo = false;
        let mut prev_p_combo = false;
        let mut prev_s_combo = false;
        let mut prev_x_combo = false;
        let mut prev_d_combo = false;
        let mut prev_down_combo = false;
        let mut prev_up_combo = false;

        while ISLAND_SHORTCUTS_ACTIVE.load(Ordering::SeqCst)
            && SHORTCUT_THREAD_ID.load(Ordering::SeqCst) == thread_id
        {
            std::thread::sleep(std::time::Duration::from_millis(20));

            #[cfg(target_os = "windows")]
            unsafe {
                // VK_MENU = 0x12, VK_LMENU = 0xA4, VK_RMENU = 0xA5
                let alt_down = ((win32::GetAsyncKeyState(0x12) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA4) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA5) as u16 & 0x8000) != 0);

                let ctrl_down = ((win32::GetAsyncKeyState(0x11) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA2) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA3) as u16 & 0x8000) != 0);

                let shift_down = ((win32::GetAsyncKeyState(0x10) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA0) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0xA1) as u16 & 0x8000) != 0);

                let win_down = ((win32::GetAsyncKeyState(0x5B) as u16 & 0x8000) != 0)
                    || ((win32::GetAsyncKeyState(0x5C) as u16 & 0x8000) != 0);

                let alt_only = alt_down && !ctrl_down && !shift_down && !win_down;

                let c_down = (win32::GetAsyncKeyState(0x43) as u16 & 0x8000) != 0; // 'C' -> Click-through
                let m_down = (win32::GetAsyncKeyState(0x4D) as u16 & 0x8000) != 0; // 'M' -> Mouse cursor follow
                let g_down = (win32::GetAsyncKeyState(0x47) as u16 & 0x8000) != 0; // 'G' -> Ghost mode
                let p_down = (win32::GetAsyncKeyState(0x50) as u16 & 0x8000) != 0; // 'P' -> Play/Pause
                let s_down = (win32::GetAsyncKeyState(0x53) as u16 & 0x8000) != 0; // 'S' -> Mic Mute
                let x_down = (win32::GetAsyncKeyState(0x58) as u16 & 0x8000) != 0 || (win32::GetAsyncKeyState(0x51) as u16 & 0x8000) != 0; // 'X' / 'Q' -> Close / Exit
                let d_down = (win32::GetAsyncKeyState(0x44) as u16 & 0x8000) != 0; // 'D' -> Dock/Collapse to Top Notch
                let down_down = (win32::GetAsyncKeyState(0x28) as u16 & 0x8000) != 0 || (win32::GetAsyncKeyState(0x22) as u16 & 0x8000) != 0; // Down / PageDown
                let up_down = (win32::GetAsyncKeyState(0x26) as u16 & 0x8000) != 0 || (win32::GetAsyncKeyState(0x21) as u16 & 0x8000) != 0; // Up / PageUp

                let c_combo = alt_only && c_down;
                let m_combo = alt_only && m_down;
                let g_combo = alt_only && g_down;
                let p_combo = alt_only && p_down;
                let s_combo = alt_only && s_down;
                let x_combo = alt_only && x_down;
                let d_combo = alt_only && d_down;
                let down_combo = alt_only && down_down;
                let up_combo = alt_only && up_down;

                if c_combo && !prev_c_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-clickthrough", ());
                }
                if m_combo && !prev_m_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-follow-cursor", ());
                }
                if g_combo && !prev_g_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-ghost-mode", ());
                }
                if p_combo && !prev_p_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-play", ());
                }
                if s_combo && !prev_s_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-mic", ());
                }
                if x_combo && !prev_x_combo {
                    let _ = win_clone.emit("global-shortcut-close", ());
                }
                if d_combo && !prev_d_combo {
                    let _ = win_clone.emit("global-shortcut-toggle-dock", ());
                }
                if down_combo && !prev_down_combo {
                    let _ = win_clone.emit("global-shortcut-next-chapter", ());
                }
                if up_combo && !prev_up_combo {
                    let _ = win_clone.emit("global-shortcut-prev-chapter", ());
                }

                prev_c_combo = c_combo;
                prev_m_combo = m_combo;
                prev_g_combo = g_combo;
                prev_p_combo = p_combo;
                prev_s_combo = s_combo;
                prev_x_combo = x_combo;
                prev_d_combo = d_combo;
                prev_down_combo = down_combo;
                prev_up_combo = up_combo;
            }
        }
    });

    Ok(())
}

#[tauri::command]
fn exit_island_mode(window: tauri::WebviewWindow) -> Result<(), String> {
    ISLAND_SHORTCUTS_ACTIVE.store(false, Ordering::SeqCst);
    SHORTCUT_THREAD_ID.fetch_add(1, Ordering::SeqCst);
    let _ = window.set_ignore_cursor_events(false);
    window.set_always_on_top(false).map_err(|e| e.to_string())?;
    window.set_decorations(true).map_err(|e| e.to_string())?;
    let _ = window.set_shadow(true);
    let _ = window.set_resizable(true);
    window.set_size(Size::Logical(LogicalSize { width: 1200.0, height: 800.0 })).map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        apply_antigravity_titlebar_theme(&window);
        if let Ok(hwnd) = window.hwnd() {
            unsafe { win32::SetWindowDisplayAffinity(hwnd.0, 0x00000000) };
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
mod win32 {
    #[repr(C)]
    #[derive(Default, Copy, Clone, Debug)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn SetWindowDisplayAffinity(hwnd: *mut std::ffi::c_void, dwAffinity: u32) -> i32;
        pub fn GetCursorPos(lpPoint: *mut POINT) -> i32;
        pub fn GetAsyncKeyState(vKey: i32) -> i16;
        pub fn SetWindowPos(
            hwnd: *mut std::ffi::c_void,
            hwnd_insert_after: *mut std::ffi::c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            flags: u32,
        ) -> i32;
    }

    #[link(name = "dwmapi")]
    extern "system" {
        pub fn DwmSetWindowAttribute(
            hwnd: *mut std::ffi::c_void,
            dwAttribute: u32,
            pvAttribute: *const std::ffi::c_void,
            cbAttribute: u32,
        ) -> i32;
    }
}

#[cfg(target_os = "windows")]
pub fn apply_antigravity_titlebar_theme(window: &tauri::WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        unsafe {
            // DWMWA_USE_IMMERSIVE_DARK_MODE = 20
            let dark_mode: i32 = 1;
            let _ = win32::DwmSetWindowAttribute(
                hwnd.0,
                20,
                &dark_mode as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<i32>() as u32,
            );

            // DWMWA_BORDER_COLOR = 34 -> #262626 (0x00262626)
            let border_color: u32 = 0x00262626;
            let _ = win32::DwmSetWindowAttribute(
                hwnd.0,
                34,
                &border_color as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            );

            // DWMWA_CAPTION_COLOR = 35 -> #161616 (0x00161616)
            let caption_color: u32 = 0x00161616;
            let _ = win32::DwmSetWindowAttribute(
                hwnd.0,
                35,
                &caption_color as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            );

            // DWMWA_TEXT_COLOR = 36 -> #EDEDED (0x00EDEDED)
            let text_color: u32 = 0x00EDEDED;
            let _ = win32::DwmSetWindowAttribute(
                hwnd.0,
                36,
                &text_color as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<u32>() as u32,
            );

            // SWP_FRAMECHANGED (0x0020) | SWP_NOMOVE (0x0002) | SWP_NOSIZE (0x0001) | SWP_NOZORDER (0x0004)
            win32::SetWindowPos(hwnd.0, std::ptr::null_mut(), 0, 0, 0, 0, 0x0027);
        }
    }
}

#[tauri::command]
fn set_screen_capture_protection(window: tauri::WebviewWindow, enabled: bool) -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = window.hwnd() {
            // WDA_EXCLUDEFROMCAPTURE = 0x00000011 (Windows 10 2004+)
            // WDA_NONE = 0x00000000
            let affinity = if enabled { 0x00000011 } else { 0x00000000 };
            let ret = unsafe { win32::SetWindowDisplayAffinity(hwnd.0, affinity) };
            if ret != 0 {
                return Ok(enabled);
            } else if enabled {
                // Fallback to WDA_MONITOR = 0x00000001 for older Windows builds
                let fallback = unsafe { win32::SetWindowDisplayAffinity(hwnd.0, 0x00000001) };
                return Ok(fallback != 0);
            }
        }
    }
    Ok(false)
}

#[tauri::command]
fn get_cursor_position(window: tauri::WebviewWindow) -> Result<(f64, f64), String> {
    #[cfg(target_os = "windows")]
    {
        let mut pt = win32::POINT::default();
        let ok = unsafe { win32::GetCursorPos(&mut pt) };
        if ok != 0 {
            let scale_factor = window.scale_factor().unwrap_or(1.0);
            let x = pt.x as f64 / scale_factor;
            let y = pt.y as f64 / scale_factor;
            return Ok((x, y));
        }
    }
    Err("Failed to get cursor position".into())
}

#[tauri::command]
fn set_window_position(window: tauri::WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window.set_position(Position::Logical(LogicalPosition { x, y })).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_titlebar_theme(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        apply_antigravity_titlebar_theme(&window);
    }
    Ok(())
}

#[tauri::command]
fn set_click_through(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(enabled).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_island_docked(window: tauri::WebviewWindow, collapsed: bool, width: f64, height: f64) -> Result<(), String> {
    if let Ok(Some(monitor)) = window.current_monitor() {
        let screen_width = monitor.size().width as f64 / monitor.scale_factor();
        if collapsed {
            let _ = window.set_resizable(false);
            let target_w = 48.0;
            let target_h = 32.0;
            let x = (screen_width - target_w) / 2.0;
            let _ = window.set_size(Size::Logical(LogicalSize { width: target_w, height: target_h }));
            let _ = window.set_position(Position::Logical(LogicalPosition { x, y: 0.0 }));
        } else {
            let target_w = if width < 400.0 { 560.0 } else { width };
            let target_h = if height < 120.0 { 165.0 } else { height };
            let x = (screen_width - target_w) / 2.0;
            let _ = window.set_size(Size::Logical(LogicalSize { width: target_w, height: target_h }));
            let _ = window.set_position(Position::Logical(LogicalPosition { x, y: 15.0 }));
            let _ = window.set_resizable(true);
        }
    }
    let _ = window.set_focus();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(target_os = "windows")]
      {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
          apply_antigravity_titlebar_theme(&window);
          if let Ok(hwnd) = window.hwnd() {
            unsafe { win32::SetWindowDisplayAffinity(hwnd.0, 0x00000000) };
          }
        }
      }

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      enter_island_mode,
      exit_island_mode,
      set_island_docked,
      start_drag,
      set_screen_capture_protection,
      get_cursor_position,
      set_window_position,
      sync_titlebar_theme,
      set_click_through
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

