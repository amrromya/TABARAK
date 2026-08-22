use rusqlite::{params, Connection};

pub const CURRENT_VERSION: i64 = 1;

/// Migration entry: (version, name, SQL)
const MIGRATIONS: &[(i64, &str, &str)] = &[
    (1, "initial_schema", include_str!("../migrations/001_initial_schema.sql")),
];

/// Get the current schema version from the settings table.
pub fn get_version(conn: &Connection) -> i64 {
    conn.query_row(
        "SELECT COALESCE(CAST(value AS INTEGER), 0) FROM settings WHERE key = 'schema_version'",
        [],
        |r| r.get(0),
    )
    .unwrap_or(0)
}

/// Set the schema version.
fn set_version(conn: &Connection, version: i64) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES ('schema_version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![version.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Run all pending migrations.
pub fn run_migrations(conn: &Connection) -> Result<(), String> {
    let current = get_version(conn);

    for &(version, name, sql) in MIGRATIONS {
        if version > current {
            conn.execute_batch(sql)
                .map_err(|e| format!("Migration {name} (v{version}) failed: {e}"))?;
            set_version(conn, version)?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_version_is_zero() {
        let conn = Connection::open_in_memory().unwrap();
        // No settings table yet, should return 0
        let v = get_version(&conn);
        assert_eq!(v, 0);
    }

    #[test]
    fn test_set_and_get_version() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)").unwrap();
        set_version(&conn, 5).unwrap();
        let v = get_version(&conn);
        assert_eq!(v, 5);
    }
}
