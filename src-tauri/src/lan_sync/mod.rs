pub mod commands;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Duration;
use std::io::{Read, Write, BufRead, BufReader};
use std::net::{TcpListener, TcpStream, UdpSocket};

use crate::sync::schema;

const SYNC_PORT: u16 = 9527;
const DISCOVERY_PORT: u16 = 9528;
const SYNC_TABLES: &[&str] = schema::SYNC_TABLES;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanDevice {
    pub device_id: String,
    pub device_name: String,
    pub ip: String,
    pub port: u16,
    pub is_online: bool,
    pub last_seen: Option<String>,
    pub is_primary: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanSyncConfig {
    pub device_name: String,
    pub is_primary: bool,
    pub port: u16,
    pub auto_sync: bool,
    pub sync_interval_secs: u64,
    pub known_devices: Vec<LanDevice>,
}

impl Default for LanSyncConfig {
    fn default() -> Self {
        Self {
            device_name: gethostname::gethostname().to_string_lossy().to_string(),
            is_primary: false,
            port: SYNC_PORT,
            auto_sync: false,
            sync_interval_secs: 15,
            known_devices: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    Discover {
        device_id: String,
        device_name: String,
        is_primary: bool,
        port: u16,
    },
    DiscoverReply {
        device_id: String,
        device_name: String,
        is_primary: bool,
        port: u16,
    },
    SyncRequest {
        device_id: String,
        device_name: String,
        is_primary: bool,
        since: Option<String>,
        pending_tables: Vec<TableChanges>,
    },
    SyncResponse {
        device_id: String,
        device_name: String,
        applied_count: i64,
        pending_tables: Vec<TableChanges>,
    },
    SyncComplete {
        success: bool,
        message: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableChanges {
    pub table: String,
    pub records: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanSyncStatus {
    pub is_running: bool,
    pub device_id: String,
    pub device_name: String,
    pub is_primary: bool,
    pub port: u16,
    pub connected_devices: Vec<LanDevice>,
    pub last_sync: Option<String>,
    pub pending_push: i64,
    pub pending_pull: i64,
    pub auto_sync: bool,
    pub sync_interval_secs: u64,
}

pub(crate) struct ServerState {
    pub(crate) running: Arc<AtomicBool>,
    pub(crate) device_id: String,
    pub(crate) device_name: String,
    pub(crate) is_primary: bool,
    pub(crate) known_devices: Arc<Mutex<Vec<LanDevice>>>,
    pub(crate) last_sync: Arc<Mutex<Option<String>>>,
}

fn read_message(stream: &mut TcpStream) -> Result<SyncMessage, String> {
    let mut length_buf = String::new();
    let mut reader = BufReader::new(stream.try_clone().map_err(|e| e.to_string())?);
    reader.read_line(&mut length_buf).map_err(|e| format!("read length: {e}"))?;
    let length: usize = length_buf.trim().parse().map_err(|e| format!("parse length: {e}"))?;
    let mut buf = vec![0u8; length];
    reader.read_exact(&mut buf).map_err(|e| format!("read data: {e}"))?;
    serde_json::from_slice(&buf).map_err(|e| format!("parse json: {e}"))
}

fn write_message(stream: &mut TcpStream, msg: &SyncMessage) -> Result<(), String> {
    let json = serde_json::to_vec(msg).map_err(|e| e.to_string())?;
    let len = json.len();
    writeln!(stream, "{len}").map_err(|e| e.to_string())?;
    stream.write_all(&json).map_err(|e| e.to_string())?;
    stream.flush().map_err(|e| e.to_string())?;
    Ok(())
}

fn get_table_records(conn: &Connection, table: &str, since: &Option<String>) -> Result<Vec<serde_json::Value>, String> {
    let sql = if let Some(ref ts) = since {
        format!(
            "SELECT * FROM {} WHERE updated_at > '{}' OR updated_at IS NULL OR sync_status IS NULL LIMIT 1000",
            table, ts
        )
    } else {
        format!("SELECT * FROM {} LIMIT 1000", table)
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| format!("prepare {table}: {e}"))?;
    let columns: Vec<String> = stmt.column_names().iter().map(|c| c.to_string()).collect();

    let rows: Vec<serde_json::Value> = stmt
        .query_map([], |row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in columns.iter().enumerate() {
                let value: serde_json::Value = match row.get::<_, Option<String>>(i) {
                    Ok(Some(s)) => serde_json::Value::String(s),
                    Ok(None) => serde_json::Value::Null,
                    Err(_) => match row.get::<_, Option<i64>>(i) {
                        Ok(Some(n)) => serde_json::Value::Number(n.into()),
                        Ok(None) => serde_json::Value::Null,
                        Err(_) => match row.get::<_, Option<f64>>(i) {
                            Ok(Some(f)) => {
                                if let Some(n) = serde_json::Number::from_f64(f) {
                                    serde_json::Value::Number(n)
                                } else {
                                    serde_json::Value::Null
                                }
                            }
                            _ => serde_json::Value::Null,
                        },
                    },
                };
                obj.insert(col.clone(), value);
            }
            Ok(serde_json::Value::Object(obj))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

fn get_pending_changes(conn: &Connection, since: &Option<String>) -> Result<Vec<TableChanges>, String> {
    let mut result = Vec::new();
    for table in SYNC_TABLES {
        let rows = get_table_records(conn, table, since)?;
        if !rows.is_empty() {
            result.push(TableChanges { table: table.to_string(), records: rows });
        }
    }
    Ok(result)
}

fn apply_changes(conn: &Connection, tables: &[TableChanges]) -> Result<i64, String> {
    let mut count = 0i64;
    for tc in tables {
        schema::apply_remote_changes(conn, &tc.table, tc.records.clone())?;
        count += tc.records.len() as i64;
    }
    Ok(count)
}

fn handle_client(mut stream: TcpStream, conn: &Arc<Mutex<Connection>>, state: &Arc<ServerState>) -> Result<(), String> {
    let msg = read_message(&mut stream)?;

    match msg {
        SyncMessage::Discover { device_id, device_name, is_primary, port } => {
            let mut devices = state.known_devices.lock().map_err(|e| e.to_string())?;
            let ip = stream.peer_addr().map(|a| a.ip().to_string()).unwrap_or_default();
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            if let Some(d) = devices.iter_mut().find(|d| d.device_id == device_id) {
                d.ip = ip;
                d.port = port;
                d.is_online = true;
                d.device_name = device_name;
                d.is_primary = is_primary;
                d.last_seen = Some(now);
            } else {
                devices.push(LanDevice {
                    device_id, device_name, ip, port,
                    is_online: true, last_seen: Some(now), is_primary,
                });
            }
            drop(devices);

            let reply = SyncMessage::DiscoverReply {
                device_id: state.device_id.clone(),
                device_name: state.device_name.clone(),
                is_primary: state.is_primary,
                port: SYNC_PORT,
            };
            write_message(&mut stream, &reply)?;
        }
        SyncMessage::SyncRequest { device_id, device_name, is_primary, since, pending_tables } => {
            let applied = {
                let conn = conn.lock().map_err(|e| e.to_string())?;
                apply_changes(&conn, &pending_tables).unwrap_or(0)
            };

            let our_pending = {
                let conn = conn.lock().map_err(|e| e.to_string())?;
                get_pending_changes(&conn, &since).unwrap_or_default()
            };

            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
            if let Ok(mut ls) = state.last_sync.lock() {
                *ls = Some(now.clone());
            }

            {
                let mut devices = state.known_devices.lock().map_err(|e| e.to_string())?;
                let ip = stream.peer_addr().map(|a| a.ip().to_string()).unwrap_or_default();
                if let Some(d) = devices.iter_mut().find(|d| d.device_id == device_id) {
                    d.is_online = true;
                    d.last_seen = Some(now.clone());
                    d.ip = ip;
                } else {
                    devices.push(LanDevice {
                        device_id, device_name, ip,
                        port: SYNC_PORT, is_online: true,
                        last_seen: Some(now), is_primary,
                    });
                }
            }

            let response = SyncMessage::SyncResponse {
                device_id: state.device_id.clone(),
                device_name: state.device_name.clone(),
                applied_count: applied,
                pending_tables: our_pending,
            };
            write_message(&mut stream, &response)?;
        }
        _ => {
            write_message(&mut stream, &SyncMessage::SyncComplete {
                success: false, message: "Invalid".to_string(),
            })?;
        }
    }
    Ok(())
}

fn run_server(db_path: PathBuf, state: Arc<ServerState>) {
    loop {
        if !state.running.load(Ordering::Relaxed) {
            break;
        }
        // Try to open connection each time (handles DB locks)
        let conn = match Connection::open(&db_path) {
            Ok(c) => c,
            Err(_) => {
                thread::sleep(Duration::from_secs(2));
                continue;
            }
        };
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
        let conn = Arc::new(Mutex::new(conn));

        let listener = match TcpListener::bind(format!("0.0.0.0:{}", SYNC_PORT)) {
            Ok(l) => l,
            Err(_) => {
                thread::sleep(Duration::from_secs(2));
                continue;
            }
        };
        listener.set_nonblocking(false).ok();

        while state.running.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let conn = Arc::clone(&conn);
                    let state = Arc::clone(&state);
                    let _ = thread::spawn(move || {
                        let _ = handle_client(stream, &conn, &state);
                    });
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }
        break;
    }
}

fn run_discovery(state: Arc<ServerState>) {
    loop {
        if !state.running.load(Ordering::Relaxed) {
            break;
        }
        let socket = match UdpSocket::bind(format!("0.0.0.0:{DISCOVERY_PORT}")) {
            Ok(s) => s,
            Err(_) => {
                thread::sleep(Duration::from_secs(2));
                continue;
            }
        };
        socket.set_read_timeout(Some(Duration::from_secs(1))).ok();
        socket.set_broadcast(true).ok();

        let mut buf = [0u8; 2048];
        while state.running.load(Ordering::Relaxed) {
            match socket.recv_from(&mut buf) {
                Ok((len, addr)) => {
                    if let Ok(msg) = serde_json::from_slice::<SyncMessage>(&buf[..len]) {
                        if let SyncMessage::Discover { device_id, device_name, is_primary, port } = msg {
                            if device_id != state.device_id {
                                let mut devices = state.known_devices.lock().unwrap();
                                let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                                if let Some(d) = devices.iter_mut().find(|d| d.device_id == device_id) {
                                    d.ip = addr.ip().to_string();
                                    d.port = port;
                                    d.is_online = true;
                                    d.last_seen = Some(now);
                                } else {
                                    devices.push(LanDevice {
                                        device_id, device_name,
                                        ip: addr.ip().to_string(), port,
                                        is_online: true, last_seen: Some(now), is_primary,
                                    });
                                }
                                drop(devices);

                                let reply = SyncMessage::DiscoverReply {
                                    device_id: state.device_id.clone(),
                                    device_name: state.device_name.clone(),
                                    is_primary: state.is_primary,
                                    port: SYNC_PORT,
                                };
                                let _ = socket.send_to(&serde_json::to_vec(&reply).unwrap_or_default(), addr);
                            }
                        }
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }
        break;
    }
}

fn sync_with_peer(peer_ip: &str, peer_port: u16, conn: &Connection, state: &ServerState) -> Result<(i64, i64), String> {
    let mut stream = TcpStream::connect(format!("{peer_ip}:{peer_port}"))
        .map_err(|e| format!("فشل الاتصال بالجهاز {peer_ip}:{peer_port}: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(60))).map_err(|e| e.to_string())?;

    let last_sync = state.last_sync.lock().map_err(|e| e.to_string())?.clone();
    let pending = get_pending_changes(conn, &last_sync)?;

    let request = SyncMessage::SyncRequest {
        device_id: state.device_id.clone(),
        device_name: state.device_name.clone(),
        is_primary: state.is_primary,
        since: last_sync,
        pending_tables: pending,
    };

    write_message(&mut stream, &request)?;
    let response = read_message(&mut stream)?;

    match response {
        SyncMessage::SyncResponse { applied_count, pending_tables, .. } => {
            let pulled = apply_changes(conn, &pending_tables)?;
            if let Ok(mut ls) = state.last_sync.lock() {
                *ls = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
            }
            Ok((applied_count, pulled))
        }
        _ => Err("رد غير متوقع".to_string()),
    }
}

fn broadcast_discovery(state: &ServerState) -> Result<(), String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    socket.set_broadcast(true).map_err(|e| e.to_string())?;

    let msg = SyncMessage::Discover {
        device_id: state.device_id.clone(),
        device_name: state.device_name.clone(),
        is_primary: state.is_primary,
        port: SYNC_PORT,
    };
    let json = serde_json::to_vec(&msg).map_err(|e| e.to_string())?;
    // Broadcast multiple times for reliability
    for _ in 0..3 {
        let _ = socket.send_to(&json, format!("255.255.255.255:{DISCOVERY_PORT}"));
        thread::sleep(Duration::from_millis(100));
    }
    Ok(())
}

// ─── Public API ───────────────────────────────────────────────────────────

lazy_static::lazy_static! {
    static ref SERVER_STATE: Arc<Mutex<Option<Arc<ServerState>>>> = Arc::new(Mutex::new(None));
    static ref SERVER_THREAD: Arc<Mutex<Option<thread::JoinHandle<()>>>> = Arc::new(Mutex::new(None));
    static ref DISCOVERY_THREAD: Arc<Mutex<Option<thread::JoinHandle<()>>>> = Arc::new(Mutex::new(None));
}

pub fn start_lan_server(conn: &Connection, db_path: PathBuf, config: LanSyncConfig) -> Result<LanSyncStatus, String> {
    // Stop any existing server first
    let _ = stop_lan_server();

    let device_id = {
        let mut stmt = conn.prepare("SELECT value FROM sync_meta WHERE key = 'device_id'").map_err(|e| e.to_string())?;
        stmt.query_row([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?
    };

    let state = Arc::new(ServerState {
        running: Arc::new(AtomicBool::new(true)),
        device_id: device_id.clone(),
        device_name: config.device_name.clone(),
        is_primary: config.is_primary,
        known_devices: Arc::new(Mutex::new(config.known_devices.clone())),
        last_sync: Arc::new(Mutex::new(None)),
    });

    {
        let mut global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
        *global = Some(Arc::clone(&state));
    }

    // Server thread
    {
        let server_db_path = db_path.clone();
        let server_state = Arc::clone(&state);
        let handle = thread::spawn(move || {
            run_server(server_db_path, server_state);
        });
        let mut th = SERVER_THREAD.lock().map_err(|e| e.to_string())?;
        *th = Some(handle);
    }

    // Discovery thread
    {
        let disc_state = Arc::clone(&state);
        let handle = thread::spawn(move || {
            run_discovery(disc_state);
        });
        let mut dh = DISCOVERY_THREAD.lock().map_err(|e| e.to_string())?;
        *dh = Some(handle);
    }

    // Wait a moment for threads to start
    thread::sleep(Duration::from_millis(300));

    // Initial broadcast (multiple times)
    let _ = broadcast_discovery(&state);

    Ok(get_status(conn, &state))
}

pub fn stop_lan_server() -> Result<(), String> {
    let mut global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
    if let Some(state) = global.take() {
        state.running.store(false, Ordering::Relaxed);
    }
    Ok(())
}

pub fn get_status(conn: &Connection, state: &ServerState) -> LanSyncStatus {
    let pending_push = {
        let mut count = 0i64;
        for table in SYNC_TABLES {
            let sql = format!("SELECT COUNT(*) FROM {} WHERE sync_status IS NULL OR sync_status != 'synced'", table);
            if let Ok(c) = conn.query_row(&sql, [], |row| row.get::<_, i64>(0)) {
                count += c;
            }
        }
        count
    };

    let devices = state.known_devices.lock().map(|d| d.clone()).unwrap_or_default();
    let last_sync = state.last_sync.lock().map(|ls| ls.clone()).unwrap_or(None);

    LanSyncStatus {
        is_running: state.running.load(Ordering::Relaxed),
        device_id: state.device_id.clone(),
        device_name: state.device_name.clone(),
        is_primary: state.is_primary,
        port: SYNC_PORT,
        connected_devices: devices,
        last_sync,
        pending_push,
        pending_pull: 0,
        auto_sync: false,
        sync_interval_secs: 15,
    }
}

pub fn sync_with_device(peer_ip: &str, peer_port: u16, conn: &Connection) -> Result<(i64, i64), String> {
    let global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
    let state = global.as_ref().ok_or("الخادم غير يعمل")?;
    sync_with_peer(peer_ip, peer_port, conn, state)
}

pub fn discover_devices() -> Result<Vec<LanDevice>, String> {
    let state = {
        let global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
        global.as_ref().ok_or("الخادم غير يعمل")?.clone()
    };
    // Broadcast multiple times
    for _ in 0..5 {
        let _ = broadcast_discovery(&state);
        thread::sleep(Duration::from_millis(200));
    }
    let devices = state.known_devices.lock().map_err(|e| e.to_string())?;
    Ok(devices.clone())
}

pub fn save_config(conn: &Connection, config: &LanSyncConfig) -> Result<(), String> {
    let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('lan_sync_config', ?)",
        [&json],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn load_config(conn: &Connection) -> Result<LanSyncConfig, String> {
    let mut stmt = conn.prepare("SELECT value FROM sync_meta WHERE key = 'lan_sync_config'").map_err(|e| e.to_string())?;
    let result = stmt.query_row([], |row| row.get::<_, Option<String>>(0)).map_err(|e| e.to_string())?;
    match result {
        Some(json) => serde_json::from_str(&json).map_err(|e| e.to_string()),
        None => Ok(LanSyncConfig::default()),
    }
}

pub fn remove_device(device_id: &str) -> Result<(), String> {
    let global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
    if let Some(state) = global.as_ref() {
        let mut devices = state.known_devices.lock().map_err(|e| e.to_string())?;
        *devices = devices.iter().filter(|d| d.device_id != device_id).cloned().collect();
    }
    Ok(())
}
