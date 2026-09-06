use tauri::State;
use crate::AppState;
use super::{LanSyncConfig, LanSyncStatus, LanDevice, start_lan_server, stop_lan_server, get_status, sync_with_device, discover_devices, save_config, load_config, remove_device};

#[tauri::command]
pub fn start_lan_sync(
    state: State<'_, AppState>,
    device_name: String,
    is_primary: bool,
    port: u16,
    auto_sync: bool,
    sync_interval_secs: u64,
) -> Result<LanSyncStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut config = load_config(&conn)?;
    config.device_name = device_name;
    config.is_primary = is_primary;
    config.port = port;
    config.auto_sync = auto_sync;
    config.sync_interval_secs = sync_interval_secs;
    save_config(&conn, &config)?;
    start_lan_server(&conn, state.db_path.clone(), config)
}

#[tauri::command]
pub fn stop_lan_sync() -> Result<(), String> {
    stop_lan_server()
}

#[tauri::command]
pub fn get_lan_sync_status(
    state: State<'_, AppState>,
) -> Result<LanSyncStatus, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let config = load_config(&conn)?;
    let device_id = {
        let mut stmt = conn.prepare("SELECT value FROM sync_meta WHERE key = 'device_id'").map_err(|e| e.to_string())?;
        stmt.query_row([], |row| row.get::<_, String>(0)).unwrap_or_default()
    };
    
    // Build a minimal state for status
    use super::ServerState;
    use std::sync::{Arc, atomic::AtomicBool};
    let state_obj = Arc::new(ServerState {
        running: Arc::new(AtomicBool::new(false)),
        device_id,
        device_name: config.device_name.clone(),
        is_primary: config.is_primary,
        known_devices: std::sync::Arc::new(std::sync::Mutex::new(config.known_devices.clone())),
        last_sync: std::sync::Arc::new(std::sync::Mutex::new(None)),
    });
    
    Ok(get_status(&conn, &state_obj))
}

#[tauri::command]
pub fn lan_sync_now(
    state: State<'_, AppState>,
    peer_ip: String,
    peer_port: u16,
) -> Result<(i64, i64), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    sync_with_device(&peer_ip, peer_port, &conn)
}

#[tauri::command]
pub fn lan_discover_devices() -> Result<Vec<LanDevice>, String> {
    discover_devices()
}

#[tauri::command]
pub fn save_lan_sync_config(
    state: State<'_, AppState>,
    config_json: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let config: LanSyncConfig = serde_json::from_str(&config_json).map_err(|e| e.to_string())?;
    save_config(&conn, &config)
}

#[tauri::command]
pub fn load_lan_sync_config(
    state: State<'_, AppState>,
) -> Result<LanSyncConfig, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    load_config(&conn)
}

#[tauri::command]
pub fn remove_lan_device(
    device_id: String,
) -> Result<(), String> {
    remove_device(&device_id)
}
