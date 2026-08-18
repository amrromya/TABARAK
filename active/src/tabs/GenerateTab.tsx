import { useState } from "react";
import { api } from "../api";

export function GenerateTab() {
  const [customerName, setCustomerName] = useState("");
  const [hwid, setHwid] = useState("");
  const [duration, setDuration] = useState("1");
  const [features, setFeatures] = useState("full");
  const [generatedKey, setGeneratedKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!customerName.trim() || !hwid.trim()) {
      alert("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    setLoading(true);
    try {
      const result = await api.generateLicense({
        customer_name: customerName.trim(),
        hwid: hwid.trim().toUpperCase(),
        duration,
        features,
      });
      setGeneratedKey(result);
    } catch (e: any) {
      alert("خطأ: " + String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCustomerName("");
    setHwid("");
    setDuration("1");
    setFeatures("full");
    setGeneratedKey("");
    setCopied(false);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>🔑 توليد كود تفعيل جديد</h1>
      </div>

      <div className="form-card">
        <div className="form-grid">
          <div className="field">
            <label>اسم العميل *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="أدخل اسم العميل..."
            />
          </div>

          <div className="field">
            <label>بصمة الجهاز (HWID) *</label>
            <input
              value={hwid}
              onChange={(e) => setHwid(e.target.value)}
              placeholder="HWID-XXXX-XXXX-XXXX-XXXX"
              dir="ltr"
              className="hwid-input"
            />
            <span className="field-hint">يجب أن يبدأ بـ HWID-</span>
          </div>

          <div className="field-row">
            <div className="field">
              <label>مدة الصلاحية</label>
              <select value={duration} onChange={(e) => setDuration(e.target.value)}>
                <option value="1">شهر واحد</option>
                <option value="3">3 أشهر</option>
                <option value="6">6 أشهر</option>
                <option value="12">سنة كاملة</option>
                <option value="0">مدى الحياة</option>
              </select>
            </div>

            <div className="field">
              <label>الميزات</label>
              <select value={features} onChange={(e) => setFeatures(e.target.value)}>
                <option value="basic">Basic - مخزون + مبيعات</option>
                <option value="pro">Pro - + تقارير + صيانة</option>
                <option value="full">Full - كل شيء</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn primary" onClick={handleGenerate} disabled={loading}>
            {loading ? "⏳ جارٍ التوليد..." : "🔑 توليد الكود"}
          </button>
          <button className="btn" onClick={handleReset}>🔄 إعادة تعيين</button>
        </div>
      </div>

      {generatedKey && (
        <div className="result-card">
          <div className="result-header">
            <span className="result-icon">✅</span>
            <h3>تم توليد كود التفعيل بنجاح</h3>
          </div>

          <div className="result-info">
            <div className="info-row">
              <span className="info-label">العميل:</span>
              <span className="info-value">{customerName}</span>
            </div>
            <div className="info-row">
              <span className="info-label">الجهاز:</span>
              <span className="info-value ltr">{hwid}</span>
            </div>
            <div className="info-row">
              <span className="info-label">المدة:</span>
              <span className="info-value">
                {duration === "0" ? "مدى الحياة" : `${duration} أشهر`}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">الميزات:</span>
              <span className="info-value">{features}</span>
            </div>
          </div>

          <div className="key-box">
            <code className="key-text">{generatedKey}</code>
            <button className="btn sm" onClick={handleCopy}>
              {copied ? "✅ تم النسخ" : "📋 نسخ الكود"}
            </button>
          </div>

          <div className="result-actions">
            <button className="btn primary" onClick={handleCopy}>
              📋 نسخ كود التفعيل
            </button>
            <button className="btn" onClick={handleReset}>
              🔑 توليد كود جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
