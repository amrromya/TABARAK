use reqwest::Client;
use serde::{Deserialize, Serialize};

pub struct SupabaseClient {
    url: String,
    key: String,
    client: Client,
}

impl SupabaseClient {
    pub fn new(url: &str, key: &str, client: Client) -> Self {
        Self {
            url: url.to_string(),
            key: key.to_string(),
            client,
        }
    }
    
    pub async fn push<T: Serialize>(
        &self,
        table: &str,
        records: Vec<T>,
    ) -> Result<(), String> {
        if records.is_empty() {
            return Ok(());
        }
        
        let url = format!("{}/rest/v1/{}", self.url, table);
        
        let response = self.client
            .post(&url)
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
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
    
    pub async fn pull<T: for<'de> Deserialize<'de>>(
        &self,
        table: &str,
        since: &str,
        branch_id: i64,
    ) -> Result<Vec<T>, String> {
        let url = if since.is_empty() {
            format!(
                "{}/rest/v1/{}?branch_id=eq.{}&deleted_at=is.null",
                self.url, table, branch_id
            )
        } else {
            format!(
                "{}/rest/v1/{}?updated_at=gt.{}&branch_id=eq.{}&deleted_at=is.null",
                self.url, table, since, branch_id
            )
        };
        
        let response = self.client
            .get(&url)
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
            .send()
            .await
            .map_err(|e| format!("فشل جلب البيانات: {e}"))?;
        
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("خطأ {}: {}", status, body));
        }
        
        response
            .json()
            .await
            .map_err(|e| format!("فشل تحليل البيانات: {e}"))
    }
    
    pub async fn upsert<T: Serialize>(
        &self,
        table: &str,
        records: Vec<T>,
    ) -> Result<(), String> {
        let url = format!("{}/rest/v1/{}", self.url, table);
        
        let response = self.client
            .post(&url)
            .header("apikey", &self.key)
            .header("Authorization", format!("Bearer {}", self.key))
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
}
