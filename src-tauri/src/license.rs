use rsa::RsaPublicKey;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::AppState;
use winreg::enums::*;
use winreg::RegKey;

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
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut hwid_parts = Vec::new();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(val) = key.get_value::<String, _>("MachineGuid") {
            hwid_parts.push(val);
        }
    }

    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-Command", "(Get-CimInstance Win32_Processor).ProcessorId"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !s.is_empty() { hwid_parts.push(s); }
    }

    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-Command", "(Get-Disk | Select-Object -First 1).SerialNumber"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !s.is_empty() { hwid_parts.push(s); }
    }

    if let Ok(name) = gethostname::gethostname().into_string() {
        hwid_parts.push(name);
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

pub fn verify_license_data(license: &LicenseData) -> Result<bool, String> {
    // 1. Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„ØªÙˆÙ‚ÙŠØ¹ Ø§Ù„Ø±Ù‚Ù…ÙŠ RSA
    let payload = format!(
        "{}|{}|{}|{}|{}",
        license.hwid, license.customer_name, license.expiry_date, license.features, license.created_at
    );
    verify_rsa_signature(payload.as_bytes(), &license.checksum)?;

    // 2. Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø¨ØµÙ…Ø© Ø§Ù„Ø¬Ù‡Ø§Ø²
    let current_hwid = get_hwid();
    if license.hwid.to_uppercase() != current_hwid.to_uppercase() {
        return Err("ÙƒÙˆØ¯ Ø§Ù„ØªÙØ¹ÙŠÙ„ Ù„Ø§ ÙŠØ¹Ù…Ù„ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø¬Ù‡Ø§Ø²".to_string());
    }

    // 3. Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† ØªØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡
    let expiry = chrono::NaiveDate::parse_from_str(&license.expiry_date, "%Y-%m-%d")
        .map_err(|_| "ØªØ§Ø±ÙŠØ® Ø§Ù†ØªÙ‡Ø§Ø¡ ØºÙŠØ± ØµØ§Ù„Ø­".to_string())?;
    let today = chrono::Local::now().date_naive();

    if today > expiry {
        return Err("Ø§Ù†ØªÙ‡Øª ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„ØªÙØ¹ÙŠÙ„".to_string());
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

    // Ø­ÙØ¸ Ø§Ù„ØªÙØ¹ÙŠÙ„
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    save_license(&license, &dir.to_path_buf())?;

    Ok(license)
}

#[tauri::command]
pub fn check_license(
    state: State<AppState>,
) -> Result<LicenseData, String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let license = load_license(&dir.to_path_buf())
        .ok_or("Ù„Ø§ ÙŠÙˆØ¬Ø¯ ØªÙØ¹ÙŠÙ„ - ÙŠØ±Ø¬Ù‰ Ø¥Ø¯Ø®Ø§Ù„ ÙƒÙˆØ¯ Ø§Ù„ØªÙØ¹ÙŠÙ„".to_string())?;

    verify_license_data(&license)?;

    Ok(license)
}

#[tauri::command]
pub fn get_license_info(
    state: State<AppState>,
) -> Result<Option<LicenseData>, String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    Ok(load_license(&dir.to_path_buf()))
}

#[tauri::command]
pub fn remove_license(
    state: State<AppState>,
) -> Result<(), String> {
    let dir = state.db_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    delete_license(&dir.to_path_buf())
}
