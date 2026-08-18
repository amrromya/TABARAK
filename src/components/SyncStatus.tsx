import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import type { SyncStatus as SyncStatusType, SyncResult } from "../types";

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusType | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api.getSyncStatus();
      setStatus(s);
    } catch {}
  }, []);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleSync = async () => {
    setIsSyncing(true);
    setLastResult(null);
    try {
      const result = await api.syncNow();
      setLastResult(result);
      await loadStatus();
    } catch (e) {
      setLastResult({
        pushed: 0,
        pulled: 0,
        conflicts: [],
        errors: [String(e)],
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status) return null;

  const isConfigured =
    status.config.supabase_url.length > 0 &&
    status.config.supabase_key.length > 0;

  return (
    <div className="sync-wrapper" style={{ position: "relative" }}>
      <button
        className="sync-trigger"
        onClick={() => setShowDropdown(!showDropdown)}
        title="المزامنة"
      >
        {isSyncing ? (
          <span className="sync-spin">&#x21bb;</span>
        ) : status.pending_push > 0 ? (
          <span className="sync-dot pending" />
        ) : (
          <span className="sync-dot ok" />
        )}
        <span style={{ fontSize: "0.8em" }}>☁</span>
      </button>

      {showDropdown && (
        <div className="sync-dropdown">
          <div className="sync-dd-header">
            <span>المزامنة</span>
            <button className="sync-dd-close" onClick={() => setShowDropdown(false)}>
              ✕
            </button>
          </div>

          {!isConfigured ? (
            <div className="sync-dd-body">
              <p style={{ color: "var(--muted)", fontSize: "0.85em" }}>
                لم يتم إعداد الاتصال بـ Supabase
              </p>
              <p style={{ color: "var(--muted)", fontSize: "0.75em" }}>
                افتح الإعدادات لإدخال بيانات الاتصال
              </p>
            </div>
          ) : (
            <div className="sync-dd-body">
              <div className="sync-dd-row">
                <span className="sync-dd-label">الفرع</span>
                <span className="sync-dd-value">
                  {status.config.branch_id}
                </span>
              </div>
              {status.last_sync && (
                <div className="sync-dd-row">
                  <span className="sync-dd-label">آخر مزامنة</span>
                  <span className="sync-dd-value">{status.last_sync}</span>
                </div>
              )}
              {status.pending_push > 0 && (
                <div className="sync-dd-row">
                  <span className="sync-dd-label">في الانتظار</span>
                  <span className="sync-dd-value pending">
                    {status.pending_push}
                  </span>
                </div>
              )}
              {status.conflicts.length > 0 && (
                <div className="sync-dd-row">
                  <span className="sync-dd-label">تعارضات</span>
                  <span className="sync-dd-value conflict">
                    {status.conflicts.length}
                  </span>
                </div>
              )}

              {lastResult && (
                <div className="sync-dd-result">
                  {lastResult.errors.length > 0 ? (
                    lastResult.errors.map((e, i) => (
                      <div key={i} className="sync-dd-error">
                        {e}
                      </div>
                    ))
                  ) : (
                    <div className="sync-dd-success">
                      تم رفع {lastResult.pushed} و جلب {lastResult.pulled}
                    </div>
                  )}
                </div>
              )}

              <button
                className="sync-dd-btn"
                onClick={handleSync}
                disabled={isSyncing}
              >
                {isSyncing ? "جاري المزامنة..." : "مزامنة الآن"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
