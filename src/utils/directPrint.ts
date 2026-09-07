import { api } from "../api";
import type { Settings } from "../types";

// ===== Print Profile Types =====
export type PaperSize = "A4" | "A5" | "80mm" | "58mm" | "custom";
export type Orientation = "portrait" | "landscape";
export type BarcodeType = "CODE128" | "EAN13" | "EAN8" | "UPC_A" | "QR_CODE";

export interface PrintProfile {
  id: string;
  name: string;
  printer: string;
  paperSize: PaperSize;
  orientation: Orientation;
  margins: number;
  scale: number;
  copies: number;
  preview: boolean;
  directPrint: boolean;
  header: boolean;
  footer: boolean;
  showHeader: boolean;
  showFooter: boolean;
}

export interface BarcodeTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  showName: boolean;
  showPrice: boolean;
  showBarcode: boolean;
  showStoreName: boolean;
  showSku: boolean;
  fontSize: number;
  barcodeType: BarcodeType;
  hGap: number;
  vGap: number;
}

export interface PrintSettings {
  // General
  defaultPrinter: string;
  showPrintPreview: boolean;

  // Document printers
  receiptPrinter: string;
  invoicePrinter: string;
  barcodePrinter: string;
  reportPrinter: string;

  // Invoice settings
  invoicePaper: string;
  invoiceLandscape: boolean;
  invoiceMargins: number;
  invoiceHeader: boolean;
  invoiceFooter: boolean;
  invoiceLogo: string;
  warrantyText: string;
  defaultCopies: number;

  // Barcode settings
  barcodeWidth: number;
  barcodeHeight: number;
  barcodeFontSize: number;
  barcodeShowName: boolean;
  barcodeShowPrice: boolean;
  barcodeShowBarcode: boolean;
  barcodeShowStoreName: boolean;
  barcodeType: BarcodeType;
  barcodeDefaultCopies: number;

  // Receipt settings
  receiptFontSize: number;
  receiptPrimaryColor: string;
  receiptShowEmployee: boolean;
  receiptShowPayment: boolean;
  receiptShowDate: boolean;
  receiptShowCustomer: boolean;
  receiptThankYouText: string;
  receiptHeaderAlign: string;

  // Print profiles (for different document types)
  profiles: Record<string, PrintProfile>;

  // Barcode templates
  barcodeTemplates: BarcodeTemplate[];
  activeBarcodeTemplate: string;
}

const STORAGE_KEY = "tabarak_print_settings";

const DEFAULT_PROFILES: Record<string, PrintProfile> = {
  sales_invoice: { id: "sales_invoice", name: "فاتورة مبيعات", printer: "", paperSize: "80mm", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: false, directPrint: true, header: true, footer: true, showHeader: true, showFooter: true },
  purchase_invoice: { id: "purchase_invoice", name: "فاتورة مشتريات", printer: "", paperSize: "80mm", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: false, directPrint: true, header: true, footer: true, showHeader: true, showFooter: true },
  return_invoice: { id: "return_invoice", name: "فاتورة مرتجع", printer: "", paperSize: "80mm", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: false, directPrint: true, header: true, footer: true, showHeader: true, showFooter: true },
  barcode_label: { id: "barcode_label", name: "بطاقة باركود", printer: "", paperSize: "custom", orientation: "portrait", margins: 5, scale: 100, copies: 1, preview: false, directPrint: true, header: false, footer: false, showHeader: false, showFooter: false },
  customer_receipt: { id: "customer_receipt", name: "إيصال عميل", printer: "", paperSize: "80mm", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: false, directPrint: true, header: true, footer: true, showHeader: true, showFooter: true },
  report: { id: "report", name: "تقرير", printer: "", paperSize: "A4", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: true, directPrint: false, header: true, footer: true, showHeader: true, showFooter: true },
  inventory_report: { id: "inventory_report", name: "تقرير مخزون", printer: "", paperSize: "A4", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: true, directPrint: false, header: true, footer: true, showHeader: true, showFooter: true },
  payment_receipt: { id: "payment_receipt", name: "سند دفع/قبض", printer: "", paperSize: "80mm", orientation: "portrait", margins: 10, scale: 100, copies: 1, preview: false, directPrint: true, header: true, footer: true, showHeader: true, showFooter: true },
};

const DEFAULT_TEMPLATES: BarcodeTemplate[] = [
  { id: "default", name: "الافتراضي", widthMm: 50, heightMm: 30, showName: true, showPrice: true, showBarcode: true, showStoreName: true, showSku: false, fontSize: 10, barcodeType: "CODE128", hGap: 2, vGap: 2 },
  { id: "compact", name: "مضغوط", widthMm: 40, heightMm: 25, showName: true, showPrice: true, showBarcode: true, showStoreName: false, showSku: false, fontSize: 8, barcodeType: "CODE128", hGap: 1, vGap: 1 },
  { id: "large", name: "كبير", widthMm: 70, heightMm: 40, showName: true, showPrice: true, showBarcode: true, showStoreName: true, showSku: true, fontSize: 12, barcodeType: "CODE128", hGap: 3, vGap: 3 },
  { id: "price_only", name: "السعر فقط", widthMm: 35, heightMm: 20, showName: false, showPrice: true, showBarcode: true, showStoreName: false, showSku: false, fontSize: 9, barcodeType: "CODE128", hGap: 2, vGap: 2 },
];

const DEFAULT_SETTINGS: PrintSettings = {
  defaultPrinter: "",
  showPrintPreview: false,

  receiptPrinter: "80mm",
  invoicePrinter: "",
  barcodePrinter: "",
  reportPrinter: "",

  invoicePaper: "A4",
  invoiceLandscape: false,
  invoiceMargins: 10,
  invoiceHeader: true,
  invoiceFooter: true,
  invoiceLogo: "",
  warrantyText: "",
  defaultCopies: 1,

  barcodeWidth: 50,
  barcodeHeight: 25,
  barcodeFontSize: 10,
  barcodeShowName: true,
  barcodeShowPrice: true,
  barcodeShowBarcode: true,
  barcodeShowStoreName: true,
  barcodeType: "CODE128",
  barcodeDefaultCopies: 1,

  receiptFontSize: 10,
  receiptPrimaryColor: "#000000",
  receiptShowEmployee: true,
  receiptShowPayment: true,
  receiptShowDate: true,
  receiptShowCustomer: true,
  receiptThankYouText: "شكراً لاختياركم!",
  receiptHeaderAlign: "center",

  profiles: DEFAULT_PROFILES,
  barcodeTemplates: DEFAULT_TEMPLATES,
  activeBarcodeTemplate: "default",
};

// ===== Settings Management =====

export function getPrintSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        profiles: { ...DEFAULT_PROFILES, ...(parsed.profiles || {}) },
        barcodeTemplates: parsed.barcodeTemplates?.length ? parsed.barcodeTemplates : DEFAULT_TEMPLATES,
      };
    }
  } catch {}
  return DEFAULT_SETTINGS;
}

export function savePrintSettings(settings: Partial<PrintSettings>) {
  const current = getPrintSettings();
  const next = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getProfile(profileId: string): PrintProfile {
  const ps = getPrintSettings();
  return ps.profiles[profileId] || DEFAULT_PROFILES.sales_invoice;
}

export function saveProfile(profile: PrintProfile) {
  const ps = getPrintSettings();
  ps.profiles[profile.id] = profile;
  savePrintSettings({ profiles: ps.profiles });
}

export function getActiveBarcodeTemplate(): BarcodeTemplate {
  const ps = getPrintSettings();
  return ps.barcodeTemplates.find((t) => t.id === ps.activeBarcodeTemplate) || DEFAULT_TEMPLATES[0];
}

export function saveBarcodeTemplate(template: BarcodeTemplate) {
  const ps = getPrintSettings();
  const idx = ps.barcodeTemplates.findIndex((t) => t.id === template.id);
  if (idx >= 0) {
    ps.barcodeTemplates[idx] = template;
  } else {
    ps.barcodeTemplates.push(template);
  }
  savePrintSettings({ barcodeTemplates: ps.barcodeTemplates });
}

export function deleteBarcodeTemplate(templateId: string) {
  const ps = getPrintSettings();
  ps.barcodeTemplates = ps.barcodeTemplates.filter((t) => t.id !== templateId);
  if (ps.activeBarcodeTemplate === templateId) {
    ps.activeBarcodeTemplate = "default";
  }
  savePrintSettings({ barcodeTemplates: ps.barcodeTemplates, activeBarcodeTemplate: ps.activeBarcodeTemplate });
}

// ===== Printer Helpers =====

function getReceiptPrinter(): string {
  const ps = getPrintSettings();
  return ps.invoicePrinter || "";
}

function getBarcodePrinter(): string {
  const ps = getPrintSettings();
  return ps.barcodePrinter || "";
}

function getPrinterForProfile(profileId: string): string {
  const profile = getProfile(profileId);
  return profile.printer || getPrintSettings().defaultPrinter || "";
}

export function getReceiptWidth(): "58mm" | "80mm" {
  const ps = getPrintSettings();
  const rp = ps.receiptPrinter;
  if (rp === "58mm" || rp === "80mm") return rp;
  return "80mm";
}

export async function getStoreName(): Promise<string> {
  try {
    const s = await api.getSettings();
    return s.store_name || "تبارك";
  } catch {
    return "تبارك";
  }
}

// ===== Printer Discovery =====

export async function listPrinters(): Promise<string[]> {
  try {
    return await api.listPrinters();
  } catch {
    return [];
  }
}

export async function testPrint(printerName: string, paperSize: string): Promise<void> {
  await api.testPrint(printerName, paperSize);
}

// ===== Core Print Functions =====

export async function printTurnNumber(number: number, storeName: string, createdAt: string) {
  const printer = getPrinterForProfile("customer_receipt");
  await api.printTurnNumber(number, storeName, createdAt, printer);
}

export async function printSaleReceipt(params: {
  storeName: string; phone: string; address: string; invoiceNo: string;
  date: string; customerName: string; paymentMethod: string; employeeName: string;
  items: { name: string; qty: string; price: string; total: string }[];
  total: number; discount: number; additional: number;
  netTotal: number; currency: string; footer: string; docType?: string;
  profileId?: string;
}) {
  const ps = getPrintSettings();
  const profileId = params.profileId || "sales_invoice";
  const profile = getProfile(profileId);
  const width = getReceiptWidth();
  const template = JSON.stringify({
    fontSize: ps.receiptFontSize || 10,
    primaryColor: ps.receiptPrimaryColor || "#000000",
    showEmployee: ps.receiptShowEmployee !== false,
    showPayment: ps.receiptShowPayment !== false,
    showDate: ps.receiptShowDate !== false,
    showCustomer: ps.receiptShowCustomer !== false,
    thankYouText: ps.receiptThankYouText || "شكراً لاختياركم!",
    headerAlign: ps.receiptHeaderAlign || "center",
  });
  const printerName = params.profileId ? getPrinterForProfile(profileId) : getReceiptPrinter();
  const docType = params.docType || (profileId === "return_invoice" ? "RETURN" : profileId === "purchase_invoice" ? "PURCHASE" : "SALE INVOICE");

  for (let i = 0; i < (profile.copies || 1); i++) {
    await api.printSaleReceipt({
      ...params,
      itemsJson: JSON.stringify(params.items),
      printerWidth: width,
      printerName,
      templateJson: template,
      docType,
    });
  }
}

export async function printBarcodeLabel(params: {
  barcodeImageBase64: string; productName: string; barcodeValue: string;
  price: number; storeName: string; quantity: number;
}) {
  const template = getActiveBarcodeTemplate();
  const printerName = getBarcodePrinter();
  const qty = Math.max(params.quantity, 1);

  await api.printBarcodeLabel({
    ...params,
    quantity: qty,
    widthMm: template.widthMm,
    heightMm: template.heightMm,
    showName: template.showName,
    showPrice: template.showPrice,
    showBarcode: template.showBarcode,
    showStore: template.showStoreName,
    printerName,
  });
}

// ===== Sale Receipt (thermal/A4) =====

export async function printSale(sale: {
  invoice_no: string; date: string; customer_name: string | null;
  payment_method: string; employee_name: string | null;
  items: { product_name: string; item_name?: string | null; quantity: number; sell_price: number; total: number }[];
  total: number; discount: number; additional: number; net_total: number;
  doc_type?: string;
}, settings: Settings, profileId?: string) {
  const ps = getPrintSettings();
  const items = sale.items
    .filter((it) => !(it.sell_price === 0 && !it.item_name))
    .map((it) => ({
      name: (it.item_name || it.product_name).substring(0, 20),
      qty: String(it.quantity),
      price: it.sell_price.toFixed(2),
      total: it.total.toFixed(2),
    }));

  await printSaleReceipt({
    storeName: settings.store_name || "تبارك",
    phone: settings.phone || "",
    address: settings.address || "",
    invoiceNo: sale.invoice_no,
    date: sale.date,
    customerName: sale.customer_name ?? "نقدي",
    paymentMethod: sale.payment_method,
    employeeName: sale.employee_name || "",
    items,
    total: sale.total,
    discount: sale.discount,
    additional: sale.additional || 0,
    netTotal: sale.net_total,
    currency: settings.currency || "ج.م",
    footer: ps.invoiceFooter ? (settings.invoice_footer || "") : "",
    docType: sale.doc_type || "SALE INVOICE",
    profileId: profileId || "sales_invoice",
  });
}

// ===== Barcode generation =====

export async function generateBarcodeImage(value: string, type?: BarcodeType): Promise<string> {
  const ps = getPrintSettings();
  const barcodeType = type || ps.barcodeType || "CODE128";
  const template = getActiveBarcodeTemplate();

  const formatMap: Record<string, string> = {
    "CODE128": "CODE128",
    "EAN13": "EAN13",
    "EAN8": "EAN8",
    "UPC_A": "UPC_A",
    "QR_CODE": "QR_CODE",
  };

  const JsBarcode = (await import("jsbarcode")).default;
  const canvas = document.createElement("canvas");

  if (barcodeType === "QR_CODE") {
    const QRCode = (await import("qrcode")).default;
    await QRCode.toCanvas(canvas, value, {
      width: template.widthMm * 3,
      margin: 1,
    });
  } else {
    JsBarcode(canvas, value, {
      format: formatMap[barcodeType] || "CODE128",
      width: Math.max(1, Math.floor(template.widthMm / 15)),
      height: Math.min(template.heightMm * 2, 60),
      displayValue: false,
      margin: 0,
    });
  }

  return canvas.toDataURL("image/png");
}

export async function generateAndPrintBarcode(product: {
  id: number; name: string; barcode?: string | null; sell_price: number; quantity: number; sku?: string | null;
}) {
  const barcodeValue = product.barcode || String(product.id);
  const storeName = await getStoreName();

  const svgData = await generateBarcodeImage(barcodeValue);

  await printBarcodeLabel({
    barcodeImageBase64: svgData,
    productName: product.name,
    barcodeValue,
    price: product.sell_price,
    storeName,
    quantity: product.quantity > 0 ? product.quantity : 1,
  });
}

// ===== Barcode Preview (for UI) =====

export async function generateBarcodePreview(value: string, type?: BarcodeType): Promise<string> {
  return generateBarcodeImage(value, type);
}

// ===== Barcode Validation =====

export function validateBarcode(value: string, type: BarcodeType): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { valid: false, error: "رقم الباركود مطلوب" };
  }

  switch (type) {
    case "EAN13":
      if (!/^\d{12,13}$/.test(value)) {
        return { valid: false, error: "EAN-13 يجب أن يحتوي على 12 أو 13 رقم" };
      }
      break;
    case "EAN8":
      if (!/^\d{7,8}$/.test(value)) {
        return { valid: false, error: "EAN-8 يجب أن يحتوي على 7 أو 8 أرقام" };
      }
      break;
    case "UPC_A":
      if (!/^\d{11,12}$/.test(value)) {
        return { valid: false, error: "UPC-A يجب أن يحتوي على 11 أو 12 رقم" };
      }
      break;
    case "CODE128":
    case "QR_CODE":
    default:
      if (value.length > 80) {
        return { valid: false, error: "القيمة طويلة جداً للباركود" };
      }
      break;
  }

  return { valid: true };
}

// ===== Print from HTML (for reports, statements, etc.) =====

export function printHtml(html: string, _title?: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-9999px";
  iframe.style.left = "-9999px";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 500);
}
