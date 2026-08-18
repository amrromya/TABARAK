import { useState } from "react";
import { api } from "../api";

export function VerifyTab() {
  const [licenseKey, setLicenseKey] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!licenseKey.trim()) {
      alert("أدخل كود التفعيل");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.verifyLicense(licenseKey.trim());
      setResult(res);
    } catch (e: any) {
      setResult({ valid: false, error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>✅ التحقق من كود تفعيل</h1>
      </div>

      <div className="form-card">
        <div className="field">
          <label>كود التفعيل</label>
          <input
            value={licenseKey}
            onChange={(e) => { setLicenseKey(e.target.value); setResult(null); }}
            placeholder="TABARAK-XXXX-XXXX-XXXX-XXXXXXXX"
            dir="ltr"
            className="mono"
          />
        </div>

        <div className="form-actions">
          <button className="btn primary" onClick={handleVerify} disabled={loading}>
            {loading ? "⏳ جارٍ التحقق..." : "🔍 التحقق من الكود"}
          </button>
        </div>
      </div>

      {result && (
        <div className={`verify-result ${result.valid ? "valid" : "invalid"}`}>
          <div className="verify-icon">
            {result.valid ? "✅" : "❌"}
          </div>
          <div className="verify-info">
            <h3>{result.valid ? "كود التفعيل صالح" : "كود التفعيل غير صالح"}</h3>
            {result.valid ? (
              <div className="verify-details">
                <div className="detail-row">
                  <span className="detail-label">العميل:</span>
                  <span className="detail-value">{result.customer_name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">الجهاز:</span>
                  <span className="detail-value ltr">{result.hwid}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">تاريخ الانتهاء:</span>
                  <span className="detail-value">{result.expiry_date}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">الميزات:</span>
                  <span className="detail-value">{result.features}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">تاريخ الإنشاء:</span>
                  <span className="detail-value">{result.created_at}</span>
                </div>
              </div>
            ) : (
              <p className="verify-error">{result.error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
