import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  ProfessionalPrintSettings,
  DocType,
  PrintMode,
  PaperSize,
  Orientation,
  BarcodeType,
  saveProfessionalPrintSettings,
  testPagePrint,
} from "../utils/printSystem";
import { useToast } from "../components/ui";
import { getPrintSettings, generateBarcodePreview } from "../utils/directPrint";

/* ───────── Constants ───────── */

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

type TabKey =
  | "company"
  | "printers"
  | "invoice"
  | "thermal"
  | "barcode"
  | "headerFooter"
  | "qr";

interface TabDef {
  key: TabKey;
  icon: string;
  label: string;
}

const TABS: TabDef[] = [
  { key: "company", icon: "🏢", label: "معلومات الشركة" },
  { key: "printers", icon: "🖨️", label: "الطابعات" },
  { key: "invoice", icon: "📄", label: "إعدادات الفواتير + معاينة" },
  { key: "thermal", icon: "🔥", label: "الطابعة الحرارية" },
  { key: "barcode", icon: "🏷️", label: "الباركود" },
  { key: "headerFooter", icon: "📋", label: "الرأس والذيل" },
  { key: "qr", icon: "📱", label: "QR Code" },
];

/* ───────── Interfaces ───────── */

interface PrintSettingsCardProps {
  settings: ProfessionalPrintSettings;
  onSettingsChange: (s: ProfessionalPrintSettings) => void;
  availablePrinters: string[];
  onPrintersRefresh: () => void;
}

/* ───────── Component ───────── */

export default function PrintSettingsCard({
  settings,
  onSettingsChange,
  availablePrinters,
  onPrintersRefresh,
}: PrintSettingsCardProps) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("company");
  const [selectedDocType, setSelectedDocType] =
    useState<DocType>("sales_invoice");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"thermal80" | "thermal58" | "a4">(
    "thermal80"
  );
  const [barcodePreviewUrl, setBarcodePreviewUrl] = useState<string>("");

  /* ── Updaters ── */

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

  useEffect(() => {
    let cancelled = false;
    const bc = settings.barcodeConfig;
    generateBarcodePreview("1234567890128", bc.barcodeType as any)
      .then((url) => {
        if (!cancelled) setBarcodePreviewUrl(url);
      })
      .catch(() => {
        if (!cancelled) setBarcodePreviewUrl("");
      });
    return () => { cancelled = true; };
  }, [settings.barcodeConfig.widthMm, settings.barcodeConfig.heightMm, settings.barcodeConfig.barcodeType, settings.barcodeConfig.fontSize]);

  const updateQr = <K extends keyof ProfessionalPrintSettings["qrConfig"]>(
    key: K,
    value: ProfessionalPrintSettings["qrConfig"][K]
  ) => {
    update("qrConfig", { ...settings.qrConfig, [key]: value });
  };

  /* ── Handlers ── */

  const handleSave = async () => {
    try {
      setSaving(true);
      saveProfessionalPrintSettings(settings);
      toast("تم حفظ إعدادات الطباعة بنجاح ✅", "success");
    } catch {
      toast("حدث خطأ أثناء حفظ الإعدادات ❌", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      await testPagePrint(settings.defaultPrinter, "A4");
      toast("تم إرسال صفحة الاختبار للطابعة 🖨️", "success");
    } catch {
      toast("فشل طباعة صفحة الاختبار ❌", "error");
    }
  };

  const currentDoc = settings.documents[selectedDocType];

  /* ── Invoice Preview HTML ── */

  const previewHtml = useMemo(() => {
    const ps = getPrintSettings();
    const paper =
      previewMode === "thermal80"
        ? "80mm"
        : previewMode === "thermal58"
        ? "58mm"
        : "A4";
    const isThermal = paper === "58mm" || paper === "80mm";
    const bodyWidth = paper === "58mm" ? "58mm" : paper === "80mm" ? "80mm" : "210mm";
    const fontSize = ps.receiptFontSize || 10;
    const align = ps.receiptHeaderAlign || "center";
    const pad = isThermal ? "4mm" : "12mm";
    const headerSize = isThermal ? fontSize + 6 : fontSize + 12;
    const titleSize = isThermal ? fontSize + 2 : fontSize + 5;

    const sampleItems = [
      { name: "شاحن لاسلكي", qty: 2, price: 150, total: 300 },
      { name: "كابل USB", qty: 3, price: 45, total: 135 },
      { name: "سماعات بلوتوث", qty: 1, price: 299, total: 299 },
    ];

    const itemsHtml = sampleItems
      .map(
        (it, idx) => `<tr>
        <td style="padding:3px 0;border-bottom:1px solid #eee">${idx + 1}</td>
        <td style="padding:3px 0;border-bottom:1px solid #eee">${it.name}</td>
        <td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:center">${it.qty}</td>
        <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center">${it.price.toFixed(2)}</td>
        <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center;font-weight:700">${it.total.toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const showDate = ps.receiptShowDate !== false;
    const showCustomer = ps.receiptShowCustomer !== false;
    const showPayment = ps.receiptShowPayment !== false;
    const showEmployee = ps.receiptShowEmployee !== false;

    return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: ${bodyWidth} auto; margin: ${isThermal ? "2mm" : "8mm"}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    font-size: ${isThermal ? fontSize : fontSize + 1}px;
    width: ${bodyWidth};
    margin: 0 auto;
    padding: ${pad};
    direction: rtl;
    color: #1a1a2e;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    line-height: 1.5;
  }
  .invoice-box {
    border: ${isThermal ? "none" : `2px solid ${settings.documents.sales_invoice.colors.primary}`};
    border-radius: ${isThermal ? "0" : "12px"};
    padding: ${isThermal ? "2mm" : "8mm"};
    background: #fff;
  }
  .header { text-align: ${align}; margin-bottom: ${isThermal ? "2mm" : "5mm"}; }
  .store-name {
    font-size: ${headerSize}px;
    font-weight: 800;
    color: ${settings.documents.sales_invoice.colors.primary};
    letter-spacing: 1px;
    margin-bottom: 2mm;
  }
  .store-info { font-size: ${isThermal ? fontSize - 2 : fontSize}px; color: #555; line-height: 1.6; }
  .divider {
    border: none;
    border-top: 2px solid ${settings.documents.sales_invoice.colors.primary};
    margin: ${isThermal ? "2mm" : "4mm"} 0;
  }
  .divider-dashed {
    border: none;
    border-top: 1px dashed #ccc;
    margin: ${isThermal ? "1.5mm" : "3mm"} 0;
  }
  .doc-badge {
    display: inline-block;
    background: ${settings.documents.sales_invoice.colors.primary};
    color: #fff;
    padding: ${isThermal ? "1mm 3mm" : "2mm 6mm"};
    border-radius: 6px;
    font-size: ${titleSize}px;
    font-weight: 700;
    margin: ${isThermal ? "1mm 0" : "2mm 0"};
    letter-spacing: 0.5px;
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${isThermal ? "1mm" : "2mm"};
    margin: ${isThermal ? "2mm" : "4mm"} 0;
    font-size: ${isThermal ? fontSize - 1 : fontSize}px;
  }
  .meta-item { display: flex; flex-direction: column; }
  .meta-label { font-size: ${isThermal ? fontSize - 3 : fontSize - 2}px; color: #888; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-value { font-weight: 700; color: #1a1a2e; }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin: ${isThermal ? "2mm" : "4mm"} 0;
    font-size: ${isThermal ? fontSize - 1 : fontSize}px;
  }
  .items-table thead th {
    background: ${settings.documents.sales_invoice.colors.primary};
    color: #fff;
    padding: ${isThermal ? "1.5mm" : "2.5mm"} ${isThermal ? "1mm" : "2mm"};
    font-weight: 700;
    font-size: ${isThermal ? fontSize - 2 : fontSize - 1}px;
    text-align: center;
  }
  .items-table tbody tr:nth-child(even) { background: #f8f9fc; }
  .items-table td { padding: ${isThermal ? "1.5mm" : "2.5mm"} ${isThermal ? "1mm" : "2mm"}; border-bottom: 1px solid #eee; }
  .totals-box {
    margin: ${isThermal ? "2mm" : "5mm"} 0;
    background: #f8f9fc;
    border-radius: ${isThermal ? "0" : "8px"};
    padding: ${isThermal ? "2mm" : "4mm"};
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: ${isThermal ? "0.8mm" : "1.5mm"} 0;
    font-size: ${isThermal ? fontSize - 1 : fontSize}px;
  }
  .total-row.grand {
    font-weight: 800;
    font-size: ${isThermal ? fontSize + 2 : fontSize + 4}px;
    color: ${settings.documents.sales_invoice.colors.primary};
    border-top: 2px solid ${settings.documents.sales_invoice.colors.primary};
    padding-top: ${isThermal ? "2mm" : "3mm"};
    margin-top: ${isThermal ? "1mm" : "2mm"};
  }
  .payment-badge {
    display: inline-block;
    background: #e8f5e9;
    color: #2e7d32;
    padding: ${isThermal ? "1mm 2mm" : "1.5mm 4mm"};
    border-radius: 4px;
    font-size: ${isThermal ? fontSize - 1 : fontSize}px;
    font-weight: 600;
  }
  .footer { text-align: center; margin-top: ${isThermal ? "3mm" : "6mm"}; }
  .footer-line { font-size: ${isThermal ? fontSize - 2 : fontSize - 1}px; color: #888; margin: 1mm 0; }
  .thank-you { font-size: ${isThermal ? fontSize : fontSize + 2}px; font-weight: 800; color: ${settings.documents.sales_invoice.colors.primary}; margin-top: 2mm; }
</style></head><body>
<div class="invoice-box">
  <div class="header">
    ${settings.companyInfo.logo ? `<img src="${settings.companyInfo.logo}" alt="logo" style="max-width:${isThermal ? "30mm" : "40mm"};max-height:${isThermal ? "15mm" : "25mm"};object-fit:contain;margin:0 auto ${isThermal ? "1mm" : "3mm"};display:block;" />` : ""}
    <div class="store-name">${settings.companyInfo.nameAr || "تبارك"}</div>
    <div class="store-info">
      ${settings.companyInfo.phone ? `📞 ${settings.companyInfo.phone}` : ""}
      ${settings.companyInfo.phone && settings.companyInfo.address ? " | " : ""}
      ${settings.companyInfo.address ? `📍 ${settings.companyInfo.address}` : ""}
    </div>
  </div>
  <hr class="divider">
  <div style="text-align:center"><span class="doc-badge">فاتورة بيع</span></div>
  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">رقم الفاتورة</span><span class="meta-value">#10001</span></div>
    ${showDate ? `<div class="meta-item"><span class="meta-label">التاريخ</span><span class="meta-value">2025-01-15</span></div>` : ""}
    ${showCustomer ? `<div class="meta-item"><span class="meta-label">العميل</span><span class="meta-value">أحمد محمد</span></div>` : ""}
    ${showPayment ? `<div class="meta-item"><span class="meta-label">طريقة الدفع</span><span class="meta-value">💵 نقدي</span></div>` : ""}
    ${showEmployee ? `<div class="meta-item"><span class="meta-label">الموظف</span><span class="meta-value">سارة</span></div>` : ""}
  </div>
  <hr class="divider-dashed">
  <table class="items-table">
    <thead><tr>
      <th style="width:8%">#</th>
      <th style="text-align:right;${isThermal ? "" : "width:42%"}">الصنف</th>
      <th style="width:15%">الكمية</th>
      <th style="width:17%">السعر</th>
      <th style="width:18%">الإجمالي</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals-box">
    <div class="total-row"><span>المجموع الفرعي</span><span>734.00</span></div>
    <div class="total-row" style="color:#c62828"><span>الخصم</span><span>-20.00</span></div>
    <div class="total-row grand"><span>الصافي</span><span>714.00 ج.م</span></div>
  </div>
  ${showPayment ? `<div style="text-align:center;margin:2mm 0"><span class="payment-badge">💵 الدفع نقدي</span></div>` : ""}
  <hr class="divider-dashed">
  <div class="footer">
    <div class="thank-you">${ps.receiptThankYouText || "شكراً لاختياركم!"}</div>
    <div class="footer-line" style="margin-top:1mm">تبارك - نظام إدارة المبيعات</div>
  </div>
</div>
</body></html>`;
  }, [previewMode, settings]);

  /* ── Subcomponents ── */

  const renderLabel = (text: string, htmlFor?: string) => (
    <label className="psc-label" htmlFor={htmlFor}>
      {text}
    </label>
  );

  const renderInput = (
    props: React.InputHTMLAttributes<HTMLInputElement> & { id?: string }
  ) => <input className="psc-input" {...props} />;

  const renderSelect = (
    props: React.SelectHTMLAttributes<HTMLSelectElement> & { id?: string }
  ) => <select className="psc-select" {...props} />;

  const renderColorInput = (
    id: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <div className="psc-color-wrap">
      <div
        className="psc-color-swatch"
        style={{ background: value }}
        onClick={() => (document.getElementById(id) as HTMLInputElement)?.click()}
      />
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="psc-color-hidden"
      />
      <input
        type="text"
        className="psc-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ direction: "ltr", textAlign: "left" }}
      />
    </div>
  );

  const renderCheckbox = (
    checked: boolean,
    onChange: (v: boolean) => void,
    label: string
  ) => (
    <label className="psc-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );

  const renderTabs = () => (
    <div className="psc-tabs">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`psc-tab ${activeTab === tab.key ? "psc-tab-active" : ""}`}
          onClick={() => setActiveTab(tab.key)}
        >
          <span className="psc-tab-icon">{tab.icon}</span>
          <span className="psc-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );

  /* ── Tab Contents ── */

  const renderCompanyTab = () => (
    <div className="psc-grid-2">
      <div>
        {renderLabel("شعار الشركة")}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", fontSize: "13px", fontWeight: "600",
            background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
            color: "#fff", borderRadius: "8px", cursor: "pointer",
            boxShadow: "0 2px 6px rgba(30,58,95,0.2)", transition: "all 0.15s",
          }}>
            📁 اختر صورة
            <input
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  updateCompany("logo", ev.target?.result as string);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          {settings.companyInfo.logo && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <img
                src={settings.companyInfo.logo}
                alt="Logo"
                style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "6px", border: "1px solid #e5e7eb" }}
              />
              <button
                type="button"
                style={{
                  padding: "4px 10px", fontSize: "11px", fontWeight: "600",
                  background: "#fee2e2", color: "#dc2626", border: "none",
                  borderRadius: "6px", cursor: "pointer",
                }}
                onClick={() => updateCompany("logo", "")}
              >
                ✕ حذف
              </button>
            </div>
          )}
        </div>
      </div>
      <div>
        {renderLabel("اسم الشركة (عربي)")}
        {renderInput({
          value: settings.companyInfo.nameAr,
          onChange: (e) => updateCompany("nameAr", e.target.value),
          placeholder: "مؤسسة تبارك",
        })}
      </div>
      <div>
        {renderLabel("اسم الشركة (إنجليزي)")}
        {renderInput({
          value: settings.companyInfo.nameEn,
          onChange: (e) => updateCompany("nameEn", e.target.value),
          placeholder: "Tabarak Establishment",
        })}
      </div>
      <div>
        {renderLabel("الرقم الضريبي")}
        {renderInput({
          value: settings.companyInfo.taxNumber,
          onChange: (e) => updateCompany("taxNumber", e.target.value),
          placeholder: "الرقم الضريبي المسجل",
        })}
      </div>
      <div>
        {renderLabel("رقم السجل التجاري")}
        {renderInput({
          value: settings.companyInfo.crNumber,
          onChange: (e) => updateCompany("crNumber", e.target.value),
          placeholder: "رقم السجل التجاري",
        })}
      </div>
      <div>
        {renderLabel("الموقع الإلكتروني")}
        {renderInput({
          value: settings.companyInfo.website,
          onChange: (e) => updateCompany("website", e.target.value),
          placeholder: "https://www.example.com",
        })}
      </div>
      <div>
        {renderLabel("البريد الإلكتروني")}
        {renderInput({
          type: "email",
          value: settings.companyInfo.email,
          onChange: (e) => updateCompany("email", e.target.value),
          placeholder: "info@example.com",
        })}
      </div>
      <div>
        {renderLabel("الهاتف")}
        {renderInput({
          type: "tel",
          value: settings.companyInfo.phone,
          onChange: (e) => updateCompany("phone", e.target.value),
          placeholder: "01xxxxxxxxx",
        })}
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        {renderLabel("العنوان")}
        {renderInput({
          value: settings.companyInfo.address,
          onChange: (e) => updateCompany("address", e.target.value),
          placeholder: "العنوان الكامل للشركة",
        })}
      </div>
    </div>
  );

  const renderPrintersTab = () => (
    <>
      <div className="psc-grid-2">
        <div>
          {renderLabel("الطابعة الافتراضية")}
          {renderSelect({
            value: settings.defaultPrinter,
            onChange: (e) => update("defaultPrinter", e.target.value),
            children: (
              <>
                <option value="">— الافتراضية للنظام —</option>
                {availablePrinters.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </>
            ),
          })}
        </div>
        <div className="psc-btn-row">
          <button className="psc-btn-secondary" onClick={onPrintersRefresh}>
            🔄 تحديث قائمة الطابعات
          </button>
          <button className="psc-btn-secondary" onClick={handleTestPrint}>
            🧪 طباعة صفحة اختبار
          </button>
        </div>
      </div>
      {availablePrinters.length === 0 && (
        <div className="psc-warning">
          ⚠️ لم يتم اكتشاف طابعات. قد تحتاج إلى تثبيت خدمة الطباعة المحلية.
        </div>
      )}

      {/* Document profiles */}
      <div className="psc-divider" />
      <div className="psc-section-title">
        📄 إعدادات أنواع المستندات
      </div>
      <div className="psc-doc-tabs">
        {DOC_TYPES.map((dt) => (
          <button
            key={dt}
            className={`psc-doc-tab ${selectedDocType === dt ? "psc-doc-tab-active" : ""}`}
            onClick={() => setSelectedDocType(dt)}
          >
            {DOC_TYPE_LABELS[dt]}
          </button>
        ))}
      </div>
      <div className="psc-sub-card">
        <div className="psc-sub-title">إعدادات: {DOC_TYPE_LABELS[selectedDocType]}</div>
        <div className="psc-grid-2">
          <div>
            {renderLabel("الطابعة المخصصة")}
            {renderSelect({
              value: currentDoc.printer,
              onChange: (e) => updateDocConfig("printer", e.target.value),
              children: (
                <>
                  <option value="">— الافتراضية —</option>
                  {availablePrinters.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("حجم الورق")}
            {renderSelect({
              value: currentDoc.paperSize,
              onChange: (e) => updateDocConfig("paperSize", e.target.value as PaperSize),
              children: (
                <>
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
                  <option value="80mm">80mm (حرارية)</option>
                  <option value="58mm">58mm (حرارية صغيرة)</option>
                  <option value="custom">مخصص</option>
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("الاتجاه")}
            {renderSelect({
              value: currentDoc.orientation,
              onChange: (e) => updateDocConfig("orientation", e.target.value as Orientation),
              children: (
                <>
                  <option value="portrait">عمودي</option>
                  <option value="landscape">أفقي</option>
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("عدد النسخ (1-99)")}
            {renderInput({
              type: "number",
              min: 1,
              max: 99,
              value: currentDoc.copies,
              onChange: (e) =>
                updateDocConfig("copies", Math.max(1, Math.min(99, parseInt(e.target.value) || 1))),
            })}
          </div>
          <div>
            {renderLabel("وضع الطباعة")}
            {renderSelect({
              value: currentDoc.mode,
              onChange: (e) => updateDocConfig("mode", e.target.value as PrintMode),
              children: (
                <>
                  <option value="direct">🖨️ طباعة مباشرة</option>
                  <option value="preview">👁️ معاينة أولاً</option>
                  <option value="dialog">💬 حوار النظام</option>
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("التكبير/التصغير (50%-200%)")}
            {renderInput({
              type: "number",
              min: 50,
              max: 200,
              value: currentDoc.scale ?? 100,
              onChange: (e) =>
                updateDocConfig("scale", Math.max(50, Math.min(200, parseInt(e.target.value) || 100))),
            })}
          </div>
        </div>
        <div className="psc-checkbox-grid-3">
          {renderCheckbox(currentDoc.showHeader, (v) => updateDocConfig("showHeader", v), "إظهار رأس المستند")}
          {renderCheckbox(currentDoc.showFooter, (v) => updateDocConfig("showFooter", v), "إظهار ذيل المستند")}
          {renderCheckbox(currentDoc.showLogo, (v) => updateDocConfig("showLogo", v), "إظهار الشعار")}
        </div>
        <div className="psc-section-subtitle">📐 الهوامش (mm)</div>
        <div className="psc-grid-4">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div key={side}>
              {renderLabel(side === "top" ? "أعلى" : side === "right" ? "يمين" : side === "bottom" ? "أسفل" : "يسار")}
              {renderInput({
                type: "number",
                min: 0,
                max: 50,
                value: currentDoc.margins[side],
                onChange: (e) => updateDocMargins(side, Math.max(0, parseInt(e.target.value) || 0)),
              })}
            </div>
          ))}
        </div>
        <div className="psc-section-subtitle">🔤 الخطوط والألوان</div>
        <div className="psc-grid-2">
          <div>
            {renderLabel("حجم الخط الأساسي (px)")}
            {renderInput({
              type: "number",
              min: 8,
              max: 24,
              value: currentDoc.font.size,
              onChange: (e) => updateDocFont("size", Math.max(8, parseInt(e.target.value) || 12)),
            })}
          </div>
          <div>
            {renderLabel("اللون الرئيسي")}
            {renderColorInput(
              `primary-color-${selectedDocType}`,
              currentDoc.colors.primary,
              (v) => updateDocColors("primary", v)
            )}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {renderLabel("لون خلفية العنوان")}
            {renderColorInput(
              `headerbg-color-${selectedDocType}`,
              currentDoc.colors.headerBg,
              (v) => updateDocColors("headerBg", v)
            )}
          </div>
        </div>
        {currentDoc.paperSize === "custom" && (
          <>
            <div className="psc-section-subtitle">✂️ أبعاد مخصصة (mm)</div>
            <div className="psc-grid-2">
              <div>
                {renderLabel("العرض")}
                {renderInput({
                  type: "number",
                  min: 20,
                  max: 300,
                  value: currentDoc.customWidthMm ?? 50,
                  onChange: (e) => updateDocConfig("customWidthMm", Math.max(20, parseInt(e.target.value) || 50)),
                })}
              </div>
              <div>
                {renderLabel("الارتفاع")}
                {renderInput({
                  type: "number",
                  min: 10,
                  max: 420,
                  value: currentDoc.customHeightMm ?? 30,
                  onChange: (e) => updateDocConfig("customHeightMm", Math.max(10, parseInt(e.target.value) || 30)),
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );

  const renderInvoiceTab = () => (
    <div className="psc-invoice-layout">
      {/* Left: Settings */}
      <div className="psc-invoice-settings">
        <div className="psc-section-subtitle">🎨 تخصيص القالب</div>
        <div className="psc-grid-2">
          <div>
            {renderLabel("لون الرئيسي")}
            {renderColorInput(
              "receipt-primary-color",
              settings.documents.sales_invoice.colors.primary,
              (v) => {
                const docs = { ...settings.documents };
                (Object.keys(docs) as DocType[]).forEach((dk) => {
                  docs[dk] = { ...docs[dk], colors: { ...docs[dk].colors, primary: v, headerBg: v } };
                });
                update("documents", docs);
              }
            )}
          </div>
          <div>
            {renderLabel("حجم الخط")}
            {renderInput({
              type: "number",
              min: 7,
              max: 20,
              value: getPrintSettings().receiptFontSize || 10,
              onChange: (e) => {
                const v = Math.max(7, Math.min(20, parseInt(e.target.value) || 10));
                const ps = getPrintSettings();
                ps.receiptFontSize = v;
                localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
              },
            })}
          </div>
          <div>
            {renderLabel("محاذاة الرأس")}
            {renderSelect({
              value: getPrintSettings().receiptHeaderAlign || "center",
              onChange: (e) => {
                const ps = getPrintSettings();
                ps.receiptHeaderAlign = e.target.value;
                localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
              },
              children: (
                <>
                  <option value="right">يمين</option>
                  <option value="center">وسط</option>
                  <option value="left">يسار</option>
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("الobraḍ (العرض)")}
            {renderSelect({
              value: getPrintSettings().receiptPrinter || "80mm",
              onChange: (e) => {
                const ps = getPrintSettings();
                ps.receiptPrinter = e.target.value;
                localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
                setPreviewMode(
                  e.target.value === "58mm" ? "thermal58" : e.target.value === "80mm" ? "thermal80" : "a4"
                );
              },
              children: (
                <>
                  <option value="80mm">80mm (حرارية)</option>
                  <option value="58mm">58mm (صغيرة)</option>
                  <option value="A4">A4 (ورقي)</option>
                </>
              ),
            })}
          </div>
        </div>
        <div className="psc-checkbox-grid-2">
          {renderCheckbox(
            getPrintSettings().receiptShowDate !== false,
            (v) => {
              const ps = getPrintSettings();
              ps.receiptShowDate = v;
              localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
            },
            "إظهار التاريخ"
          )}
          {renderCheckbox(
            getPrintSettings().receiptShowCustomer !== false,
            (v) => {
              const ps = getPrintSettings();
              ps.receiptShowCustomer = v;
              localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
            },
            "إظهار اسم العميل"
          )}
          {renderCheckbox(
            getPrintSettings().receiptShowPayment !== false,
            (v) => {
              const ps = getPrintSettings();
              ps.receiptShowPayment = v;
              localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
            },
            "إظهار طريقة الدفع"
          )}
          {renderCheckbox(
            getPrintSettings().receiptShowEmployee !== false,
            (v) => {
              const ps = getPrintSettings();
              ps.receiptShowEmployee = v;
              localStorage.setItem("tabarak_print_settings", JSON.stringify(ps));
            },
            "إظهار الموظف"
          )}
        </div>
        <div className="psc-grid-2" style={{ marginTop: 12 }}>
          <div>
            {renderLabel("رسالة الشكر")}
            {renderInput({
              value: settings.footerConfig.thankYouText,
              onChange: (e) => updateFooter("thankYouText", e.target.value),
              placeholder: "شكراً لاختياركم!",
            })}
          </div>
          <div>
            {renderLabel("نص الذيل")}
            {renderInput({
              value: settings.footerConfig.text,
              onChange: (e) => updateFooter("text", e.target.value),
              placeholder: "نص أسفل الفاتورة",
            })}
          </div>
          <div>
            {renderLabel("شعار الفاتورة")}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "8px 16px", fontSize: "13px", fontWeight: "600",
                background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                color: "#fff", borderRadius: "8px", cursor: "pointer",
                boxShadow: "0 2px 6px rgba(30,58,95,0.2)", transition: "all 0.15s",
              }}>
                📁 اختر صورة
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      updateCompany("logo", ev.target?.result as string);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {settings.companyInfo.logo && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <img
                    src={settings.companyInfo.logo}
                    alt="Logo"
                    style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "6px", border: "1px solid #e5e7eb" }}
                  />
                  <button
                    type="button"
                    style={{
                      padding: "3px 8px", fontSize: "11px", fontWeight: "600",
                      background: "#fee2e2", color: "#dc2626", border: "none",
                      borderRadius: "6px", cursor: "pointer",
                    }}
                    onClick={() => updateCompany("logo", "")}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Preview */}
      <div className="psc-invoice-preview">
        <div className="psc-preview-header">
          <span className="psc-preview-title">🔍 معاينة الفاتورة</span>
          <div className="psc-preview-modes">
            {(["thermal80", "thermal58", "a4"] as const).map((mode) => (
              <button
                key={mode}
                className={`psc-preview-mode ${previewMode === mode ? "psc-preview-mode-active" : ""}`}
                onClick={() => setPreviewMode(mode)}
              >
                {mode === "thermal80" ? "80mm" : mode === "thermal58" ? "58mm" : "A4"}
              </button>
            ))}
          </div>
        </div>
        <div className="psc-preview-frame-wrap">
          <div
            className="psc-preview-frame"
            style={{
              width: previewMode === "thermal80" ? 320 : previewMode === "thermal58" ? 232 : 420,
            }}
          >
            <iframe
              srcDoc={previewHtml}
              className="psc-preview-iframe"
              title="Invoice Preview"
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderThermalTab = () => (
    <div className="psc-grid-2">
      <div>
        {renderLabel("العرض")}
        {renderSelect({
          value: settings.thermalConfig.width,
          onChange: (e) => updateThermal("width", e.target.value as "58mm" | "80mm"),
          children: (
            <>
              <option value="80mm">80mm (قياسي)</option>
              <option value="58mm">58mm (صغير)</option>
            </>
          ),
        })}
      </div>
      <div>
        {renderLabel("حجم الخط (px)")}
        {renderInput({
          type: "number",
          min: 7,
          max: 16,
          value: settings.thermalConfig.fontSize,
          onChange: (e) => updateThermal("fontSize", Math.max(7, parseInt(e.target.value) || 10)),
        })}
      </div>
      <div>
        {renderLabel("حرف الفاصل بين الأعمدة")}
        {renderSelect({
          value: settings.thermalConfig.lineCharacter,
          onChange: (e) => updateThermal("lineCharacter", e.target.value),
          children: (
            <>
              <option value="─">─ خط رفيع</option>
              <option value="━">━ خط سميك</option>
              <option value="=">= علامة =</option>
              <option value="-">- علامة -</option>
              <option value="*">* نجمة</option>
              <option value=".">. نقاط</option>
            </>
          ),
        })}
      </div>
      <div>
        {renderLabel("رسالة شكر أسفل الفاتورة")}
        {renderInput({
          value: settings.footerConfig.thankYouText,
          onChange: (e) => updateFooter("thankYouText", e.target.value),
          placeholder: "شكراً لزيارتكم",
        })}
      </div>
      <div className="psc-checkbox-grid-2" style={{ gridColumn: "1 / -1" }}>
        {renderCheckbox(settings.thermalConfig.cutPaper, (v) => updateThermal("cutPaper", v), "✂️ قص الورق بعد الطباعة")}
        {renderCheckbox(settings.thermalConfig.openDrawer, (v) => updateThermal("openDrawer", v), "💰 فتح درج النقود")}
        {renderCheckbox(settings.thermalConfig.printQR, (v) => updateThermal("printQR", v), "📱 طباعة رمز QR")}
        {renderCheckbox(settings.thermalConfig.dense, (v) => updateThermal("dense", v), "⬛ طباعة مدمجة (غليظة)")}
        {renderCheckbox(settings.thermalConfig.beep, (v) => updateThermal("beep", v), "🔔 صفارة التنبيه")}
      </div>
    </div>
  );

  const renderBarcodeTab = () => {
    const bc = settings.barcodeConfig;
    const scale = 3;
    const previewW = bc.widthMm * scale;
    const fontSizeScaled = Math.max(7, bc.fontSize * 0.8);

    return (
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Settings */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div className="psc-grid-2">
            <div>
              {renderLabel("نوع الباركود")}
              {renderSelect({
                value: bc.barcodeType,
                onChange: (e) => updateBarcode("barcodeType", e.target.value as BarcodeType),
                children: (
                  <>
                    <option value="CODE128">CODE 128</option>
                    <option value="EAN13">EAN-13</option>
                    <option value="QR_CODE">QR Code</option>
                  </>
                ),
              })}
            </div>
            <div>
              {renderLabel("نوع الخط")}
              {renderInput({
                value: bc.fontFamily,
                onChange: (e) => updateBarcode("fontFamily", e.target.value),
                placeholder: "'Segoe UI', 'Cairo', sans-serif",
              })}
            </div>
            <div>
              {renderLabel("عرض الملصق (mm)")}
              {renderInput({
                type: "number",
                min: 20,
                max: 200,
                value: bc.widthMm,
                onChange: (e) => updateBarcode("widthMm", Math.max(20, parseInt(e.target.value) || 38)),
              })}
            </div>
            <div>
              {renderLabel("ارتفاع الملصق (mm)")}
              {renderInput({
                type: "number",
                min: 10,
                max: 200,
                value: bc.heightMm,
                onChange: (e) => updateBarcode("heightMm", Math.max(10, parseInt(e.target.value) || 25)),
              })}
            </div>
            <div>
              {renderLabel("حجم الخط (px)")}
              {renderInput({
                type: "number",
                min: 6,
                max: 20,
                value: bc.fontSize,
                onChange: (e) => updateBarcode("fontSize", Math.max(6, parseInt(e.target.value) || 9)),
              })}
            </div>
            <div>
              {renderLabel("عدد الأعمدة (1-8)")}
              {renderInput({
                type: "number",
                min: 1,
                max: 8,
                value: bc.columnsPerRow,
                onChange: (e) =>
                  updateBarcode("columnsPerRow", Math.max(1, Math.min(8, parseInt(e.target.value) || 3))),
              })}
            </div>
            <div>
              {renderLabel("المسافة بين الملصقات (mm)")}
              {renderInput({
                type: "number",
                min: 0,
                max: 20,
                value: bc.labelGap,
                onChange: (e) => updateBarcode("labelGap", Math.max(0, parseInt(e.target.value) || 2)),
              })}
            </div>
            <div>
              {renderLabel("هوامش الصفحة (mm)")}
              {renderInput({
                type: "number",
                min: 0,
                max: 30,
                value: bc.pageMargin,
                onChange: (e) => updateBarcode("pageMargin", Math.max(0, parseInt(e.target.value) || 5)),
              })}
            </div>
            <div className="psc-checkbox-grid-3" style={{ gridColumn: "1 / -1" }}>
              {renderCheckbox(bc.showName, (v) => updateBarcode("showName", v), "إظهار اسم الصنف")}
              {renderCheckbox(bc.showPrice, (v) => updateBarcode("showPrice", v), "إظهار السعر")}
              {renderCheckbox(bc.showBarcode, (v) => updateBarcode("showBarcode", v), "إظهار الباركود")}
              {renderCheckbox(bc.showSku, (v) => updateBarcode("showSku", v), "إظهار SKU")}
              {renderCheckbox(bc.border, (v) => updateBarcode("border", v), "حدود للملصقات")}
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>👁️</span> معاينة مباشرة
          </div>
          <div style={{
            border: "2px dashed #cbd5e1", borderRadius: 10, padding: 12,
            background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center",
          }}>
            {/* Dimensions label */}
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, fontWeight: 500 }}>
              {bc.widthMm}mm × {bc.heightMm}mm
            </div>
            {/* Label card */}
            <div style={{
              width: Math.min(previewW, 220),
              border: bc.border ? "1.5px solid #334155" : "1px solid #e2e8f0",
              borderRadius: 6, background: "#fff", padding: "6px 8px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              fontFamily: bc.fontFamily || "'Cairo', sans-serif",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}>
              {/* Store name */}
              <div style={{ fontSize: Math.max(7, fontSizeScaled - 2), fontWeight: 700, color: "#1e293b", textAlign: "center", lineHeight: 1.2 }}>
                {settings.companyInfo.nameAr || "اسم المتجر"}
              </div>
              {/* Product name */}
              {bc.showName && (
                <div style={{ fontSize: fontSizeScaled, color: "#334155", textAlign: "center", lineHeight: 1.2, fontWeight: 500 }}>
                  اسم الصنف التجريبي
                </div>
              )}
              {/* Barcode image */}
              {bc.showBarcode && barcodePreviewUrl && (
                <img
                  src={barcodePreviewUrl}
                  alt="barcode"
                  style={{
                    width: "100%",
                    maxWidth: Math.min(previewW - 20, 200),
                    height: "auto",
                    display: "block",
                  }}
                />
              )}
              {bc.showBarcode && !barcodePreviewUrl && (
                <div style={{ width: "100%", height: 30, background: "#f1f5f9", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: "#94a3b8" }}>
                  جاري التحميل...
                </div>
              )}
              {/* Price */}
              {bc.showPrice && (
                <div style={{ fontSize: Math.max(8, fontSizeScaled + 1), fontWeight: 700, color: "#0f766e", textAlign: "center", lineHeight: 1.2 }}>
                  99.99 ج.م
                </div>
              )}
              {/* SKU */}
              {bc.showSku && (
                <div style={{ fontSize: Math.max(6, fontSizeScaled - 3), color: "#94a3b8", textAlign: "center" }}>
                  SKU: 001
                </div>
              )}
            </div>
            {/* Size info */}
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>
              معاينة بألوان {bc.widthMm}×{bc.heightMm}mm
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderHeaderFooterTab = () => (
    <div className="psc-grid-2">
      {/* Header */}
      <div className="psc-sub-card">
        <div className="psc-sub-title">⬆️ رأس المستند (Header)</div>
        <div className="psc-checkbox-stack">
          {renderCheckbox(settings.headerConfig.showLogo, (v) => updateHeader("showLogo", v), "إظهار الشعار")}
          {renderCheckbox(settings.headerConfig.showTax, (v) => updateHeader("showTax", v), "إظهار الرقم الضريبي")}
          {renderCheckbox(settings.headerConfig.showCR, (v) => updateHeader("showCR", v), "إظهار السجل التجاري")}
        </div>
        <div className="psc-grid-2" style={{ marginTop: 12 }}>
          <div>
            {renderLabel("المحاذاة")}
            {renderSelect({
              value: settings.headerConfig.alignment,
              onChange: (e) => updateHeader("alignment", e.target.value as "left" | "center" | "right"),
              children: (
                <>
                  <option value="right">يمين</option>
                  <option value="center">وسط</option>
                  <option value="left">يسار</option>
                </>
              ),
            })}
          </div>
          <div>
            {renderLabel("نمط الحدود")}
            {renderSelect({
              value: settings.headerConfig.borderStyle,
              onChange: (e) =>
                updateHeader("borderStyle", e.target.value as "none" | "solid" | "double" | "dashed"),
              children: (
                <>
                  <option value="none">بدون حدود</option>
                  <option value="solid">خط متصل</option>
                  <option value="double">خط مزدوج</option>
                  <option value="dashed">خط متقطع</option>
                </>
              ),
            })}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {renderLabel("لون الحدود")}
            {renderColorInput("header-border-color", settings.headerConfig.borderColor, (v) =>
              updateHeader("borderColor", v)
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="psc-sub-card">
        <div className="psc-sub-title">⬇️ ذيل المستند (Footer)</div>
        <div className="psc-grid-2">
          <div style={{ gridColumn: "1 / -1" }}>
            {renderLabel("نص مخصص")}
            {renderInput({
              value: settings.footerConfig.text,
              onChange: (e) => updateFooter("text", e.target.value),
              placeholder: "نص إضافي يظهر في أسفل الصفحة",
            })}
          </div>
          <div>
            {renderLabel("اسم توقيع 1")}
            {renderInput({
              value: settings.footerConfig.signatureLine1,
              onChange: (e) => updateFooter("signatureLine1", e.target.value),
              placeholder: "المستلم",
            })}
          </div>
          <div>
            {renderLabel("اسم توقيع 2")}
            {renderInput({
              value: settings.footerConfig.signatureLine2,
              onChange: (e) => updateFooter("signatureLine2", e.target.value),
              placeholder: "المخزن / المحاسب",
            })}
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            {renderLabel("رسالة الشكر")}
            {renderInput({
              value: settings.footerConfig.thankYouText,
              onChange: (e) => updateFooter("thankYouText", e.target.value),
              placeholder: "شكراً لاختياركم تبارك",
            })}
          </div>
        </div>
        <div className="psc-checkbox-stack" style={{ marginTop: 12 }}>
          {renderCheckbox(settings.footerConfig.showPageNumbers, (v) => updateFooter("showPageNumbers", v), "إظهار أرقام الصفحات")}
          {renderCheckbox(settings.footerConfig.showSignature, (v) => updateFooter("showSignature", v), "إظهار منطقة التوقيع")}
        </div>
      </div>
    </div>
  );

  const renderQrTab = () => (
    <div className="psc-grid-2">
      <div>
        {renderLabel("حجم QR (px)")}
        {renderInput({
          type: "number",
          min: 40,
          max: 300,
          value: settings.qrConfig.size,
          onChange: (e) =>
            updateQr("size", Math.max(40, Math.min(300, parseInt(e.target.value) || 80))),
        })}
      </div>
      <div>
        {renderLabel("درجة تصحيح الخطأ")}
        {renderSelect({
          value: settings.qrConfig.errorCorrection,
          onChange: (e) => updateQr("errorCorrection", e.target.value as "L" | "M" | "Q" | "H"),
          children: (
            <>
              <option value="L">L (منخفضة ~7%)</option>
              <option value="M">M (متوسطة ~15%)</option>
              <option value="Q">Q (عالية ~25%)</option>
              <option value="H">H (عالية جداً ~30%)</option>
            </>
          ),
        })}
      </div>
      <div className="psc-checkbox-stack" style={{ gridColumn: "1 / -1" }}>
        {renderCheckbox(settings.qrConfig.enabled, (v) => updateQr("enabled", v), "✅ تفعيل QR Code في الفواتير")}
        {renderCheckbox(settings.qrConfig.includeInvoiceData, (v) => updateQr("includeInvoiceData", v), "📝 تضمين بيانات الفاتورة الكاملة في QR")}
      </div>
    </div>
  );

  /* ── Main Render ── */

  const tabContent: { [K in TabKey]: () => React.ReactNode } = {
    company: renderCompanyTab,
    printers: renderPrintersTab,
    invoice: renderInvoiceTab,
    thermal: renderThermalTab,
    barcode: renderBarcodeTab,
    headerFooter: renderHeaderFooterTab,
    qr: renderQrTab,
  };

  return (
    <div dir="rtl" className="psc-root">
      {renderTabs()}
      <div className="psc-content">{tabContent[activeTab]()}</div>
      <div className="psc-save-bar">
        <button
          className="psc-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "💾 جاري الحفظ..." : "💾 حفظ جميع الإعدادات"}
        </button>
      </div>
    </div>
  );
}
