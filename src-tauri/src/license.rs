use rsa::RsaPublicKey;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::AppState;
use winreg::enums::*;
use winreg::RegKey;

const TIME_FILE: &str = ".tabarak_last_time";

// Ø§Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ø¹Ø§Ù… Ø§Ù„Ù…Ø¯Ù…Ø¬ â€” Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„ØªØ­Ù‚Ù‚ Ø¨Ø¯ÙˆÙ† Ø¥Ø¹Ø§Ø¯Ø© Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø¨Ø±Ù†Ø§Ù…Ø¬
const PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu0tMFFI2aityna/Tsje/
JDLSCpF3E84jwqt+qMu6Z+ugD4hy1oTH/jGbP8L+UZC7cqlTD09C8Y/RRPIq4F4C
yPgmtX6qN876sXNJaC1i1zHnjhb6d0NPL7WpPnzrgBQPNFiaGB+nEAQWkG/eG8b3
o4cIn/zoXRoHrEE5+0mjxxY77E1JoGVrNKPIo2LQUQ9bCkwlV6JtPPA17jV3L+mg
IQmjfDsUlMf+Rmo2QPYBEoBfnoAGOYrlJnDFnF9jM9YvG55+LFenUOZrEtEsGc+A
RggliFTRz7NGs8GXzX+UkucXnFibJI+nmQqtiJjUdL/igohTDjcvUjMnilCyM2ZN
3QIDAQAB
-----END PUBLIC KEY-----";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LicenseData {
    pub hwid: String,
    pub customer_name: String,
    pub expiry_date: String,
    pub features: String,
    pub created_at: String,
    pub checksum: String,
}

fn load_public_key() -> Result<RsaPublicKey, String> {
    use rsa::pkcs8::DecodePublicKey;
    RsaPublicKey::from_public_key_pem(PUBLIC_KEY_PEM)
        .map_err(|_| "failed to load public key".to_string())
}

#[cfg(target_os = "windows")]
pub fn get_hwid() -> String {
    let mut hwid_parts = Vec::new();

    // MachineGuid من Registry — الأكثر استقراراً
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(val) = key.get_value::<String, _>("MachineGuid") {
            hwid_parts.push(val);
        }
    }

    // ProductName من Registry — ثابت دائماً
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion") {
        if let Ok(val) = key.get_value::<String, _>("ProductId") {
            hwid_parts.push(val);
        }
    }

    // اسم الجهاز — ثابت
    if let Ok(name) = gethostname::gethostname().into_string() {
        hwid_parts.push(name);
    }

    // لو مفيش أي جزء، نستخدم قيمة افتراضية
    if hwid_parts.is_empty() {
        hwid_parts.push("tabarak-fallback".to_string());
    }

    let combined = hwid_parts.join("|");
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    let result = hasher.finalize();

    format!(
        "HWID-{}-{}-{}-{}",
        hex::encode(&result[0..4]),
        hex::encode(&result[4..8]),
        hex::encode(&result[8..12]),
        hex::encode(&result[12..16])
    )
}

#[cfg(not(target_os = "windows"))]
pub fn get_hwid() -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"tabarak-default-hwid");
    let result = hasher.finalize();
    format!(
        "HWID-{}-{}-{}-{}",
        hex::encode(&result[0..4]),
        hex::encode(&result[4..8]),
        hex::encode(&result[8..12]),
        hex::encode(&result[12..16])
    )
}

fn verify_rsa_signature(payload: &[u8], signature_b64: &str) -> Result<(), String> {
    use rsa::pkcs1v15::VerifyingKey;
    use rsa::signature::Verifier;


    let pub_key = load_public_key()?;
    let sig_bytes = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        signature_b64,
    ).map_err(|_| "ØªÙˆÙ‚ÙŠØ¹ ØºÙŠØ± ØµØ§Ù„Ø­".to_string())?;
    let verifying_key = VerifyingKey::<Sha256>::new(pub_key);
    let sig = rsa::pkcs1v15::Signature::try_from(sig_bytes.as_slice())
        .map_err(|_| "ØªÙ†Ø³ÙŠÙ‚ ØªÙˆÙ‚ÙŠØ¹ ØºÙŠØ± ØµØ§Ù„Ø­".to_string())?;
    verifying_key
        .verify(payload, &sig)
        .map_err(|_| "ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„ØªÙØ¹ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­".to_string())
}

fn parse_expiry(date_str: &str) -> Result<chrono::NaiveDateTime, String> {
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d",
    ];
    for fmt in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str, fmt) {
            return Ok(dt);
        }
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, fmt) {
            return Ok(d.and_hms_opt(23, 59, 59).unwrap());
        }
    }
    Err("".to_string())
}

fn load_last_known_time(app_dir: &PathBuf) -> Option<chrono::NaiveDateTime> {
    // محاولة 1: ملف
    let path = app_dir.join(TIME_FILE);
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(stored) = content.trim().parse::<i64>() {
            if let Some(dt) = chrono::DateTime::from_timestamp(stored, 0) {
                return Some(dt.naive_utc());
            }
        }
    }
    // محاولة 2: Registry
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey("SOFTWARE\\Tabarak\\License") {
            if let Ok(val) = key.get_value::<String, _>("LastKnownTime") {
                if let Ok(stored) = val.parse::<i64>() {
                    if let Some(dt) = chrono::DateTime::from_timestamp(stored, 0) {
                        return Some(dt.naive_utc());
                    }
                }
            }
        }
    }
    None
}

fn save_last_known_time(app_dir: &PathBuf) {
    let now_ts = chrono::Utc::now().timestamp();
    // حفظ في ملف
    let path = app_dir.join(TIME_FILE);
    let _ = fs::write(&path, now_ts.to_string());
    // حفظ في Registry
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok((key, _)) = hklm.create_subkey("SOFTWARE\\Tabarak\\License") {
            let _ = key.set_value("LastKnownTime", &now_ts.to_string());
        }
    }
}

fn check_clock_rollback(app_dir: &PathBuf) -> Result<(), String> {
    if let Some(stored_time) = load_last_known_time(app_dir) {
        let now = chrono::Local::now().naive_local();
        if now < stored_time {
            return Err("تم كشف تغيير تاريخ الجهاز. يُرجى إعادة التاريخ والوقت إلى الحالة الصحيحة".to_string());
        }
    }
    Ok(())
}

pub fn verify_license_data(license: &LicenseData) -> Result<bool, String> {
    // 1. التحقق من التوقيع الرقمي RSA
    let payload = format!(
        "{}|{}|{}|{}|{}",
        license.hwid, license.customer_name, license.expiry_date, license.features, license.created_at
    );
    verify_rsa_signature(payload.as_bytes(), &license.checksum)?;

    // 2. التحقق من بصمة الجهاز
    let current_hwid = get_hwid();
    if license.hwid.to_uppercase() != current_hwid.to_uppercase() {
        return Err("كود التفعيل لا يعمل على هذا الجهاز".to_string());
    }

    // 3. التحقق من تاريخ انتهاء الصلاحية
    let expiry_dt = parse_expiry(&license.expiry_date)
        .map_err(|_| format!("تاريخ انتهاء غير صالح: {}", license.expiry_date))?;
    let now = chrono::Local::now().naive_local();

    if now > expiry_dt {
        return Err("انتهت صلاحية التفعيل".to_string());
    }

    Ok(true)
}

pub fn save_license(license: &LicenseData, app_dir: &PathBuf) -> Result<(), String> {
    let json = serde_json::to_string(license).map_err(|e| e.to_string())?;
    let license_path = app_dir.join("license.dat");
    fs::write(&license_path, &json).map_err(|e| format!("ÙØ´Ù„ Ø­ÙØ¸ Ø§Ù„ØªÙØ¹ÙŠÙ„: {e}"))?;

    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok((key, _)) = hklm.create_subkey("SOFTWARE\\Tabarak\\License") {
            let _ = key.set_value("LicenseData", &json);
        }
    }

    Ok(())
}

pub fn load_license(app_dir: &PathBuf) -> Option<LicenseData> {
    let license_path = app_dir.join("license.dat");
    if let Ok(json) = fs::read_to_string(&license_path) {
        if let Ok(license) = serde_json::from_str::<LicenseData>(&json) {
            return Some(license);
        }
    }

    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        if let Ok(key) = hklm.open_subkey("SOFTWARE\\Tabarak\\License") {
            if let Ok(json) = key.get_value::<String, _>("LicenseData") {
                if let Ok(license) = serde_json::from_str::<LicenseData>(&json) {
                    return Some(license);
                }
            }
        }
    }

    None
}

pub fn delete_license(app_dir: &PathBuf) -> Result<(), String> {
    let license_path = app_dir.join("license.dat");
    if license_path.exists() {
        fs::remove_file(&license_path).map_err(|e| e.to_string())?;
    }
    let time_path = app_dir.join(TIME_FILE);
    if time_path.exists() {
        let _ = fs::remove_file(&time_path);
    }
    #[cfg(target_os = "windows")]
    {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let _ = hklm.delete_subkey_all("SOFTWARE\\Tabarak\\License");
    }
    Ok(())
}

// ========== Tauri Commands ==========

#[tauri::command]
pub fn get_hwid_cmd() -> Result<String, String> {
    Ok(get_hwid())
}

#[tauri::command]
pub fn activate_license(
    state: State<AppState>,
    license_key: String,
) -> Result<LicenseData, String> {
    // ÙÙƒ ØªØ´ÙÙŠØ± ÙƒÙˆØ¯ Ø§Ù„ØªÙØ¹ÙŠÙ„
    let key_clean = license_key.trim().replace("TABARAK-", "").replace("-", "");

    // Ù…Ø­Ø§ÙˆÙ„Ø© ÙÙƒ base64
    let decoded = if let Ok(bytes) = base64::Engine::decode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        &key_clean,
    ) {
        bytes
    } else if let Ok(bytes) = base64::Engine::decode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        format!("{}=", key_clean),
    ) {
        bytes
    } else if let Ok(bytes) = base64::Engine::decode(
        &base64::engine::general_purpose::URL_SAFE_NO_PAD,
        format!("{}==", key_clean),
    ) {
        bytes
    } else {
        return Err("ÙƒÙˆØ¯ Ø§Ù„ØªÙØ¹ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­".to_string());
    };

    // ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¥Ù„Ù‰ LicenseData
    let license: LicenseData = serde_json::from_slice(&decoded)
        .map_err(|_| "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªÙØ¹ÙŠÙ„ ØºÙŠØ± ØµØ§Ù„Ø­Ø©".to_string())?;

    // Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„ØªÙØ¹ÙŠÙ„
    verify_license_data(&license)?;

    // حفظ الوقت الحالي بعد التفعيل الناجح
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let app_dir = dir.to_path_buf();
    save_last_known_time(&app_dir);

    // حفظ التفعيل
    save_license(&license, &app_dir)?;

    Ok(license)
}

#[tauri::command]
pub fn check_license(
    state: State<AppState>,
) -> Result<LicenseData, String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let app_dir = dir.to_path_buf();

    // فحص تغيير التاريخ للوراء
    check_clock_rollback(&app_dir)?;

    let license = load_license(&app_dir)
        .ok_or("لا يوجد تفعيل - يرجى إدخال كود التفعيل".to_string())?;

    verify_license_data(&license)?;

    // حفظ الوقت الحالي بعد التحقق الناجح
    save_last_known_time(&app_dir);

    Ok(license)
}

#[tauri::command]
pub fn get_license_info(
    state: State<AppState>,
) -> Result<Option<LicenseData>, String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let app_dir = dir.to_path_buf();

    // فحص تغيير التاريخ للوراء
    check_clock_rollback(&app_dir)?;

    let license = load_license(&app_dir);
    if let Some(ref _lic) = license {
        save_last_known_time(&app_dir);
    }
    Ok(license)
}

#[tauri::command]
pub fn remove_license(
    state: State<AppState>,
) -> Result<(), String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    delete_license(&dir.to_path_buf())
}
