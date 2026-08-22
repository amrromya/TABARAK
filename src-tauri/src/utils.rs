use rusqlite::Connection;

/// Round a float to 2 decimal places for monetary values.
pub fn money(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

/// Add a column to a table if it doesn't already exist.
pub fn ensure_column(
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
