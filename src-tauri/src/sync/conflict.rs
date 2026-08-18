use serde_json::Value;

pub fn merge_records(local: &Value, remote: &Value) -> Value {
    let mut merged = local.clone();
    
    if let (Some(local_obj), Some(remote_obj)) = (local.as_object(), remote.as_object()) {
        let mut merged_obj = serde_json::Map::new();
        
        // Copy all fields from local
        for (key, value) in local_obj {
            merged_obj.insert(key.clone(), value.clone());
        }
        
        // Merge remote fields (remote wins for updated_at)
        for (key, value) in remote_obj {
            if key == "updated_at" {
                // Always use remote's updated_at for conflict resolution
                merged_obj.insert(key.clone(), value.clone());
            } else if key == "id" || key == "created_at" {
                // Keep local id and created_at
                continue;
            } else if let Some(local_value) = local_obj.get(key) {
                // If values are different, use remote (LWW)
                if local_value != value {
                    merged_obj.insert(key.clone(), value.clone());
                }
            } else {
                // Field doesn't exist locally, add it
                merged_obj.insert(key.clone(), value.clone());
            }
        }
        
        merged = Value::Object(merged_obj);
    }
    
    merged
}

pub fn detect_conflict(local: &Value, remote: &Value) -> bool {
    // Simple conflict detection: if updated_at differs and both have changes
    if let (Some(local_time), Some(remote_time)) = (
        local.get("updated_at").and_then(|v| v.as_str()),
        remote.get("updated_at").and_then(|v| v.as_str()),
    ) {
        local_time != remote_time
    } else {
        false
    }
}

pub fn get_record_id(record: &Value) -> Option<i64> {
    record.get("id").and_then(|v| v.as_i64())
}

pub fn get_updated_at(record: &Value) -> Option<String> {
    record
        .get("updated_at")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

pub fn compare_timestamps(ts1: &str, ts2: &str) -> std::cmp::Ordering {
    ts1.cmp(ts2)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    
    #[test]
    fn test_merge_records() {
        let local = json!({
            "id": 1,
            "name": "Local Name",
            "price": 100,
            "updated_at": "2024-01-01 10:00:00"
        });
        
        let remote = json!({
            "id": 1,
            "name": "Remote Name",
            "price": 150,
            "updated_at": "2024-01-01 11:00:00"
        });
        
        let merged = merge_records(&local, &remote);
        
        assert_eq!(merged["name"], "Remote Name");
        assert_eq!(merged["price"], 150);
        assert_eq!(merged["updated_at"], "2024-01-01 11:00:00");
    }
    
    #[test]
    fn test_detect_conflict() {
        let local = json!({
            "id": 1,
            "updated_at": "2024-01-01 10:00:00"
        });
        
        let remote = json!({
            "id": 1,
            "updated_at": "2024-01-01 11:00:00"
        });
        
        assert!(detect_conflict(&local, &remote));
        
        let same = json!({
            "id": 1,
            "updated_at": "2024-01-01 10:00:00"
        });
        
        assert!(!detect_conflict(&local, &same));
    }
}
