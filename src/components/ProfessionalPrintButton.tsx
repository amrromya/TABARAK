import React, { useState, useEffect, useRef } from "react";
import {
  DocType,
  PrintMode,
  getDocumentConfig,
  printDocument,
  generateThermalReceiptHTML,
  generateA4InvoiceHTML,
  listAvailablePrinters,
  ProfessionalPrintSettings,
  getProfessionalPrintSettings,
  PaperSize,
  PrintDocumentConfig,
} from "../utils/printSystem";
import { Sale, Purchase, SaleReturn, PurchaseReturn, Settings } from "../types";
import { t } from "../i18n";

interface ProfessionalPrintButtonProps {
  docType: DocType;
  label?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: boolean;
  disabled?: boolean;
  className?: string;
  data: any;
  settings?: Settings;
  onBeforePrint?: () => void;
  onAfterPrint?: () => void;
  onError?: (err: any) => void;
}

type DocData = Sale | Purchase | SaleReturn | PurchaseReturn | any;

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
    color: "#ffffff",
    border: "1px solid #1e3a5f",
    boxShadow: "0 2px 4px rgba(30, 58, 95, 0.2)",
  },
  secondary: {
    background: "#f3f4f6",
    color: "#1f2937",
    border: "1px solid #d1d5db",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  danger: {
    background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
    color: "#ffffff",
    border: "1px solid #dc2626",
    boxShadow: "0 2px 4px rgba(220, 38, 38, 0.2)",
  },
  ghost: {
    background: "transparent",
    color: "#1e3a5f",
    border: "1px solid transparent",
    boxShadow: "none",
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: "6px 10px", fontSize: "12px", gap: "4px", minHeight: "30px" },
  md: { padding: "8px 14px", fontSize: "13px", gap: "6px", minHeight: "36px" },
  lg: { padding: "10px 18px", fontSize: "15px", gap: "8px", minHeight: "44px" },
};

const buttonBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s ease",
  userSelect: "none",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

function extractDocTitle(docType: DocType, data: DocData): string {
  switch (docType) {
    case "sales_invoice":
      return t("saleInvoiceTitle");
    case "purchase_invoice":
      return t("purchaseInvoice");
    case "sale_return":
      return t("returnInvoiceTitle");
    case "purchase_return":
      return "مردود مشتريات";
    case "receipt_voucher":
      return "سند قبض";
    case "payment_voucher":
      return "سند صرف";
    default:
      return "مستند";
  }
}

function extractInvoiceNo(docType: DocType, data: DocData): string {
  if (data.invoice_no) return String(data.invoice_no);
  if (data.id) return `#${data.id}`;
  if (data.voucher_no) return String(data.voucher_no);
  return "-";
}

function extractDate(data: DocData): string {
  const d = data.date || data.created_at;
  if (!d) return new Date().toLocaleDateString("ar-EG");
  try {
    return new Date(d).toLocaleDateString("ar-EG");
  } catch {
    return String(d);
  }
}

function extractCurrency(settings?: Settings): string {
  return settings?.currency || "ج.م";
}

function buildThermalData(
  docType: DocType,
  data: DocData,
  settings?: Settings
): any {
  const currency = extractCurrency(settings);
  const items = (data.items || []).map((it: any) => ({
    name: it.product_name || it.name || it.item_name || "-",
    qty: it.quantity ?? 1,
    price: it.sell_price ?? it.cost_price ?? it.price ?? 0,
    total: it.total ?? 0,
  }));

  const subtotal = data.total ?? data.subtotal ?? items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const discount = data.discount ?? 0;
  const additional = data.additional ?? 0;
  const tax = data.tax ?? data.tax_total ?? 0;
  const total = data.net_total ?? data.grand_total ?? subtotal - discount + additional + tax;

  const qrData = data.qr_data || data.qrData || undefined;

  return {
    storeName: settings?.store_name,
    phone: settings?.phone,
    address: settings?.address,
    taxNumber: data.tax_number,
    crNumber: data.cr_number,
    invoiceNo: extractInvoiceNo(docType, data),
    date: extractDate(data),
    customerName: data.customer_name || data.supplier_name,
    paymentMethod: data.payment_method,
    employeeName: data.employee_name,
    docTitle: extractDocTitle(docType, data),
    items,
    subtotal,
    discount,
    tax,
    additional,
    total,
    paid: data.paid_amount,
    remaining: data.remaining_amount,
    currency,
    footerText: settings?.invoice_footer,
    thankYouText: t("thankYou"),
    qrData,
    notes: data.notes,
  };
}

function buildA4Data(
  docType: DocType,
  data: DocData,
  settings?: Settings
): any {
  const currency = extractCurrency(settings);
  const items = (data.items || []).map((it: any, idx: number) => ({
    no: idx + 1,
    name: it.product_name || it.name || it.item_name || "-",
    sku: it.sku || it.barcode,
    qty: it.quantity ?? 1,
    unit: it.unit,
    price: it.sell_price ?? it.cost_price ?? it.price ?? 0,
    discount: it.discount,
    total: it.total ?? 0,
  }));

  const subtotal = data.total ?? data.subtotal ?? items.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const discountTotal = data.discount ?? 0;
  const taxTotal = data.tax ?? data.tax_total ?? 0;
  const additionalTotal = data.additional ?? 0;
  const grandTotal = data.net_total ?? data.grand_total ?? subtotal - discountTotal + additionalTotal + taxTotal;

  return {
    storeName: settings?.store_name,
    storeNameEn: undefined,
    logo: undefined,
    phone: settings?.phone,
    address: settings?.address,
    taxNumber: data.tax_number,
    crNumber: data.cr_number,
    website: undefined,
    email: undefined,
    docTitle: extractDocTitle(docType, data),
    docTitleEn: undefined,
    invoiceNo: extractInvoiceNo(docType, data),
    date: extractDate(data),
    dueDate: data.due_date,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    customerAddress: data.customer_address,
    customerTaxNumber: data.customer_tax_number,
    supplierName: data.supplier_name,
    supplierPhone: data.supplier_phone,
    supplierAddress: data.supplier_address,
    employeeName: data.employee_name,
    warehouse: data.warehouse_name,
    paymentMethod: data.payment_method,
    items,
    subtotal,
    discountTotal,
    taxTotal,
    additionalTotal,
    grandTotal,
    paidAmount: data.paid_amount,
    remainingAmount: data.remaining_amount,
    currency,
    notes: data.notes,
    footerText: settings?.invoice_footer,
    signature1: undefined,
    signature2: undefined,
    signature3: undefined,
    qrData: data.qr_data || data.qrData,
  };
}

export default function ProfessionalPrintButton({
  docType,
  label,
  variant = "primary",
  size = "md",
  icon = true,
  disabled = false,
  className,
  data,
  settings,
  onBeforePrint,
  onAfterPrint,
  onError,
}: ProfessionalPrintButtonProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [paperSizeOverride, setPaperSizeOverride] = useState<PaperSize | "">("");
  const [printMode, setPrintMode] = useState<PrintMode>("preview");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cfg = getDocumentConfig(docType);
    setSelectedPrinter(cfg.printer || "");
    setCopies(cfg.copies || 1);
    setPaperSizeOverride("");
    setPrintMode(cfg.mode || "preview");
  }, [docType]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadPrinters = async () => {
    if (loadingPrinters) return;
    setLoadingPrinters(true);
    try {
      const list = await listAvailablePrinters();
      setPrinters(list);
    } catch {
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const getEffectiveConfig = (overrides?: Partial<PrintDocumentConfig>): PrintDocumentConfig => {
    const base = getDocumentConfig(docType);
    return {
      ...base,
      printer: selectedPrinter || base.printer,
      copies,
      paperSize: paperSizeOverride || base.paperSize,
      mode: printMode,
      ...(overrides || {}),
    };
  };

  const generateHTMLForDoc = (): string => {
    const cfg = getEffectiveConfig();
    const ps = paperSizeOverride || cfg.paperSize;
    if (ps === "58mm" || ps === "80mm") {
      const td = buildThermalData(docType, data, settings);
      return generateThermalReceiptHTML(td, ps);
    }
    const ad = buildA4Data(docType, data, settings);
    return generateA4InvoiceHTML(ad);
  };

  const executePrint = async (mode: PrintMode, customConfig?: Partial<PrintDocumentConfig>) => {
    try {
      onBeforePrint?.();
      const html = generateHTMLForDoc();
      const mergedCfg = getEffectiveConfig({ ...(customConfig || {}), mode });
      await printDocument(docType, html, mergedCfg);
      onAfterPrint?.();
    } catch (err) {
      onError?.(err);
    } finally {
      setDropdownOpen(false);
      setOptionsModalOpen(false);
    }
  };

  const handleDirectPrint = () => executePrint("direct");
  const handlePreviewPrint = () => executePrint("preview");

  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  const buttonStyle: React.CSSProperties = {
    ...buttonBaseStyle,
    ...variantStyle,
    ...sizeStyle,
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? "none" : "auto",
  };

  const dropdownStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    minWidth: "240px",
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
    zIndex: 9999,
    overflow: "hidden",
    direction: "rtl",
  };

  const dropdownItemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    fontSize: "13px",
    color: "#1f2937",
    borderBottom: "1px solid #f3f4f6",
    transition: "background 0.1s ease",
    fontWeight: 500,
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }} className={className}>
      <button
        type="button"
        style={buttonStyle}
        disabled={disabled}
        onClick={() => setDropdownOpen((v) => !v)}
        onMouseEnter={(e) => {
          if (!disabled && variant !== "ghost") {
            e.currentTarget.style.filter = "brightness(1.08)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = "";
          e.currentTarget.style.transform = "";
        }}
      >
        {icon && <span style={{ fontSize: size === "sm" ? "14px" : "16px" }}>🖨️</span>}
        <span>{label || t("print")}</span>
        <span style={{ fontSize: "10px", opacity: 0.8 }}>▾</span>
      </button>

      {dropdownOpen && (
        <div style={dropdownStyle}>
          <div
            style={dropdownItemStyle}
            onClick={handleDirectPrint}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <span style={{ fontSize: "16px" }}>🖨️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>طباعة مباشرة</div>
              <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                باستخدام الإعدادات الافتراضية
              </div>
            </div>
          </div>
          <div
            style={dropdownItemStyle}
            onClick={handlePreviewPrint}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <span style={{ fontSize: "16px" }}>👁️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>معاينة قبل الطباعة</div>
              <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                عرض المستند قبل الطباعة
              </div>
            </div>
          </div>
          <div
            style={{ ...dropdownItemStyle, borderBottom: "none" }}
            onClick={() => {
              setDropdownOpen(false);
              setOptionsModalOpen(true);
              loadPrinters();
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f7ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "")}
          >
            <span style={{ fontSize: "16px" }}>📋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>خيارات الطباعة</div>
              <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                اختيار الطابعة والنسخ وحجم الورق
              </div>
            </div>
          </div>
        </div>
      )}

      {optionsModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            direction: "rtl",
            fontFamily: "inherit",
          }}
          onClick={() => setOptionsModalOpen(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              width: "420px",
              maxWidth: "92vw",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "16px 20px",
                background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "16px", fontWeight: 700 }}>⚙️ خيارات الطباعة المتقدمة</div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                  {extractDocTitle(docType, data)} — {extractInvoiceNo(docType, data)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "#fff",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                  🖨️ الطابعة
                </label>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    background: "#fff",
                  }}
                >
                  <option value="">الطابعة الافتراضية للنظام</option>
                  {printers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {!printers.length && (
                  <button
                    type="button"
                    onClick={loadPrinters}
                    disabled={loadingPrinters}
                    style={{
                      marginTop: "6px",
                      fontSize: "11px",
                      color: "#2563eb",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {loadingPrinters ? "جاري التحميل..." : "🔄 تحديث قائمة الطابعات"}
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                    📄 عدد النسخ
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                    📐 حجم الورق
                  </label>
                  <select
                    value={paperSizeOverride}
                    onChange={(e) => setPaperSizeOverride(e.target.value as PaperSize | "")}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "13px",
                      fontFamily: "inherit",
                      background: "#fff",
                    }}
                  >
                    <option value="">افتراضي ({getDocumentConfig(docType).paperSize})</option>
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="80mm">طابعة حرارية 80mm</option>
                    <option value="58mm">طابعة حرارية 58mm</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "#374151" }}>
                  🎯 وضع الطباعة
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {(["direct", "preview", "dialog"] as PrintMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrintMode(m)}
                      style={{
                        padding: "8px 6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        borderRadius: "6px",
                        border: printMode === m ? "2px solid #2563eb" : "1px solid #d1d5db",
                        background: printMode === m ? "#eff6ff" : "#fff",
                        color: printMode === m ? "#1e40af" : "#374151",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {m === "direct" ? "⚡ مباشرة" : m === "preview" ? "👁️ معاينة" : "💬 حوار"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "14px 20px",
                background: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "#fff",
                  color: "#374151",
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => executePrint(printMode)}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 2px 6px rgba(37,99,235,0.3)",
                }}
              >
                🖨️ تنفيذ الطباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
