pub mod commands;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::{Duration, Instant};
use std::io::{Read, Write, BufRead, BufReader};
use std::net::{TcpListener, TcpStream, UdpSocket};

use crate::sync::schema;

const SYNC_PORT: u16 = 9527;
const DISCOVERY_PORT: u16 = 9528;
const SYNC_TABLES: &[&str] = schema::SYNC_TABLES;
const ONLINE_TIMEOUT_SECS: u64 = 60;

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
    #[serde(default)]
    pub sync_token: String,
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
            sync_token: String::new(),
            known_devices: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLogEntry {
    pub timestamp: String,
    pub peer_ip: String,
    pub peer_name: String,
    pub pushed: i64,
    pub pulled: i64,
    pub direction: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncMessage {
    Discover {
        device_id: String,
        device_name: String,
        is_primary: bool,
        port: u16,
        sync_token: String,
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
        sync_token: String,
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
    pub sync_log: Vec<SyncLogEntry>,
}

pub(crate) struct ServerState {
    pub(crate) running: Arc<AtomicBool>,
    pub(crate) device_id: String,
    pub(crate) device_name: String,
    pub(crate) is_primary: bool,
    pub(crate) sync_token: String,
    pub(crate) known_devices: Arc<Mutex<Vec<LanDevice>>>,
    pub(crate) last_sync: Arc<Mutex<Option<String>>>,
    pub(crate) db_path: PathBuf,
    pub(crate) sync_log: Arc<Mutex<Vec<SyncLogEntry>>>,
    pub(crate) auto_sync_interval: Arc<Mutex<u64>>,
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
            "SELECT * FROM {} WHERE (updated_at > '{}' OR updated_at IS NULL OR sync_status IS NULL OR (deleted_at IS NOT NULL AND deleted_at > '{}')) LIMIT 2000",
            table, ts, ts
        )
    } else {
        format!("SELECT * FROM {} WHERE deleted_at IS NULL LIMIT 2000", table)
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

fn log_sync(conn: &Connection, entry: &SyncLogEntry) {
    let _ = conn.execute(
        "INSERT INTO lan_sync_log (timestamp, peer_ip, peer_name, pushed, pulled, direction, success, error_msg) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![entry.timestamp, entry.peer_ip, entry.peer_name, entry.pushed, entry.pulled, entry.direction, entry.success, entry.error],
    );
}

fn update_devices_offline(devices: &mut Vec<LanDevice>) {
    let now = chrono::Local::now();
    for d in devices.iter_mut() {
        if d.is_online {
            if let Some(ref ls) = d.last_seen {
                if let Ok(parsed) = chrono::NaiveDateTime::parse_from_str(ls, "%Y-%m-%d %H:%M:%S") {
                    let elapsed = now.naive_local() - parsed;
                    if elapsed.num_seconds() > ONLINE_TIMEOUT_SECS as i64 {
                        d.is_online = false;
                    }
                }
            }
        }
    }
}

fn handle_client(mut stream: TcpStream, conn: &Arc<Mutex<Connection>>, state: &Arc<ServerState>) -> Result<(), String> {
    let msg = read_message(&mut stream)?;

    match msg {
        SyncMessage::Discover { device_id, device_name, is_primary, port, sync_token } => {
            if !state.sync_token.is_empty() && sync_token != state.sync_token {
                write_message(&mut stream, &SyncMessage::SyncComplete {
                    success: false, message: "Invalid token".to_string(),
                })?;
                return Ok(());
            }

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
        SyncMessage::SyncRequest { device_id, device_name, is_primary, since, pending_tables, sync_token } => {
            if !state.sync_token.is_empty() && sync_token != state.sync_token {
                write_message(&mut stream, &SyncMessage::SyncComplete {
                    success: false, message: "Invalid token".to_string(),
                })?;
                return Ok(());
            }

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

            let peer_ip = stream.peer_addr().map(|a| a.ip().to_string()).unwrap_or_default();
            {
                let mut devices = state.known_devices.lock().map_err(|e| e.to_string())?;
                update_devices_offline(&mut devices);
                if let Some(d) = devices.iter_mut().find(|d| d.device_id == device_id) {
                    d.is_online = true;
                    d.last_seen = Some(now.clone());
                    d.ip = peer_ip.clone();
                } else {
                    devices.push(LanDevice {
                        device_id: device_id.clone(),
                        device_name: device_name.clone(),
                        ip: peer_ip.clone(),
                        port: SYNC_PORT, is_online: true,
                        last_seen: Some(now.clone()), is_primary,
                    });
                }
            }

            let entry = SyncLogEntry {
                timestamp: now.clone(),
                peer_ip: peer_ip.clone(),
                peer_name: device_name.clone(),
                pushed: applied,
                pulled: our_pending.iter().map(|t| t.records.len() as i64).sum(),
                direction: "receive".to_string(),
                success: true,
                error: None,
            };
            {
                let log = state.sync_log.lock().map_err(|e| e.to_string())?;
                let mut log = log.clone();
                if log.len() > 50 { log.remove(0); }
                log.push(entry.clone());
            }
            if let Ok(c) = Connection::open(&state.db_path) {
                log_sync(&c, &entry);
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
    let port = state.auto_sync_interval.lock().map(|i| *i).unwrap_or(SYNC_PORT as u64);
    let _ = port;
    loop {
        if !state.running.load(Ordering::Relaxed) {
            break;
        }
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
                        if let SyncMessage::Discover { device_id, device_name, is_primary, port, sync_token } = msg {
                            if device_id != state.device_id {
                                if !state.sync_token.is_empty() && sync_token != state.sync_token {
                                    continue;
                                }
                                let mut devices = state.known_devices.lock().unwrap();
                                let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                                update_devices_offline(&mut devices);
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

fn run_auto_sync(state: Arc<ServerState>) {
    while state.running.load(Ordering::Relaxed) {
        let interval = state.auto_sync_interval.lock().map(|i| *i).unwrap_or(15);
        thread::sleep(Duration::from_secs(interval));

        if !state.running.load(Ordering::Relaxed) {
            break;
        }

        let devices = {
            match state.known_devices.lock() {
                Ok(mut d) => {
                    update_devices_offline(&mut d);
                    d.clone()
                }
                Err(_) => continue,
            }
        };

        let online_peers: Vec<&LanDevice> = devices.iter()
            .filter(|d| d.is_online && d.device_id != state.device_id)
            .collect();

        if online_peers.is_empty() {
            continue;
        }

        let conn = match Connection::open(&state.db_path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");

        for peer in &online_peers {
            let last_sync = match state.last_sync.lock() {
                Ok(ls) => ls.clone(),
                Err(_) => continue,
            };
            match sync_with_peer_inner(&peer.ip, peer.port, &conn, &state, &last_sync) {
                Ok((pushed, pulled)) => {
                    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    if let Ok(mut ls) = state.last_sync.lock() {
                        *ls = Some(now.clone());
                    }
                    let entry = SyncLogEntry {
                        timestamp: now,
                        peer_ip: peer.ip.clone(),
                        peer_name: peer.device_name.clone(),
                        pushed,
                        pulled,
                        direction: "auto".to_string(),
                        success: true,
                        error: None,
                    };
                    if let Ok(mut log) = state.sync_log.lock() {
                        if log.len() > 50 { log.remove(0); }
                        log.push(entry.clone());
                    }
                    log_sync(&conn, &entry);
                }
                Err(e) => {
                    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                    let entry = SyncLogEntry {
                        timestamp: now,
                        peer_ip: peer.ip.clone(),
                        peer_name: peer.device_name.clone(),
                        pushed: 0,
                        pulled: 0,
                        direction: "auto".to_string(),
                        success: false,
                        error: Some(e),
                    };
                    if let Ok(mut log) = state.sync_log.lock() {
                        if log.len() > 50 { log.remove(0); }
                        log.push(entry.clone());
                    }
                    log_sync(&conn, &entry);
                }
            }
        }
    }
}

fn sync_with_peer_inner(peer_ip: &str, peer_port: u16, conn: &Connection, state: &ServerState, last_sync: &Option<String>) -> Result<(i64, i64), String> {
    let mut stream = TcpStream::connect(format!("{peer_ip}:{peer_port}"))
        .map_err(|e| format!("فشل الاتصال بالجهاز {peer_ip}:{peer_port}: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_secs(60))).map_err(|e| e.to_string())?;

    let pending = get_pending_changes(conn, last_sync)?;

    let request = SyncMessage::SyncRequest {
        device_id: state.device_id.clone(),
        device_name: state.device_name.clone(),
        is_primary: state.is_primary,
        since: last_sync.clone(),
        pending_tables: pending,
        sync_token: state.sync_token.clone(),
    };

    write_message(&mut stream, &request)?;
    let response = read_message(&mut stream)?;

    match response {
        SyncMessage::SyncResponse { applied_count, pending_tables, .. } => {
            let pulled = apply_changes(conn, &pending_tables)?;
            Ok((applied_count, pulled))
        }
        SyncMessage::SyncComplete { success: false, message } => {
            Err(format!("فشلت المزامنة: {message}"))
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
        sync_token: state.sync_token.clone(),
    };
    let json = serde_json::to_vec(&msg).map_err(|e| e.to_string())?;
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
    static ref AUTO_SYNC_THREAD: Arc<Mutex<Option<thread::JoinHandle<()>>>> = Arc::new(Mutex::new(None));
}

pub fn ensure_sync_log_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS lan_sync_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            peer_ip TEXT,
            peer_name TEXT,
            pushed INTEGER DEFAULT 0,
            pulled INTEGER DEFAULT 0,
            direction TEXT,
            success INTEGER DEFAULT 1,
            error_msg TEXT
        );"
    ).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn start_lan_server(conn: &Connection, db_path: PathBuf, config: LanSyncConfig) -> Result<LanSyncStatus, String> {
    let _ = stop_lan_server();

    ensure_sync_log_table(conn)?;

    let device_id = {
        let mut stmt = conn.prepare("SELECT value FROM sync_meta WHERE key = 'device_id'").map_err(|e| e.to_string())?;
        stmt.query_row([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?
    };

    let state = Arc::new(ServerState {
        running: Arc::new(AtomicBool::new(true)),
        device_id: device_id.clone(),
        device_name: config.device_name.clone(),
        is_primary: config.is_primary,
        sync_token: config.sync_token.clone(),
        known_devices: Arc::new(Mutex::new(config.known_devices.clone())),
        last_sync: Arc::new(Mutex::new(None)),
        db_path: db_path.clone(),
        sync_log: Arc::new(Mutex::new(Vec::new())),
        auto_sync_interval: Arc::new(Mutex::new(config.sync_interval_secs)),
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

    // Auto-sync thread
    if config.auto_sync {
        let auto_state = Arc::clone(&state);
        let handle = thread::spawn(move || {
            run_auto_sync(auto_state);
        });
        let mut ah = AUTO_SYNC_THREAD.lock().map_err(|e| e.to_string())?;
        *ah = Some(handle);
    }

    thread::sleep(Duration::from_millis(300));
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
    ensure_sync_log_table(conn).ok();

    let pending_push = {
        let mut count = 0i64;
        for table in SYNC_TABLES {
            let sql = format!("SELECT COUNT(*) FROM {} WHERE (sync_status IS NULL OR sync_status != 'synced') AND deleted_at IS NULL", table);
            if let Ok(c) = conn.query_row(&sql, [], |row| row.get::<_, i64>(0)) {
                count += c;
            }
        }
        count
    };

    let mut devices = state.known_devices.lock().map(|d| d.clone()).unwrap_or_default();
    update_devices_offline(&mut devices);
    let last_sync = state.last_sync.lock().map(|ls| ls.clone()).unwrap_or(None);
    let interval = state.auto_sync_interval.lock().map(|i| *i).unwrap_or(15);
    let sync_log = state.sync_log.lock().map(|l| {
        let mut l = l.clone();
        l.reverse();
        l
    }).unwrap_or_default();

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
        auto_sync: state.running.load(Ordering::Relaxed),
        sync_interval_secs: interval,
        sync_log,
    }
}

pub fn sync_with_device(peer_ip: &str, peer_port: u16, conn: &Connection) -> Result<(i64, i64), String> {
    let state = {
        let global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
        global.as_ref().ok_or("الخادم غير يعمل")?.clone()
    };

    let last_sync = state.last_sync.lock().map_err(|e| e.to_string())?.clone();
    let result = sync_with_peer_inner(peer_ip, peer_port, conn, &state, &last_sync);

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let (pushed, pulled) = match &result {
        Ok((p, pl)) => (*p, *pl),
        Err(_) => (0, 0),
    };

    let entry = SyncLogEntry {
        timestamp: now.clone(),
        peer_ip: peer_ip.to_string(),
        peer_name: String::new(),
        pushed,
        pulled,
        direction: "manual".to_string(),
        success: result.is_ok(),
        error: result.as_ref().err().cloned(),
    };

    if result.is_ok() {
        if let Ok(mut ls) = state.last_sync.lock() {
            *ls = Some(now);
        }
    }

    if let Ok(mut log) = state.sync_log.lock() {
        if log.len() > 50 { log.remove(0); }
        log.push(entry.clone());
    }
    log_sync(conn, &entry);

    result
}

pub fn discover_devices() -> Result<Vec<LanDevice>, String> {
    let state = {
        let global = SERVER_STATE.lock().map_err(|e| e.to_string())?;
        global.as_ref().ok_or("الخادم غير يعمل")?.clone()
    };
    for _ in 0..5 {
        let _ = broadcast_discovery(&state);
        thread::sleep(Duration::from_millis(200));
    }
    let mut devices = state.known_devices.lock().map_err(|e| e.to_string())?;
    update_devices_offline(&mut devices);
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

pub fn get_sync_log(conn: &Connection) -> Result<Vec<SyncLogEntry>, String> {
    ensure_sync_log_table(conn)?;
    let mut stmt = conn.prepare(
        "SELECT timestamp, peer_ip, peer_name, pushed, pulled, direction, success, error_msg FROM lan_sync_log ORDER BY id DESC LIMIT 50"
    ).map_err(|e| e.to_string())?;
    let entries = stmt.query_map([], |row| {
        Ok(SyncLogEntry {
            timestamp: row.get(0)?,
            peer_ip: row.get(1)?,
            peer_name: row.get(2).unwrap_or_default(),
            pushed: row.get(3).unwrap_or(0),
            pulled: row.get(4).unwrap_or(0),
            direction: row.get(5)?,
            success: row.get::<_, i64>(6).unwrap_or(1) == 1,
            error: row.get(7).unwrap_or(None),
        })
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(entries)
}
