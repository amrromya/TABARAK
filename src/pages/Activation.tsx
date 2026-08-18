import { useEffect, useState } from "react";
import { api } from "../api";

interface LicenseInfo {
  hwid: string;
  customer_name: string;
  expiry_date: string;
  features: string;
  created_at: string;
}

export function Activation({ onActivated }: { onActivated: () => void }) {
  const [hwid, setHwid] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadHwid();
    checkExistingLicense();
  }, []);

  const loadHwid = async () => {
    try {
      const h = await api.getHwid();
      setHwid(h);
    } catch (e) {
      console.error(e);
    }
  };

  const checkExistingLicense = async () => {
    try {
      const info = await api.getLicenseInfo();
      if (info) {
        setLicenseInfo(info);
      }
    } catch {
      // لا يوجد تفعيل
    }
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) {
      setError("أدخل كود التفعيل");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.activateLicense(licenseKey.trim());
      setLicenseInfo({ ...result, created_at: "" });
      onActivated();
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("هل تريد حذف التفعيل؟")) return;
    try {
      await api.removeLicense();
      setLicenseInfo(null);
    } catch (e: any) {
      setError(String(e));
    }
  };

  const copyHwid = () => {
    navigator.clipboard.writeText(hwid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isActive = !!licenseInfo;

  return (
    <div className="activation-page">
      <div className="activation-container">
        {/* Header */}
        <div className="activation-header">
          <div className="activation-logo">🔐</div>
          <h1>تفعيل برنامج تبارك</h1>
          <p>أدخل كود التفعيل لتثبيت البرنامج</p>
        </div>

        {/* Status Card */}
        {isActive && (
          <div className="activation-status active">
            <div className="status-icon">✅</div>
            <div className="status-info">
              <h3>البرنامج مُفعّل</h3>
              <div className="status-details">
                <span><b>الاسم:</b> {licenseInfo.customer_name}</span>
                <span><b>الانتهاء:</b> {licenseInfo.expiry_date}</span>
                <span><b>الميزات:</b> {licenseInfo.features}</span>
              </div>
            </div>
            <button className="btn danger sm" onClick={handleRemove}>حذف التفعيل</button>
          </div>
        )}

        {/* HWID Card */}
        <div className="activation-card">
          <h3>بصمة جهازك ( HWID )</h3>
          <p className="card-desc">أرسل هذا الكود للحصول على كود التفعيل</p>
          <div className="hwid-box">
            <code>{hwid || "جارٍ التحميل..."}</code>
            <button className="btn sm" onClick={copyHwid}>
              {copied ? "✅ تم النسخ" : "📋 نسخ"}
            </button>
          </div>
        </div>

        {/* Activation Form */}
        {!isActive && (
          <div className="activation-card">
            <h3>إدخال كود التفعيل</h3>
            <div className="activation-input-group">
              <input
                className="activation-input"
                placeholder="TABARAK-XXXX-XXXX-XXXX-XXXXXXXX"
                value={licenseKey}
                onChange={(e) => { setLicenseKey(e.target.value); setError(""); }}
                dir="ltr"
              />
              <button
                className="btn primary activation-btn"
                onClick={handleActivate}
                disabled={loading}
              >
                {loading ? "جارٍ التحقق..." : "🔑 تفعيل"}
              </button>
            </div>
            {error && <div className="activation-error">❌ {error}</div>}
          </div>
        )}

        {/* Footer */}
        <div className="activation-footer">
          <p>للحصول على كود التفعيل تواصل مع المطور</p>
          <p className="copyright">برنامج تبارك © 2025</p>
        </div>
      </div>
    </div>
  );
}
