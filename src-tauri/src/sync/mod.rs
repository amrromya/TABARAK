pub mod supabase;
pub mod schema;
pub mod conflict;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConfig {
    pub supabase_url: String,
    pub supabase_key: String,
    pub branch_id: i64,
    pub device_id: String,
    pub auto_sync: bool,
    pub sync_interval_secs: u64,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            supabase_url: String::new(),
            supabase_key: String::new(),
            branch_id: 1,
            device_id: Uuid::new_v4().to_string(),
            auto_sync: false,
            sync_interval_secs: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub is_online: bool,
    pub last_sync: Option<String>,
    pub pending_push: i64,
    pub pending_pull: i64,
    pub conflicts: Vec<SyncConflict>,
    pub config: SyncConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub table: String,
    pub record_id: i64,
    pub local_version: serde_json::Value,
    pub remote_version: serde_json::Value,
    pub conflict_type: ConflictType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictType {
    UpdateUpdate,
    DeleteUpdate,
    UpdateDelete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub pushed: i64,
    pub pulled: i64,
    pub conflicts: Vec<SyncConflict>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConflictResolution {
    KeepLocal,
    KeepRemote,
    Merge,
}

pub struct SyncEngine {
    config: SyncConfig,
}

impl SyncEngine {
    pub fn new(config: SyncConfig) -> Self {
        Self { config }
    }

    pub async fn test_connection(&self) -> Result<bool, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| format!("فشل إنشاء HTTP client: {e}"))?;

        let url = format!("{}/rest/v1/branches?select=id&limit=1", self.config.supabase_url);

        let response = client
            .get(&url)
            .header("apikey", &self.config.supabase_key)
            .header("Authorization", format!("Bearer {}", self.config.supabase_key))
            .send()
            .await
            .map_err(|e| format!("فشل الاتصال بـ Supabase: {e}"))?;

        Ok(response.status().is_success())
    }

    pub fn prepare_push(conn: &Connection) -> Result<Vec<(String, Vec<serde_json::Value>)>, String> {
        schema::get_pending_changes(conn)
    }

    pub async fn execute_push(
        &self,
        pending: Vec<(String, Vec<serde_json::Value>)>,
    ) -> Result<(i64, Vec<String>), String> {
        let mut pushed: i64 = 0;
        let mut errors = Vec::new();

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("فشل إنشاء HTTP client: {e}"))?;

        for (table, records) in pending {
            let url = format!("{}/rest/v1/{}", self.config.supabase_url, table);
            match client
                .post(&url)
                .header("apikey", &self.config.supabase_key)
                .header("Authorization", format!("Bearer {}", self.config.supabase_key))
                .header("Content-Type", "application/json")
                .header("Prefer", "resolution=merge-duplicates")
                .json(&records)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    pushed += records.len() as i64;
                }
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    errors.push(format!("خطأ رفع {}: {} - {}", table, status, body));
                }
                Err(e) => {
                    errors.push(format!("فشل رفع {}: {}", table, e));
                }
            }
        }

        Ok((pushed, errors))
    }

    pub fn mark_all_synced(conn: &Connection) -> Result<(), String> {
        for table in schema::SYNC_TABLES {
            schema::mark_synced(conn, table)?;
        }
        Ok(())
    }

    pub fn prepare_pull(conn: &Connection) -> Result<Option<String>, String> {
        schema::get_last_sync_time(conn)
    }

    pub async fn execute_pull(
        &self,
        last_sync: &Option<String>,
    ) -> Result<Vec<(String, Vec<serde_json::Value>)>, String> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("فشل إنشاء HTTP client: {e}"))?;

        let mut all_changes = Vec::new();
        let mut errors = Vec::new();

        for table in schema::SYNC_TABLES {
            let url = if let Some(ref since) = last_sync {
                format!(
                    "{}/rest/v1/{}?updated_at=gt.{}&branch_id=eq.{}&deleted_at=is.null",
                    self.config.supabase_url, table, since, self.config.branch_id
                )
            } else {
                format!(
                    "{}/rest/v1/{}?branch_id=eq.{}&deleted_at=is.null",
                    self.config.supabase_url, table, self.config.branch_id
                )
            };

            match client
                .get(&url)
                .header("apikey", &self.config.supabase_key)
                .header("Authorization", format!("Bearer {}", self.config.supabase_key))
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    if let Ok(records) = response.json::<Vec<serde_json::Value>>().await {
                        if !records.is_empty() {
                            all_changes.push((table.to_string(), records));
                        }
                    }
                }
                Ok(response) => {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    errors.push(format!("خطأ جلب {}: {} - {}", table, status, body));
                }
                Err(e) => {
                    errors.push(format!("فشل جلب {}: {}", table, e));
                }
            }
        }

        if !errors.is_empty() {
            return Err(errors.join("; "));
        }

        Ok(all_changes)
    }

    pub fn apply_pull(conn: &Connection, changes: Vec<(String, Vec<serde_json::Value>)>) -> Result<i64, String> {
        let mut pulled: i64 = 0;
        for (table, records) in changes {
            let count = records.len() as i64;
            schema::apply_remote_changes(conn, &table, records)?;
            pulled += count;
        }
        schema::update_last_sync_time(conn)?;
        Ok(pulled)
    }

    pub async fn push_table(
        &self,
        table: &str,
        records: Vec<serde_json::Value>,
    ) -> Result<(), String> {
        if records.is_empty() {
            return Ok(());
        }
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| format!("فشل إنشاء HTTP client: {e}"))?;

        let url = format!("{}/rest/v1/{}", self.config.supabase_url, table);
        let response = client
            .post(&url)
            .header("apikey", &self.config.supabase_key)
            .header("Authorization", format!("Bearer {}", self.config.supabase_key))
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates")
            .json(&records)
            .send()
            .await
            .map_err(|e| format!("فشل إرسال البيانات: {e}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("خطأ {}: {}", status, body));
        }

        Ok(())
    }

    pub fn get_config(&self) -> &SyncConfig {
        &self.config
    }
}
