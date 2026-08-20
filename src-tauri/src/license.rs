use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use tauri::State;
use crate::AppState;
use winreg::enums::*;
use winreg::RegKey;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LicenseData {
    pub hwid: String,
    pub customer_name: String,
    pub expiry_date: String,
    pub features: String,
    pub created_at: String,
    pub checksum: String,
}

#[cfg(target_os = "windows")]
pub fn get_hwid() -> String {
    let mut hwid_parts = Vec::new();

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Microsoft\\Cryptography") {
        if let Ok(val) = key.get_value::<String, _>("MachineGuid") {
            hwid_parts.push(val);
        }
    }

    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-Command", "(Get-CimInstance Win32_Processor).ProcessorId"])
        .output()
    {
        let s = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !s.is_empty() { hwid_parts.push(s); }
    }

    if let Ok(output) = std::process::Command::new("powershell")
        .args(["-Command", "(Get-Disk | Select-Object -First 1).SerialNumber"])
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

fn compute_checksum(license: &LicenseData) -> String {
    let payload = format!(
        "{}|{}|{}|{}|{}",
        license.hwid, license.customer_name, license.expiry_date, license.features, license.created_at
    );
    // مفتاح سري مقسّم لأجزاء صعبة التعقب
    let p1 = "t4b";
    let p2 = "4r4k";
    let p3 = "_s3cr";
    let p4 = "3t_k";
    let p5 = "3y_2025!";
    let secret = format!("{}{}{}{}{}", p1, p2, p3, p4, p5);
    let combined = format!("{}|{}", payload, secret);
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn verify_license_data(license: &LicenseData) -> Result<bool, String> {
    // 1. التحقق من التوقيع
    let expected = compute_checksum(license);
    if expected != license.checksum {
        return Err("توقيع التفعيل غير صالح".to_string());
    }

    // 2. التحقق من بصمة الجهاز
    let current_hwid = get_hwid();
    if license.hwid.to_uppercase() != current_hwid.to_uppercase() {
        return Err("كود التفعيل لا يعمل على هذا الجهاز".to_string());
    }

    // 3. التحقق من تاريخ الانتهاء
    let expiry = chrono::NaiveDate::parse_from_str(&license.expiry_date, "%Y-%m-%d")
        .map_err(|_| "تاريخ انتهاء غير صالح".to_string())?;
    let today = chrono::Local::now().date_naive();

    if today > expiry {
        return Err("انتهت صلاحية التفعيل".to_string());
    }

    Ok(true)
}

pub fn save_license(license: &LicenseData, app_dir: &PathBuf) -> Result<(), String> {
    let json = serde_json::to_string(license).map_err(|e| e.to_string())?;
    let license_path = app_dir.join("license.dat");
    fs::write(&license_path, &json).map_err(|e| format!("فشل حفظ التفعيل: {e}"))?;

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
    // فك تشفير كود التفعيل
    let key_clean = license_key.trim().replace("TABARAK-", "").replace("-", "");

    // محاولة فك base64
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
        return Err("كود التفعيل غير صالح".to_string());
    };

    // تحويل البيانات إلى LicenseData
    let license: LicenseData = serde_json::from_slice(&decoded)
        .map_err(|_| "بيانات التفعيل غير صالحة".to_string())?;

    // التحقق من صلاحية التفعيل
    verify_license_data(&license)?;

    // حفظ التفعيل
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
        .ok_or("لا يوجد تفعيل - يرجى إدخال كود التفعيل".to_string())?;

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
