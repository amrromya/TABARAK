use rusqlite::Connection;
use serde_json::Value;

pub const SYNC_TABLES: &[&str] = &[
    // 1. Reference tables (no foreign keys)
    "categories",
    "warehouses",
    "suppliers",
    "customers",
    "employees",
    // 2. Tables that depend on reference tables
    "products",
    // 3. Transaction tables
    "sales",
    "purchases",
    "expenses",
    "customer_payments",
    "salaries",
    "vacations",
    "stock_counts",
    // 4. Item tables (depend on transactions)
    "sale_items",
    "purchase_items",
    "sale_returns",
    "sale_return_items",
    "purchase_returns",
    "purchase_return_items",
    "stock_count_items",
];

pub fn add_sync_columns(conn: &Connection) -> Result<(), String> {
    // Create branches table FIRST (before trying to add columns to it)
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            address TEXT,
            phone TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        );
        
        INSERT OR IGNORE INTO branches (id, name) VALUES (1, 'الفرع الرئيسي');
        
        CREATE TABLE IF NOT EXISTS sync_meta (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        
        INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('last_sync', NULL);
        INSERT OR IGNORE INTO sync_meta (key, value) VALUES ('device_id', hex(randomblob(16)));
        "
    ).map_err(|e| format!("فشل إنشاء جداول المزامنة: {e}"))?;
    
    // Add sync columns without non-constant defaults (SQLite limitation for ALTER TABLE)
    for table in SYNC_TABLES {
        ensure_column(conn, table, "branch_id", "INTEGER")?;
        ensure_column(conn, table, "updated_at", "TEXT")?;
        ensure_column(conn, table, "deleted_at", "TEXT")?;
        ensure_column(conn, table, "device_id", "TEXT")?;
        ensure_column(conn, table, "sync_status", "TEXT")?;
    }
    
    // Set defaults for rows that don't have values yet
    for table in SYNC_TABLES {
        let _ = conn.execute_batch(&format!(
            "UPDATE {table} SET branch_id = 1 WHERE branch_id IS NULL;
             UPDATE {table} SET sync_status = 'synced' WHERE sync_status IS NULL;"
        ));
    }
    
    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), String> {
    let sql = format!("PRAGMA table_info({table})");
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let exists = stmt
        .query_map([], |r| r.get::<_, String>(1))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?
        .iter()
        .any(|n| n == column);
    if !exists {
        let sql = format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}");
        conn.execute(&sql, []).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn get_pending_changes(conn: &Connection) -> Result<Vec<(String, Vec<Value>)>, String> {
    let mut result = Vec::new();
    
    for table in SYNC_TABLES {
        let sql = format!(
            "SELECT * FROM {} WHERE sync_status = 'pending' OR sync_status IS NULL",
            table
        );
        
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let columns: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();
        
        let rows: Vec<Value> = stmt
            .query_map([], |row| {
                let mut obj = serde_json::Map::new();
                for (i, col) in columns.iter().enumerate() {
                    let value: Value = match row.get::<_, Option<String>>(i) {
                        Ok(Some(s)) => Value::String(s),
                        Ok(None) => Value::Null,
                        Err(_) => {
                            match row.get::<_, Option<i64>>(i) {
                                Ok(Some(n)) => Value::Number(n.into()),
                                Ok(None) => Value::Null,
                                Err(_) => {
                                    match row.get::<_, Option<f64>>(i) {
                                        Ok(Some(f)) => {
                                            // Convert to integer if it's a whole number
                                            if f.fract() == 0.0 && f >= i64::MIN as f64 && f <= i64::MAX as f64 {
                                                Value::Number((f as i64).into())
                                            } else if let Some(n) = serde_json::Number::from_f64(f) {
                                                Value::Number(n)
                                            } else {
                                                Value::Null
                                            }
                                        }
                                        Ok(None) => Value::Null,
                                        Err(_) => Value::Null,
                                    }
                                }
                            }
                        }
                    };
                    obj.insert(col.clone(), value);
                }
                Ok(Value::Object(obj))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        
        if !rows.is_empty() {
            result.push((table.to_string(), rows));
        }
    }
    
    Ok(result)
}

pub fn mark_synced(conn: &Connection, table: &str) -> Result<(), String> {
    let sql = format!(
        "UPDATE {} SET sync_status = 'synced' WHERE sync_status = 'pending' OR sync_status IS NULL",
        table
    );
    conn.execute(&sql, []).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_last_sync_time(conn: &Connection) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM sync_meta WHERE key = 'last_sync'")
        .map_err(|e| e.to_string())?;
    
    let result = stmt
        .query_row([], |row| row.get::<_, Option<String>>(0))
        .map_err(|e| e.to_string())?;
    
    Ok(result)
}

pub fn update_last_sync_time(conn: &Connection) -> Result<(), String> {
    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "UPDATE sync_meta SET value = ? WHERE key = 'last_sync'",
        [&now],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn apply_remote_changes(
    conn: &Connection,
    table: &str,
    records: Vec<Value>,
) -> Result<(), String> {
    for record in records {
        let id = record.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
        
        if id == 0 {
            continue;
        }
        
        // Check if record exists locally
        let exists: bool = conn
            .query_row(
                &format!("SELECT COUNT(*) FROM {} WHERE id = ?", table),
                [id],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)
            .unwrap_or(false);
        
        if exists {
            // Update existing record
            let mut sets = Vec::new();
            let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
            
            if let Some(obj) = record.as_object() {
                for (key, value) in obj {
                    if key == "id" || key == "created_at" {
                        continue;
                    }
                    
                    sets.push(format!("{} = ?", key));
                    values.push(Box::new(value_to_sql(value)));
                }
            }
            
            if !sets.is_empty() {
                sets.push("sync_status = 'synced'".to_string());
                sets.push("device_id = NULL".to_string());
                
                let sql = format!(
                    "UPDATE {} SET {} WHERE id = ?",
                    table,
                    sets.join(", ")
                );
                
                values.push(Box::new(id));
                
                let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
                conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
            }
        } else {
            // Insert new record
            if let Some(obj) = record.as_object() {
                let columns: Vec<String> = obj.keys().cloned().collect();
                let placeholders: Vec<String> = columns.iter().map(|_| "?".to_string()).collect();
                let values: Vec<Box<dyn rusqlite::types::ToSql>> = columns
                    .iter()
                    .filter_map(|key| obj.get(key).map(|v| Box::new(value_to_sql(v)) as Box<dyn rusqlite::types::ToSql>))
                    .collect();
                
                let sql = format!(
                    "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                    table,
                    columns.join(", "),
                    placeholders.join(", ")
                );
                
                let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
                conn.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
            }
        }
    }
    
    Ok(())
}

fn value_to_sql(value: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match value {
        Value::Null => Box::new(rusqlite::types::Value::Null),
        Value::Bool(b) => Box::new(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(rusqlite::types::Value::Null)
            }
        }
        Value::String(s) => Box::new(s.clone()),
        Value::Array(_) | Value::Object(_) => Box::new(value.to_string()),
    }
}

pub fn get_branch_id(conn: &Connection) -> Result<i64, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM sync_meta WHERE key = 'branch_id'")
        .map_err(|e| e.to_string())?;
    
    let result = stmt
        .query_row([], |row| row.get::<_, Option<String>>(0))
        .map_err(|e| e.to_string())?;
    
    match result {
        Some(id) => id.parse::<i64>().map_err(|e| e.to_string()),
        None => Ok(1),
    }
}

pub fn set_branch_id(conn: &Connection, branch_id: i64) -> Result<(), String> {
    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('branch_id', ?)",
        [branch_id.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
