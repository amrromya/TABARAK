use crate::sync::{
    SyncConfig, SyncConflict, SyncEngine, SyncResult, SyncStatus,
    ConflictResolution,
};
use crate::sync::schema;
use crate::AppState;
use rusqlite::Connection;
use tauri::State;

fn get_db<'a>(state: &'a State<'_, AppState>) -> Result<std::sync::MutexGuard<'a, Connection>, String> {
    state.db.lock().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_sync_status(state: State<AppState>) -> Result<SyncStatus, String> {
    let conn = get_db(&state)?;
    let config = get_sync_config_from_db(&conn)?;
    let last_sync = schema::get_last_sync_time(&conn)?;
    let pending_push = get_pending_count(&conn)?;
    Ok(SyncStatus {
        is_online: false,
        last_sync,
        pending_push,
        pending_pull: 0,
        conflicts: Vec::new(),
        config,
    })
}

#[tauri::command]
pub fn save_sync_config(state: State<AppState>, config: SyncConfig) -> Result<(), String> {
    let conn = get_db(&state)?;
    conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('supabase_url', ?)", [&config.supabase_url]).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('supabase_key', ?)", [&config.supabase_key]).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('branch_id', ?)", [config.branch_id.to_string()]).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('auto_sync', ?)", [config.auto_sync.to_string()]).map_err(|e| e.to_string())?;
    conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('sync_interval', ?)", [config.sync_interval_secs.to_string()]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn test_supabase_connection(url: String, key: String) -> Result<bool, String> {
    let config = SyncConfig {
        supabase_url: url,
        supabase_key: key,
        ..Default::default()
    };
    let engine = SyncEngine::new(config);
    engine.test_connection().await
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let config = {
        let conn = get_db(&state)?;
        get_sync_config_from_db(&conn)?
    };
    if config.supabase_url.is_empty() || config.supabase_key.is_empty() {
        return Err("لم يتم إعداد الاتصال بـ Supabase".to_string());
    }
    let engine = SyncEngine::new(config);

    // Phase 1: Push
    let pending = {
        let conn = get_db(&state)?;
        SyncEngine::prepare_push(&conn)?
    };
    let (pushed, push_errors) = engine.execute_push(pending).await?;
    {
        let conn = get_db(&state)?;
        SyncEngine::mark_all_synced(&conn)?;
    }

    // Phase 2: Pull
    let last_sync = {
        let conn = get_db(&state)?;
        SyncEngine::prepare_pull(&conn)?
    };
    let pull_result = engine.execute_pull(&last_sync).await;
    match pull_result {
        Ok(changes) => {
            let pulled = {
                let conn = get_db(&state)?;
                SyncEngine::apply_pull(&conn, changes)?
            };
            Ok(SyncResult {
                pushed,
                pulled,
                conflicts: Vec::new(),
                errors: push_errors,
            })
        }
        Err(e) => Ok(SyncResult {
            pushed,
            pulled: 0,
            conflicts: Vec::new(),
            errors: [push_errors, vec![e]].concat(),
        }),
    }
}

#[tauri::command]
pub async fn push_changes_cmd(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let config = {
        let conn = get_db(&state)?;
        get_sync_config_from_db(&conn)?
    };
    if config.supabase_url.is_empty() || config.supabase_key.is_empty() {
        return Err("لم يتم إعداد الاتصال بـ Supabase".to_string());
    }
    let engine = SyncEngine::new(config);

    let pending = {
        let conn = get_db(&state)?;
        SyncEngine::prepare_push(&conn)?
    };
    let (pushed, errors) = engine.execute_push(pending).await?;
    {
        let conn = get_db(&state)?;
        SyncEngine::mark_all_synced(&conn)?;
    }

    Ok(SyncResult {
        pushed,
        pulled: 0,
        conflicts: Vec::new(),
        errors,
    })
}

#[tauri::command]
pub async fn pull_changes_cmd(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let config = {
        let conn = get_db(&state)?;
        get_sync_config_from_db(&conn)?
    };
    if config.supabase_url.is_empty() || config.supabase_key.is_empty() {
        return Err("لم يتم إعداد الاتصال بـ Supabase".to_string());
    }
    let engine = SyncEngine::new(config);

    let last_sync = {
        let conn = get_db(&state)?;
        SyncEngine::prepare_pull(&conn)?
    };
    let changes = engine.execute_pull(&last_sync).await?;
    let pulled = {
        let conn = get_db(&state)?;
        SyncEngine::apply_pull(&conn, changes)?
    };

    Ok(SyncResult {
        pushed: 0,
        pulled,
        conflicts: Vec::new(),
        errors: Vec::new(),
    })
}

#[tauri::command]
pub async fn resolve_conflict_cmd(
    state: State<'_, AppState>,
    conflict: SyncConflict,
    resolution: ConflictResolution,
) -> Result<(), String> {
    let config = {
        let conn = get_db(&state)?;
        get_sync_config_from_db(&conn)?
    };
    let engine = SyncEngine::new(config);

    match resolution {
        ConflictResolution::KeepLocal => {
            engine.push_table(&conflict.table, vec![conflict.local_version.clone()]).await?;
            let conn = get_db(&state)?;
            schema::mark_synced(&conn, &conflict.table)?;
        }
        ConflictResolution::KeepRemote => {
            let conn = get_db(&state)?;
            schema::apply_remote_changes(&conn, &conflict.table, vec![conflict.remote_version.clone()])?;
        }
        ConflictResolution::Merge => {
            let merged = crate::sync::conflict::merge_records(&conflict.local_version, &conflict.remote_version);
            engine.push_table(&conflict.table, vec![merged]).await?;
            let conn = get_db(&state)?;
            schema::mark_synced(&conn, &conflict.table)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn list_branches(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = get_db(&state)?;
    let mut stmt = conn
        .prepare("SELECT id, name, address, phone, is_active FROM branches ORDER BY id")
        .map_err(|e| e.to_string())?;
    let branches = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, i64>(0)?,
                "name": row.get::<_, String>(1)?,
                "address": row.get::<_, Option<String>>(2)?,
                "phone": row.get::<_, Option<String>>(3)?,
                "is_active": row.get::<_, bool>(4)?
            }))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(branches)
}

#[tauri::command]
pub fn create_branch(
    state: State<AppState>,
    name: String,
    address: Option<String>,
    phone: Option<String>,
) -> Result<serde_json::Value, String> {
    let conn = get_db(&state)?;
    let addr = address.clone().unwrap_or_default();
    let ph = phone.clone().unwrap_or_default();
    conn.execute(
        "INSERT INTO branches (name, address, phone) VALUES (?, ?, ?)",
        rusqlite::params![name, addr, ph],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    Ok(serde_json::json!({
        "id": id,
        "name": name,
        "address": address,
        "phone": phone,
        "is_active": true
    }))
}

#[tauri::command]
pub fn update_branch(
    state: State<AppState>,
    id: i64,
    name: String,
    address: Option<String>,
    phone: Option<String>,
    is_active: bool,
) -> Result<(), String> {
    let conn = get_db(&state)?;
    let addr = address.unwrap_or_default();
    let ph = phone.unwrap_or_default();
    let active = if is_active { 1 } else { 0 };
    conn.execute(
        "UPDATE branches SET name = ?, address = ?, phone = ?, is_active = ? WHERE id = ?",
        rusqlite::params![name, addr, ph, active, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_branch(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = get_db(&state)?;
    if id == 1 {
        return Err("لا يمكن حذف الفرع الرئيسي".to_string());
    }
    conn.execute("DELETE FROM branches WHERE id = ?", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn get_sync_config_from_db(conn: &rusqlite::Connection) -> Result<SyncConfig, String> {
    let mut stmt = conn
        .prepare("SELECT key, value FROM sync_meta WHERE key IN ('supabase_url', 'supabase_key', 'branch_id', 'auto_sync', 'sync_interval')")
        .map_err(|e| e.to_string())?;
    let mut config = SyncConfig::default();
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })
        .map_err(|e| e.to_string())?;
    for row in rows {
        if let Ok((key, value)) = row {
            if let Some(value) = value {
                match key.as_str() {
                    "supabase_url" => config.supabase_url = value,
                    "supabase_key" => config.supabase_key = value,
                    "branch_id" => {
                        if let Ok(id) = value.parse::<i64>() {
                            config.branch_id = id;
                        }
                    }
                    "auto_sync" => config.auto_sync = value == "true",
                    "sync_interval" => {
                        if let Ok(secs) = value.parse::<u64>() {
                            config.sync_interval_secs = secs;
                        }
                    }
                    _ => {}
                }
            }
        }
    }
    if config.device_id.is_empty() {
        let device_id: String = conn
            .query_row("SELECT value FROM sync_meta WHERE key = 'device_id'", [], |row| row.get(0))
            .unwrap_or_else(|_| {
                let new_id = uuid::Uuid::new_v4().to_string();
                conn.execute("INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('device_id', ?)", [&new_id]).ok();
                new_id
            });
        config.device_id = device_id;
    }
    Ok(config)
}

fn get_pending_count(conn: &rusqlite::Connection) -> Result<i64, String> {
    let tables = schema::SYNC_TABLES;
    let mut total = 0;
    for table in tables {
        let sql = format!("SELECT COUNT(*) FROM {} WHERE sync_status = 'pending' OR sync_status IS NULL", table);
        let count: i64 = conn.query_row(&sql, [], |row| row.get(0)).unwrap_or(0);
        total += count;
    }
    Ok(total)
}

fn mark_all_pending(conn: &rusqlite::Connection) -> Result<i64, String> {
    let tables = schema::SYNC_TABLES;
    let mut total = 0;
    for table in tables {
        let sql = format!("UPDATE {} SET sync_status = 'pending' WHERE sync_status != 'pending' OR sync_status IS NULL", table);
        let count = conn.execute(&sql, []).unwrap_or(0) as i64;
        total += count;
    }
    Ok(total)
}

#[tauri::command]
pub async fn initial_sync(state: State<'_, AppState>) -> Result<SyncResult, String> {
    let config = {
        let conn = get_db(&state)?;
        get_sync_config_from_db(&conn)?
    };
    if config.supabase_url.is_empty() || config.supabase_key.is_empty() {
        return Err("لم يتم إعداد الاتصال بـ Supabase".to_string());
    }

    // Mark ALL local records as pending
    {
        let conn = get_db(&state)?;
        mark_all_pending(&conn)?;
    }

    let engine = SyncEngine::new(config);

    // Push all
    let pending = {
        let conn = get_db(&state)?;
        SyncEngine::prepare_push(&conn)?
    };
    let (pushed, push_errors) = engine.execute_push(pending).await?;
    {
        let conn = get_db(&state)?;
        SyncEngine::mark_all_synced(&conn)?;
    }

    // Pull all
    let pulled = {
        let changes = engine.execute_pull(&None).await.unwrap_or_default();
        if !changes.is_empty() {
            let conn = get_db(&state)?;
            SyncEngine::apply_pull(&conn, changes)?
        } else {
            0
        }
    };

    Ok(SyncResult {
        pushed,
        pulled,
        conflicts: Vec::new(),
        errors: push_errors,
    })
}
