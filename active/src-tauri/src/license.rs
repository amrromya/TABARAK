use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use tauri::State as TauriState;

const SECRET_KEY: &str = "t4b4r4k_s3cr3t_k3y_2025!";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseRecord {
    pub hwid: String,
    pub customer_name: String,
    pub expiry_date: String,
    pub features: String,
    pub created_at: String,
    pub checksum: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseListRecord {
    pub key: String,
    pub customer: String,
    pub hwid: String,
    pub expiry: String,
    pub features: String,
    pub created: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateInput {
    pub customer_name: String,
    pub hwid: String,
    pub duration: String,
    pub features: String,
}

fn compute_checksum(license: &LicenseRecord) -> String {
    let payload = format!(
        "{}|{}|{}|{}|{}",
        license.hwid, license.customer_name, license.expiry_date, license.features, license.created_at
    );
    let combined = format!("{}|{}", payload, SECRET_KEY);
    let mut hasher = Sha256::new();
    hasher.update(combined.as_bytes());
    hex::encode(hasher.finalize())
}

fn create_license_data(
    hwid: &str,
    customer_name: &str,
    expiry_date: &str,
    features: &str,
) -> LicenseRecord {
    let created_at = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let mut license = LicenseRecord {
        hwid: hwid.trim().to_string(),
        customer_name: customer_name.to_string(),
        expiry_date: expiry_date.to_string(),
        features: features.to_string(),
        created_at,
        checksum: String::new(),
    };
    license.checksum = compute_checksum(&license);
    license
}

fn encode_license_key(license: &LicenseRecord) -> String {
    let data_json = serde_json::to_string(license).unwrap_or_default();
    let encoded = URL_SAFE_NO_PAD.encode(data_json.as_bytes());
    let parts: Vec<String> = encoded
        .chars()
        .collect::<Vec<_>>()
        .chunks(8)
        .map(|c| c.iter().collect())
        .collect();
    format!("TABARAK-{}", parts.join("-"))
}

fn decode_license_key(key: &str) -> Option<LicenseRecord> {
    let cleaned = key.trim().replace("TABARAK-", "");
    let encoded = cleaned.replace("-", "");

    let bytes = if let Ok(b) = URL_SAFE_NO_PAD.decode(&encoded) {
        b
    } else if let Ok(b) = URL_SAFE_NO_PAD.decode(format!("{}=", encoded)) {
        b
    } else if let Ok(b) = URL_SAFE_NO_PAD.decode(format!("{}==", encoded)) {
        b
    } else {
        return None;
    };

    let json_str = String::from_utf8(bytes).ok()?;
    serde_json::from_str(&json_str).ok()
}

pub fn load_licenses_from_file(path: &str) -> Vec<LicenseRecord> {
    if let Ok(json) = fs::read_to_string(path) {
        if let Ok(records) = serde_json::from_str::<Vec<LicenseListRecord>>(&json) {
            return records
                .into_iter()
                .filter_map(|r| decode_license_key(&r.key))
                .collect();
        }
    }
    Vec::new()
}

fn save_licenses_to_file(licenses: &[LicenseListRecord], path: &str) {
    if let Ok(json) = serde_json::to_string_pretty(licenses) {
        let _ = fs::write(path, json);
    }
}

fn compute_expiry(duration: &str) -> String {
    match duration {
        "0" => "2099-12-31".to_string(),
        d => {
            let days: i64 = d.parse::<i64>().unwrap_or(30) * 30;
            (chrono::Local::now() + chrono::Duration::days(days))
                .format("%Y-%m-%d")
                .to_string()
        }
    }
}

// ========== Tauri Commands ==========

#[tauri::command]
pub fn generate_license(
    state: TauriState<'_, crate::AppState>,
    input: GenerateInput,
) -> Result<String, String> {
    if input.customer_name.trim().is_empty() {
        return Err("اسم العميل مطلوب".into());
    }
    if input.hwid.trim().is_empty() || !input.hwid.starts_with("HWID-") {
        return Err("بصمة الجهاز غير صالحة - يجب أن تبدأ بـ HWID-".into());
    }

    let expiry = compute_expiry(&input.duration);
    let license = create_license_data(&input.hwid, &input.customer_name, &expiry, &input.features);
    let key = encode_license_key(&license);

    let _record = LicenseListRecord {
        key: key.clone(),
        customer: input.customer_name.clone(),
        hwid: input.hwid.clone(),
        expiry: expiry.clone(),
        features: input.features.clone(),
        created: license.created_at.clone(),
    };

    let mut licenses = state.licenses.lock().unwrap();
    licenses.push(license);

    let all_records: Vec<LicenseListRecord> = licenses
        .iter()
        .map(|l| LicenseListRecord {
            key: encode_license_key(l),
            customer: l.customer_name.clone(),
            hwid: l.hwid.clone(),
            expiry: l.expiry_date.clone(),
            features: l.features.clone(),
            created: l.created_at.clone(),
        })
        .collect();

    save_licenses_to_file(&all_records, &state.licenses_path);

    Ok(key)
}

#[tauri::command]
pub fn list_licenses(
    state: TauriState<'_, crate::AppState>,
) -> Result<Vec<LicenseListRecord>, String> {
    let licenses = state.licenses.lock().unwrap();
    let records: Vec<LicenseListRecord> = licenses
        .iter()
        .map(|l| LicenseListRecord {
            key: encode_license_key(l),
            customer: l.customer_name.clone(),
            hwid: l.hwid.clone(),
            expiry: l.expiry_date.clone(),
            features: l.features.clone(),
            created: l.created_at.clone(),
        })
        .collect();
    Ok(records)
}

#[tauri::command]
pub fn delete_license(
    state: TauriState<'_, crate::AppState>,
    index: usize,
) -> Result<(), String> {
    let mut licenses = state.licenses.lock().unwrap();
    if index >= licenses.len() {
        return Err("رقم غير صالح".into());
    }
    licenses.remove(index);

    let all_records: Vec<LicenseListRecord> = licenses
        .iter()
        .map(|l| LicenseListRecord {
            key: encode_license_key(l),
            customer: l.customer_name.clone(),
            hwid: l.hwid.clone(),
            expiry: l.expiry_date.clone(),
            features: l.features.clone(),
            created: l.created_at.clone(),
        })
        .collect();

    save_licenses_to_file(&all_records, &state.licenses_path);
    Ok(())
}

#[tauri::command]
pub fn verify_license(
    key: String,
) -> Result<serde_json::Value, String> {
    let license = decode_license_key(&key)
        .ok_or("كود التفعيل غير صالح".to_string())?;

    let expected = compute_checksum(&license);
    if expected != license.checksum {
        return Err("توقيع غير صالح".into());
    }

    let expiry = chrono::NaiveDate::parse_from_str(&license.expiry_date, "%Y-%m-%d")
        .map_err(|_| "تاريخ غير صالح".to_string())?;
    let today = chrono::Local::now().date_naive();
    let valid = today <= expiry;

    let mut result = serde_json::json!({
        "valid": valid,
        "customer_name": license.customer_name,
        "hwid": license.hwid,
        "expiry_date": license.expiry_date,
        "features": license.features,
        "created_at": license.created_at,
    });

    if !valid {
        result["error"] = serde_json::json!("انتهت صلاحية التفعيل");
    }

    Ok(result)
}
