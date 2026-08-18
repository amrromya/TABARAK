import { useEffect, useState } from "react";
import { api } from "../api";

interface LicenseRecord {
  key: string;
  customer: string;
  hwid: string;
  expiry: string;
  features: string;
  created: string;
}

export function ListTab() {
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    setLoading(true);
    try {
      const list = await api.listLicenses();
      setLicenses(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (key: string, idx: number) => {
    navigator.clipboard.writeText(key);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleDelete = async (idx: number) => {
    if (!confirm("هل تريد حذف هذا الكود؟")) return;
    try {
      await api.deleteLicense(idx);
      loadLicenses();
    } catch (e: any) {
      alert("خطأ: " + String(e));
    }
  };

  const featuresLabel = (f: string) => {
    const map: Record<string, string> = {
      basic: "Basic",
      pro: "Pro",
      full: "Full",
    };
    return map[f] || f;
  };

  const featuresColor = (f: string) => {
    const map: Record<string, string> = {
      basic: "#64748b",
      pro: "#f59e0b",
      full: "#059669",
    };
    return map[f] || "#64748b";
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>📋 أكواد التفعيل المحفوظة</h1>
        <button className="btn" onClick={loadLicenses}>🔄 تحديث</button>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">العدد الكلي</span>
          <span className="stat-value">{licenses.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="loading-card">⏳ جارٍ التحميل...</div>
      ) : licenses.length === 0 ? (
        <div className="empty-card">
          <span className="empty-icon">📭</span>
          <p>لا توجد أكواد تفعيل محفوظة</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>العميل</th>
                <th>بصمة الجهاز</th>
                <th>المدة</th>
                <th>الميزات</th>
                <th>التاريخ</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((lic, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td className="strong">{lic.customer}</td>
                  <td className="ltr mono">{lic.hwid}</td>
                  <td>{lic.expiry === "2099-12-31" ? "مدى الحياة" : lic.expiry}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ background: featuresColor(lic.features), color: "#fff" }}
                    >
                      {featuresLabel(lic.features)}
                    </span>
                  </td>
                  <td>{lic.created?.split(" ")[0] || "—"}</td>
                  <td className="actions">
                    <button
                      className="btn sm"
                      onClick={() => handleCopy(lic.key, idx)}
                    >
                      {copiedIdx === idx ? "✅" : "📋"}
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => handleDelete(idx)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
