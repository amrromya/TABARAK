import { useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { t } from "../i18n";
import type { SystemAuditLog } from "../types";

const PAGE_SIZE = 50;

const ENTITY_LABELS: Record<string, string> = {
  product: "منتج",
  sale: "بيع",
  purchase: "شراء",
  customer: "عميل",
  supplier: "مورد",
  expense: "مصروف",
  category: "تصنيف",
  warehouse: "مخزون",
};

const ACTION_LABELS: Record<string, string> = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
};

const ACTION_COLORS: Record<string, string> = {
  create: "#16a34a",
  update: "#2563eb",
  delete: "#dc2626",
};

export default function AuditLog() {
  const [logs, setLogs] = useState<SystemAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      if (search) params.search = search;
      if (entityType) params.entityType = entityType;
      if (action) params.action = action;
      const [logsData, countData] = await Promise.all([
        api.getAuditLogs(params),
        api.getAuditLogCount({
          entityType: entityType || undefined,
          action: action || undefined,
          search: search || undefined,
        }),
      ]);
      setLogs(logsData);
      setTotal(countData);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, entityType, action]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 20 }}>{t("auditLog") || "سجل التدقيق"}</h2>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder={t("search") || "بحث..."}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: 6,
          }}
        />
        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(0);
          }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">كل الأنواع</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6 }}
        >
          <option value="">كل العمليات</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 40 }}>{t("loading") || "جاري التحميل..."}</p>
      ) : logs.length === 0 ? (
        <p style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>
          {t("noData") || "لا توجد سجلات"}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb", textAlign: "right" }}>
                <th style={{ padding: "10px 8px" }}>{t("date") || "التاريخ"}</th>
                <th style={{ padding: "10px 8px" }}>{t("action") || "العملية"}</th>
                <th style={{ padding: "10px 8px" }}>{t("entityType") || "نوع البيانات"}</th>
                <th style={{ padding: "10px 8px" }}>{t("entityName") || "اسم العنصر"}</th>
                <th style={{ padding: "10px 8px" }}>{t("details") || "التفاصيل"}</th>
                <th style={{ padding: "10px 8px" }}>{t("user") || "المستخدم"}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "8px", whiteSpace: "nowrap" }}>{log.created_at}</td>
                  <td style={{ padding: "8px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#fff",
                        backgroundColor: ACTION_COLORS[log.action] || "#6b7280",
                      }}
                    >
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td style={{ padding: "8px" }}>
                    {ENTITY_LABELS[log.entity_type] || log.entity_type}
                  </td>
                  <td style={{ padding: "8px" }}>{log.entity_name || "—"}</td>
                  <td
                    style={{
                      padding: "8px",
                      maxWidth: 300,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {log.details || "—"}
                  </td>
                  <td style={{ padding: "8px" }}>{log.user_name || "admin"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            className="btn sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            {t("previous") || "السابق"}
          </button>
          <span style={{ fontSize: 14 }}>
            {page + 1} / {totalPages}
          </span>
          <button
            className="btn sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
          >
            {t("next") || "التالي"}
          </button>
        </div>
      )}
    </div>
  );
}
