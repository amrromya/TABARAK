import React, { useState, useEffect, useCallback } from "react";
import {
  ProfessionalPrintSettings,
  DocType,
  PrintMode,
  PaperSize,
  Orientation,
  BarcodeType,
  getProfessionalPrintSettings,
  saveProfessionalPrintSettings,
  getDocumentConfig,
  saveDocumentConfig,
  listAvailablePrinters,
  testPagePrint,
} from "../utils/printSystem";
import { useToast } from "../components/ui";
import { t } from "../i18n";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  sales_invoice: "فاتورة مبيعات",
  purchase_invoice: "فاتورة مشتريات",
  sale_return: "مردود مبيعات",
  purchase_return: "مردود مشتريات",
  receipt_voucher: "سند قبض",
  payment_voucher: "سند دفع",
  customer_statement: "كشف حساب عميل",
  supplier_statement: "كشف حساب مورد",
  barcode_label: "ملصق باركود",
  report: "تقرير",
  inventory_report: "تقرير مخزون",
};

const DOC_TYPES: DocType[] = [
  "sales_invoice",
  "purchase_invoice",
  "sale_return",
  "purchase_return",
  "receipt_voucher",
  "payment_voucher",
  "customer_statement",
  "supplier_statement",
  "barcode_label",
  "report",
  "inventory_report",
];

interface PrintSettingsCardProps {
  settings: ProfessionalPrintSettings;
  onSettingsChange: (s: ProfessionalPrintSettings) => void;
  availablePrinters: string[];
  onPrintersRefresh: () => void;
}

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  padding: "16px",
  marginBottom: "16px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "15px",
  fontWeight: "700",
  color: "#1e3a5f",
  paddingBottom: "10px",
  marginBottom: "14px",
  borderBottom: "2px solid #f1f5f9",
};

const grid2Col: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const grid3Col: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "12px",
};

const grid4Col: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr 1fr",
  gap: "10px",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: "600",
  color: "#374151",
  marginBottom: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  fontSize: "13px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  background: "#fff",
  color: "#111827",
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
  boxSizing: "border-box",
};

const inputFocusStyle = inputStyle;

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 0",
  fontSize: "13px",
  color: "#374151",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "13px",
  fontWeight: "600",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
  transition: "all 0.15s",
};

const primaryBtn: React.CSSProperties = {
  ...buttonStyle,
  background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
  color: "#fff",
};

const secondaryBtn: React.CSSProperties = {
  ...buttonStyle,
  background: "#f1f5f9",
  color: "#374151",
  border: "1px solid #d1d5db",
};

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: "8px 14px",
  fontSize: "12px",
  fontWeight: active ? "700" : "500",
  borderRadius: "8px",
  border: active ? "none" : "1px solid #e5e7eb",
  cursor: "pointer",
  background: active ? "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)" : "#f8fafc",
  color: active ? "#fff" : "#475569",
  transition: "all 0.15s",
  whiteSpace: "nowrap",
});

const tabsWrap: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "6px",
  marginBottom: "14px",
  padding: "8px",
  background: "#f8fafc",
  borderRadius: "8px",
};

const subCardStyle: React.CSSProperties = {
  background: "#f8fafc",
  borderRadius: "8px",
  padding: "12px",
  border: "1px solid #e2e8f0",
};

const colorInputWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

const colorSwatch: React.CSSProperties = {
  width: "32px",
  height: "32px",
  borderRadius: "6px",
  border: "2px solid #d1d5db",
  cursor: "pointer",
  flexShrink: 0,
};

export default function PrintSettingsCard({
  settings,
  onSettingsChange,
  availablePrinters,
  onPrintersRefresh,
}: PrintSettingsCardProps) {
  const toast = useToast();
  const [selectedDocType, setSelectedDocType] = useState<DocType>("sales_invoice");
  const [saving, setSaving] = useState(false);

  const update = useCallback(
    <K extends keyof ProfessionalPrintSettings>(
      key: K,
      value: ProfessionalPrintSettings[K]
    ) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  const updateCompany = <K extends keyof ProfessionalPrintSettings["companyInfo"]>(
    key: K,
    value: ProfessionalPrintSettings["companyInfo"][K]
  ) => {
    update("companyInfo", { ...settings.companyInfo, [key]: value });
  };

  const updateDocConfig = <K extends keyof ProfessionalPrintSettings["documents"][DocType]>(
    key: K,
    value: ProfessionalPrintSettings["documents"][DocType][K]
  ) => {
    const docs = { ...settings.documents };
    docs[selectedDocType] = { ...docs[selectedDocType], [key]: value };
    update("documents", docs);
  };

  const updateDocMargins = (side: "top" | "right" | "bottom" | "left", val: number) => {
    const docs = { ...settings.documents };
    docs[selectedDocType] = {
      ...docs[selectedDocType],
      margins: { ...docs[selectedDocType].margins, [side]: val },
    };
    update("documents", docs);
  };

  const updateDocColors = <K extends keyof ProfessionalPrintSettings["documents"][DocType]["colors"]>(
    key: K,
    value: ProfessionalPrintSettings["documents"][DocType]["colors"][K]
  ) => {
    const docs = { ...settings.documents };
    docs[selectedDocType] = {
      ...docs[selectedDocType],
      colors: { ...docs[selectedDocType].colors, [key]: value },
    };
    update("documents", docs);
  };

  const updateDocFont = <K extends keyof ProfessionalPrintSettings["documents"][DocType]["font"]>(
    key: K,
    value: ProfessionalPrintSettings["documents"][DocType]["font"][K]
  ) => {
    const docs = { ...settings.documents };
    docs[selectedDocType] = {
      ...docs[selectedDocType],
      font: { ...docs[selectedDocType].font, [key]: value },
    };
    update("documents", docs);
  };

  const updateHeader = <K extends keyof ProfessionalPrintSettings["headerConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["headerConfig"][K]
  ) => {
    update("headerConfig", { ...settings.headerConfig, [key]: value });
  };

  const updateFooter = <K extends keyof ProfessionalPrintSettings["footerConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["footerConfig"][K]
  ) => {
    update("footerConfig", { ...settings.footerConfig, [key]: value });
  };

  const updateThermal = <K extends keyof ProfessionalPrintSettings["thermalConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["thermalConfig"][K]
  ) => {
    update("thermalConfig", { ...settings.thermalConfig, [key]: value });
  };

  const updateBarcode = <K extends keyof ProfessionalPrintSettings["barcodeConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["barcodeConfig"][K]
  ) => {
    update("barcodeConfig", { ...settings.barcodeConfig, [key]: value });
  };

  const updateQr = <K extends keyof ProfessionalPrintSettings["qrConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["qrConfig"][K]
  ) => {
    update("qrConfig", { ...settings.qrConfig, [key]: value });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      saveProfessionalPrintSettings(settings);
      toast("تم حفظ إعدادات الطباعة بنجاح ✅", "success");
    } catch (e) {
      toast("حدث خطأ أثناء حفظ الإعدادات ❌", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      await testPagePrint(settings.defaultPrinter, "A4");
      toast("تم إرسال صفحة الاختبار للطابعة 🖨️", "success");
    } catch (e) {
      toast("فشل طباعة صفحة الاختبار ❌", "error");
    }
  };

  const currentDoc = settings.documents[selectedDocType];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', 'Segoe UI', Tahoma, sans-serif" }}>
      {/* Section 1: Company Info */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>🏢</span>
          <span>معلومات الشركة</span>
        </div>
        <div style={grid2Col}>
          <div>
            <label style={labelStyle}>شعار الشركة (URL أو Base64)</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.logo}
              onChange={(e) => updateCompany("logo", e.target.value)}
              placeholder="https://example.com/logo.png أو data:image/png;base64,..."
            />
          </div>
          <div>
            <label style={labelStyle}>اسم الشركة (عربي)</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.nameAr}
              onChange={(e) => updateCompany("nameAr", e.target.value)}
              placeholder="مؤسسة تبارك"
            />
          </div>
          <div>
            <label style={labelStyle}>اسم الشركة (إنجليزي)</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.nameEn}
              onChange={(e) => updateCompany("nameEn", e.target.value)}
              placeholder="Tabarak Establishment"
            />
          </div>
          <div>
            <label style={labelStyle}>الرقم الضريبي</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.taxNumber}
              onChange={(e) => updateCompany("taxNumber", e.target.value)}
              placeholder="الرقم الضريبي المسجل"
            />
          </div>
          <div>
            <label style={labelStyle}>رقم السجل التجاري</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.crNumber}
              onChange={(e) => updateCompany("crNumber", e.target.value)}
              placeholder="رقم السجل التجاري"
            />
          </div>
          <div>
            <label style={labelStyle}>الموقع الإلكتروني</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.website}
              onChange={(e) => updateCompany("website", e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>البريد الإلكتروني</label>
            <input
              type="email"
              style={inputStyle}
              value={settings.companyInfo.email}
              onChange={(e) => updateCompany("email", e.target.value)}
              placeholder="info@example.com"
            />
          </div>
          <div>
            <label style={labelStyle}>الهاتف</label>
            <input
              type="tel"
              style={inputStyle}
              value={settings.companyInfo.phone}
              onChange={(e) => updateCompany("phone", e.target.value)}
              placeholder="01xxxxxxxxx"
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>العنوان</label>
            <input
              type="text"
              style={inputStyle}
              value={settings.companyInfo.address}
              onChange={(e) => updateCompany("address", e.target.value)}
              placeholder="العنوان الكامل للشركة"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Default Printers */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>🖨️</span>
          <span>الطابعات الافتراضية</span>
        </div>
        <div style={grid2Col}>
          <div>
            <label style={labelStyle}>الطابعة الافتراضية</label>
            <select
              style={selectStyle}
              value={settings.defaultPrinter}
              onChange={(e) => update("defaultPrinter", e.target.value)}
            >
              <option value="">— الافتراضية للنظام —</option>
              {availablePrinters.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <button
              style={{ ...secondaryBtn, flex: 1 }}
              onClick={onPrintersRefresh}
            >
              🔄 تحديث قائمة الطابعات
            </button>
            <button style={{ ...secondaryBtn, flex: 1 }} onClick={handleTestPrint}>
              🧪 طباعة صفحة اختبار
            </button>
          </div>
        </div>
        {availablePrinters.length === 0 && (
          <div
            style={{
              marginTop: "10px",
              padding: "8px 12px",
              background: "#fef3c7",
              color: "#92400e",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          >
            ⚠️ لم يتم اكتشاف طابعات. قد تحتاج إلى تثبيت خدمة الطباعة المحلية.
          </div>
        )}
      </div>

      {/* Section 3: Document Profiles */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>📄</span>
          <span>إعدادات أنواع المستندات</span>
        </div>

        <div style={tabsWrap}>
          {DOC_TYPES.map((dt) => (
            <button
              key={dt}
              style={tabBtn(selectedDocType === dt)}
              onClick={() => setSelectedDocType(dt)}
            >
              {DOC_TYPE_LABELS[dt]}
            </button>
          ))}
        </div>

        <div style={subCardStyle}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "700",
              color: "#1e3a5f",
              marginBottom: "12px",
            }}
          >
            إعدادات: {DOC_TYPE_LABELS[selectedDocType]}
          </div>

          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>الطابعة المخصصة</label>
              <select
                style={selectStyle}
                value={currentDoc.printer}
                onChange={(e) => updateDocConfig("printer", e.target.value)}
              >
                <option value="">— الافتراضية (العامة) —</option>
                {availablePrinters.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>حجم الورق</label>
              <select
                style={selectStyle}
                value={currentDoc.paperSize}
                onChange={(e) => updateDocConfig("paperSize", e.target.value as PaperSize)}
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="80mm">80mm (حرارية)</option>
                <option value="58mm">58mm (حرارية صغيرة)</option>
                <option value="custom">مخصص</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>الاتجاه</label>
              <select
                style={selectStyle}
                value={currentDoc.orientation}
                onChange={(e) => updateDocConfig("orientation", e.target.value as Orientation)}
              >
                <option value="portrait">عمودي (Portrait)</option>
                <option value="landscape">أفقي (Landscape)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>عدد النسخ (1-99)</label>
              <input
                type="number"
                min={1}
                max={99}
                style={inputStyle}
                value={currentDoc.copies}
                onChange={(e) =>
                  updateDocConfig("copies", Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>وضع الطباعة</label>
              <select
                style={selectStyle}
                value={currentDoc.mode}
                onChange={(e) => updateDocConfig("mode", e.target.value as PrintMode)}
              >
                <option value="direct">🖨️ طباعة مباشرة</option>
                <option value="preview">👁️ معاينة أولاً</option>
                <option value="dialog">💬 حوار النظام</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>النسبة المئوية للتكبير/التصغير (50%-200%)</label>
              <input
                type="number"
                min={50}
                max={200}
                style={inputStyle}
                value={currentDoc.scale ?? 100}
                onChange={(e) =>
                  updateDocConfig(
                    "scale",
                    Math.max(50, Math.min(200, parseInt(e.target.value) || 100))
                  )
                }
              />
            </div>
          </div>

          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              padding: "10px",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={currentDoc.showHeader}
                onChange={(e) => updateDocConfig("showHeader", e.target.checked)}
              />
              <span>إظهار رأس المستند</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={currentDoc.showFooter}
                onChange={(e) => updateDocConfig("showFooter", e.target.checked)}
              />
              <span>إظهار ذيل المستند</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={currentDoc.showLogo}
                onChange={(e) => updateDocConfig("showLogo", e.target.checked)}
              />
              <span>إظهار الشعار</span>
            </div>
          </div>

          <div style={{ marginTop: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#475569",
                marginBottom: "8px",
              }}
            >
              📐 الهوامش (mm)
            </div>
            <div style={grid4Col}>
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <div key={side}>
                  <label style={labelStyle}>
                    {side === "top"
                      ? "أعلى"
                      : side === "right"
                      ? "يمين"
                      : side === "bottom"
                      ? "أسفل"
                      : "يسار"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    style={inputStyle}
                    value={currentDoc.margins[side]}
                    onChange={(e) =>
                      updateDocMargins(side, Math.max(0, parseInt(e.target.value) || 0))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: "14px" }}>
            <div
              style={{
                fontSize: "12px",
                fontWeight: "700",
                color: "#475569",
                marginBottom: "8px",
              }}
            >
              🔤 الخطوط والألوان
            </div>
            <div style={grid2Col}>
              <div>
                <label style={labelStyle}>حجم الخط الأساسي (px)</label>
                <input
                  type="number"
                  min={8}
                  max={24}
                  style={inputStyle}
                  value={currentDoc.font.size}
                  onChange={(e) =>
                    updateDocFont("size", Math.max(8, parseInt(e.target.value) || 12))
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>اللون الرئيسي</label>
                <div style={colorInputWrap}>
                  <div
                    style={{ ...colorSwatch, background: currentDoc.colors.primary }}
                    onClick={() =>
                      (
                        document.getElementById(
                          `primary-color-${selectedDocType}`
                        ) as HTMLInputElement
                      )?.click()
                    }
                  />
                  <input
                    id={`primary-color-${selectedDocType}`}
                    type="color"
                    value={currentDoc.colors.primary}
                    onChange={(e) => updateDocColors("primary", e.target.value)}
                    style={{ width: "0", height: "0", opacity: "0", position: "absolute" }}
                  />
                  <input
                    type="text"
                    style={inputStyle}
                    value={currentDoc.colors.primary}
                    onChange={(e) => updateDocColors("primary", e.target.value)}
                  />
                </div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>لون خلفية العنوان</label>
                <div style={colorInputWrap}>
                  <div
                    style={{ ...colorSwatch, background: currentDoc.colors.headerBg }}
                    onClick={() =>
                      (
                        document.getElementById(
                          `headerbg-color-${selectedDocType}`
                        ) as HTMLInputElement
                      )?.click()
                    }
                  />
                  <input
                    id={`headerbg-color-${selectedDocType}`}
                    type="color"
                    value={currentDoc.colors.headerBg}
                    onChange={(e) => updateDocColors("headerBg", e.target.value)}
                    style={{ width: "0", height: "0", opacity: "0", position: "absolute" }}
                  />
                  <input
                    type="text"
                    style={inputStyle}
                    value={currentDoc.colors.headerBg}
                    onChange={(e) => updateDocColors("headerBg", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {currentDoc.paperSize === "custom" && (
            <div style={{ marginTop: "14px" }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "#475569",
                  marginBottom: "8px",
                }}
              >
                ✂️ أبعاد مخصصة (mm)
              </div>
              <div style={grid2Col}>
                <div>
                  <label style={labelStyle}>العرض المخصص</label>
                  <input
                    type="number"
                    min={20}
                    max={300}
                    style={inputStyle}
                    value={currentDoc.customWidthMm ?? 50}
                    onChange={(e) =>
                      updateDocConfig(
                        "customWidthMm",
                        Math.max(20, parseInt(e.target.value) || 50)
                      )
                    }
                  />
                </div>
                <div>
                  <label style={labelStyle}>الارتفاع المخصص</label>
                  <input
                    type="number"
                    min={10}
                    max={420}
                    style={inputStyle}
                    value={currentDoc.customHeightMm ?? 30}
                    onChange={(e) =>
                      updateDocConfig(
                        "customHeightMm",
                        Math.max(10, parseInt(e.target.value) || 30)
                      )
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Thermal Printer Settings */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>🔥</span>
          <span>إعدادات الطابعة الحرارية</span>
        </div>
        <div style={subCardStyle}>
          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>العرض</label>
              <select
                style={selectStyle}
                value={settings.thermalConfig.width}
                onChange={(e) =>
                  updateThermal("width", e.target.value as "58mm" | "80mm")
                }
              >
                <option value="80mm">80mm (قياسي)</option>
                <option value="58mm">58mm (صغير)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>حجم الخط (px)</label>
              <input
                type="number"
                min={7}
                max={16}
                style={inputStyle}
                value={settings.thermalConfig.fontSize}
                onChange={(e) =>
                  updateThermal("fontSize", Math.max(7, parseInt(e.target.value) || 10))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>حرف الفاصل بين الأعمدة</label>
              <select
                style={selectStyle}
                value={settings.thermalConfig.lineCharacter}
                onChange={(e) => updateThermal("lineCharacter", e.target.value)}
              >
                <option value="─">─ خط رفيع</option>
                <option value="━">━ خط سميك</option>
                <option value="=">=  علامة =</option>
                <option value="-">-  علامة -</option>
                <option value="*">*  نجمة</option>
                <option value=".">.  نقاط</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>رسالة شكر أسفل الفاتورة</label>
              <input
                type="text"
                style={inputStyle}
                value={settings.footerConfig.thankYouText}
                onChange={(e) => updateFooter("thankYouText", e.target.value)}
                placeholder="شكراً لزيارتكم"
              />
            </div>
          </div>
          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "6px",
              padding: "10px",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.thermalConfig.cutPaper}
                onChange={(e) => updateThermal("cutPaper", e.target.checked)}
              />
              <span>✂️ قص الورق بعد الطباعة</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.thermalConfig.openDrawer}
                onChange={(e) => updateThermal("openDrawer", e.target.checked)}
              />
              <span>💰 فتح درج النقود</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.thermalConfig.printQR}
                onChange={(e) => updateThermal("printQR", e.target.checked)}
              />
              <span>📱 طباعة رمز QR</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.thermalConfig.dense}
                onChange={(e) => updateThermal("dense", e.target.checked)}
              />
              <span>⬛ طباعة مدمجة (غليظة)</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.thermalConfig.beep}
                onChange={(e) => updateThermal("beep", e.target.checked)}
              />
              <span>🔔 صفارة التنبيه</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Barcode Settings */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>🏷️</span>
          <span>إعدادات الباركود</span>
        </div>
        <div style={subCardStyle}>
          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>نوع الباركود</label>
              <select
                style={selectStyle}
                value={settings.barcodeConfig.barcodeType}
                onChange={(e) => updateBarcode("barcodeType", e.target.value as BarcodeType)}
              >
                <option value="CODE128">CODE 128</option>
                <option value="EAN13">EAN-13</option>
                <option value="QR_CODE">QR Code</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>نوع الخط</label>
              <input
                type="text"
                style={inputStyle}
                value={settings.barcodeConfig.fontFamily}
                onChange={(e) => updateBarcode("fontFamily", e.target.value)}
                placeholder="'Segoe UI', 'Cairo', sans-serif"
              />
            </div>
            <div>
              <label style={labelStyle}>عرض الملصق (mm)</label>
              <input
                type="number"
                min={20}
                max={200}
                style={inputStyle}
                value={settings.barcodeConfig.widthMm}
                onChange={(e) =>
                  updateBarcode("widthMm", Math.max(20, parseInt(e.target.value) || 50))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>ارتفاع الملصق (mm)</label>
              <input
                type="number"
                min={10}
                max={200}
                style={inputStyle}
                value={settings.barcodeConfig.heightMm}
                onChange={(e) =>
                  updateBarcode("heightMm", Math.max(10, parseInt(e.target.value) || 30))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>حجم الخط (px)</label>
              <input
                type="number"
                min={6}
                max={20}
                style={inputStyle}
                value={settings.barcodeConfig.fontSize}
                onChange={(e) =>
                  updateBarcode("fontSize", Math.max(6, parseInt(e.target.value) || 10))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>عدد الأعمدة في الصفحة (1-8)</label>
              <input
                type="number"
                min={1}
                max={8}
                style={inputStyle}
                value={settings.barcodeConfig.columnsPerRow}
                onChange={(e) =>
                  updateBarcode(
                    "columnsPerRow",
                    Math.max(1, Math.min(8, parseInt(e.target.value) || 3))
                  )
                }
              />
            </div>
            <div>
              <label style={labelStyle}>المسافة بين الملصقات (mm)</label>
              <input
                type="number"
                min={0}
                max={20}
                style={inputStyle}
                value={settings.barcodeConfig.labelGap}
                onChange={(e) =>
                  updateBarcode("labelGap", Math.max(0, parseInt(e.target.value) || 2))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>هوامش الصفحة (mm)</label>
              <input
                type="number"
                min={0}
                max={30}
                style={inputStyle}
                value={settings.barcodeConfig.pageMargin}
                onChange={(e) =>
                  updateBarcode("pageMargin", Math.max(0, parseInt(e.target.value) || 5))
                }
              />
            </div>
          </div>
          <div
            style={{
              marginTop: "14px",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "6px",
              padding: "10px",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.barcodeConfig.showName}
                onChange={(e) => updateBarcode("showName", e.target.checked)}
              />
              <span>إظهار اسم الصنف</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.barcodeConfig.showPrice}
                onChange={(e) => updateBarcode("showPrice", e.target.checked)}
              />
              <span>إظهار السعر</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.barcodeConfig.showBarcode}
                onChange={(e) => updateBarcode("showBarcode", e.target.checked)}
              />
              <span>إظهار الباركود</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.barcodeConfig.showSku}
                onChange={(e) => updateBarcode("showSku", e.target.checked)}
              />
              <span>إظهار SKU</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.barcodeConfig.border}
                onChange={(e) => updateBarcode("border", e.target.checked)}
              />
              <span>حدود للملصقات</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: Header & Footer */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>📋</span>
          <span>إعدادات رأس وذيل المستند</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div style={subCardStyle}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#1e3a5f",
                marginBottom: "10px",
              }}
            >
              ⬆️ رأس المستند (Header)
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginBottom: "12px",
                padding: "8px",
                background: "#fff",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={settings.headerConfig.showLogo}
                  onChange={(e) => updateHeader("showLogo", e.target.checked)}
                />
                <span>إظهار الشعار</span>
              </div>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={settings.headerConfig.showTax}
                  onChange={(e) => updateHeader("showTax", e.target.checked)}
                />
                <span>إظهار الرقم الضريبي</span>
              </div>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={settings.headerConfig.showCR}
                  onChange={(e) => updateHeader("showCR", e.target.checked)}
                />
                <span>إظهار السجل التجاري</span>
              </div>
            </div>
            <div style={grid2Col}>
              <div>
                <label style={labelStyle}>المحاذاة</label>
                <select
                  style={selectStyle}
                  value={settings.headerConfig.alignment}
                  onChange={(e) =>
                    updateHeader(
                      "alignment",
                      e.target.value as "left" | "center" | "right"
                    )
                  }
                >
                  <option value="right">يمين</option>
                  <option value="center">وسط</option>
                  <option value="left">يسار</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>نمط الحدود</label>
                <select
                  style={selectStyle}
                  value={settings.headerConfig.borderStyle}
                  onChange={(e) =>
                    updateHeader(
                      "borderStyle",
                      e.target.value as "none" | "solid" | "double" | "dashed"
                    )
                  }
                >
                  <option value="none">بدون حدود</option>
                  <option value="solid">خط متصل</option>
                  <option value="double">خط مزدوج</option>
                  <option value="dashed">خط متقطع</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>لون الحدود</label>
                <div style={colorInputWrap}>
                  <div
                    style={{ ...colorSwatch, background: settings.headerConfig.borderColor }}
                    onClick={() =>
                      (
                        document.getElementById("header-border-color") as HTMLInputElement
                      )?.click()
                    }
                  />
                  <input
                    id="header-border-color"
                    type="color"
                    value={settings.headerConfig.borderColor}
                    onChange={(e) => updateHeader("borderColor", e.target.value)}
                    style={{ width: "0", height: "0", opacity: "0", position: "absolute" }}
                  />
                  <input
                    type="text"
                    style={inputStyle}
                    value={settings.headerConfig.borderColor}
                    onChange={(e) => updateHeader("borderColor", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={subCardStyle}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: "#1e3a5f",
                marginBottom: "10px",
              }}
            >
              ⬇️ ذيل المستند (Footer)
            </div>
            <div style={grid2Col}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>نص مخصص</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={settings.footerConfig.text}
                  onChange={(e) => updateFooter("text", e.target.value)}
                  placeholder="نص إضافي يظهر في أسفل الصفحة"
                />
              </div>
              <div>
                <label style={labelStyle}>اسم توقيع 1</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={settings.footerConfig.signatureLine1}
                  onChange={(e) => updateFooter("signatureLine1", e.target.value)}
                  placeholder="المستلم"
                />
              </div>
              <div>
                <label style={labelStyle}>اسم توقيع 2</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={settings.footerConfig.signatureLine2}
                  onChange={(e) => updateFooter("signatureLine2", e.target.value)}
                  placeholder="المخزن / المحاسب"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>رسالة الشكر</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={settings.footerConfig.thankYouText}
                  onChange={(e) => updateFooter("thankYouText", e.target.value)}
                  placeholder="شكراً لاختياركم تبارك"
                />
              </div>
            </div>
            <div
              style={{
                marginTop: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "8px",
                background: "#fff",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={settings.footerConfig.showPageNumbers}
                  onChange={(e) => updateFooter("showPageNumbers", e.target.checked)}
                />
                <span>إظهار أرقام الصفحات</span>
              </div>
              <div style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={settings.footerConfig.showSignature}
                  onChange={(e) => updateFooter("showSignature", e.target.checked)}
                />
                <span>إظهار منطقة التوقيع</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 7: QR Code Settings */}
      <div style={cardStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "18px" }}>📱</span>
          <span>إعدادات QR Code</span>
        </div>
        <div style={subCardStyle}>
          <div style={grid2Col}>
            <div>
              <label style={labelStyle}>حجم QR (px)</label>
              <input
                type="number"
                min={40}
                max={300}
                style={inputStyle}
                value={settings.qrConfig.size}
                onChange={(e) =>
                  updateQr("size", Math.max(40, Math.min(300, parseInt(e.target.value) || 80)))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>درجة تصحيح الخطأ</label>
              <select
                style={selectStyle}
                value={settings.qrConfig.errorCorrection}
                onChange={(e) =>
                  updateQr(
                    "errorCorrection",
                    e.target.value as "L" | "M" | "Q" | "H"
                  )
                }
              >
                <option value="L">L (منخفضة ~7%)</option>
                <option value="M">M (متوسطة ~15%)</option>
                <option value="Q">Q (عالية ~25%)</option>
                <option value="H">H (عالية جداً ~30%)</option>
              </select>
            </div>
          </div>
          <div
            style={{
              marginTop: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              padding: "10px",
              background: "#fff",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.qrConfig.enabled}
                onChange={(e) => updateQr("enabled", e.target.checked)}
              />
              <span>✅ تفعيل QR Code في الفواتير</span>
            </div>
            <div style={checkboxRow}>
              <input
                type="checkbox"
                checked={settings.qrConfig.includeInvoiceData}
                onChange={(e) => updateQr("includeInvoiceData", e.target.checked)}
              />
              <span>📝 تضمين بيانات الفاتورة الكاملة في QR</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "16px 0 8px",
          position: "sticky",
          bottom: 0,
          background: "linear-gradient(to top, #f8fafc 60%, transparent)",
          borderRadius: "12px",
          marginTop: "8px",
        }}
      >
        <button
          style={{
            ...primaryBtn,
            padding: "12px 40px",
            fontSize: "15px",
            borderRadius: "10px",
            boxShadow: "0 4px 14px rgba(30,58,95,0.3)",
            opacity: saving ? 0.7 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "💾 جاري الحفظ..." : "💾 حفظ جميع الإعدادات"}
        </button>
      </div>
    </div>
  );
}
