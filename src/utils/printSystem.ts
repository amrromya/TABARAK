import { api } from "../api";

export type PaperSize = "A4" | "A5" | "80mm" | "58mm" | "custom";
export type Orientation = "portrait" | "landscape";
export type PrintMode = "direct" | "preview" | "dialog";
export type DocType =
  | "sales_invoice"
  | "purchase_invoice"
  | "sale_return"
  | "purchase_return"
  | "receipt_voucher"
  | "payment_voucher"
  | "customer_statement"
  | "supplier_statement"
  | "barcode_label"
  | "report"
  | "inventory_report";

export interface FontSettings {
  family: string;
  size: number;
  headerSize: number;
  titleSize: number;
  bodySize: number;
}

export interface ColorSettings {
  primary: string;
  secondary: string;
  headerBg: string;
  headerText: string;
  border: string;
  text: string;
  muted: string;
}

export interface PrintDocumentConfig {
  printer: string;
  paperSize: PaperSize;
  orientation: Orientation;
  margins: { top: number; right: number; bottom: number; left: number };
  copies: number;
  mode: PrintMode;
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
  font: FontSettings;
  colors: ColorSettings;
  customWidthMm?: number;
  customHeightMm?: number;
  scale?: number;
}

export interface CompanyInfo {
  logo: string;
  nameAr: string;
  nameEn: string;
  taxNumber: string;
  crNumber: string;
  website: string;
  email: string;
  phone: string;
  address: string;
}

export interface HeaderConfig {
  showLogo: boolean;
  showTax: boolean;
  showCR: boolean;
  alignment: "left" | "center" | "right";
  borderStyle: "none" | "solid" | "double" | "dashed";
  borderColor: string;
}

export interface FooterConfig {
  text: string;
  showPageNumbers: boolean;
  signatureLine1: string;
  signatureLine2: string;
  thankYouText: string;
  showSignature: boolean;
}

export interface ThermalConfig {
  width: "58mm" | "80mm";
  fontSize: number;
  lineCharacter: string;
  cutPaper: boolean;
  openDrawer: boolean;
  printQR: boolean;
  dense: boolean;
  beep: boolean;
}

export type BarcodeType = "CODE128" | "EAN13" | "QR_CODE";

export interface BarcodeConfig {
  widthMm: number;
  heightMm: number;
  fontSize: number;
  showName: boolean;
  showPrice: boolean;
  showBarcode: boolean;
  showSku: boolean;
  barcodeType: BarcodeType;
  columnsPerRow: number;
  labelGap: number;
  pageMargin: number;
  fontFamily: string;
  border: boolean;
}

export interface QrConfig {
  enabled: boolean;
  size: number;
  errorCorrection: "L" | "M" | "Q" | "H";
  includeInvoiceData: boolean;
}

export interface ProfessionalPrintSettings {
  defaultPrinter: string;
  documents: Record<DocType, PrintDocumentConfig>;
  companyInfo: CompanyInfo;
  headerConfig: HeaderConfig;
  footerConfig: FooterConfig;
  thermalConfig: ThermalConfig;
  barcodeConfig: BarcodeConfig;
  qrConfig: QrConfig;
}

const STORAGE_KEY = "tabarak_pro_print_settings";

const DEFAULT_FONT: FontSettings = {
  family: "'Segoe UI', 'Cairo', Tahoma, Arial, sans-serif",
  size: 12,
  headerSize: 18,
  titleSize: 14,
  bodySize: 11,
};

const DEFAULT_COLORS: ColorSettings = {
  primary: "#1e3a5f",
  secondary: "#2563eb",
  headerBg: "#1e3a5f",
  headerText: "#ffffff",
  border: "#d1d5db",
  text: "#111827",
  muted: "#6b7280",
};

function makeDefaultDocConfig(
  overrides: Partial<PrintDocumentConfig> = {}
): PrintDocumentConfig {
  return {
    printer: "",
    paperSize: "A4",
    orientation: "portrait",
    margins: { top: 15, right: 15, bottom: 15, left: 15 },
    copies: 1,
    mode: "preview",
    showHeader: true,
    showFooter: true,
    showLogo: true,
    font: { ...DEFAULT_FONT },
    colors: { ...DEFAULT_COLORS },
    ...overrides,
  };
}

const DEFAULT_DOCUMENTS: Record<DocType, PrintDocumentConfig> = {
  sales_invoice: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  purchase_invoice: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  sale_return: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  purchase_return: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  receipt_voucher: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  payment_voucher: makeDefaultDocConfig({
    paperSize: "80mm",
    mode: "direct",
    showHeader: true,
    showFooter: true,
  }),
  customer_statement: makeDefaultDocConfig({
    paperSize: "A4",
    mode: "preview",
    showHeader: true,
    showFooter: true,
  }),
  supplier_statement: makeDefaultDocConfig({
    paperSize: "A4",
    mode: "preview",
    showHeader: true,
    showFooter: true,
  }),
  barcode_label: makeDefaultDocConfig({
    paperSize: "custom",
    mode: "direct",
    showHeader: false,
    showFooter: false,
    showLogo: false,
    customWidthMm: 50,
    customHeightMm: 30,
    margins: { top: 2, right: 2, bottom: 2, left: 2 },
  }),
  report: makeDefaultDocConfig({
    paperSize: "A4",
    mode: "preview",
    showHeader: true,
    showFooter: true,
  }),
  inventory_report: makeDefaultDocConfig({
    paperSize: "A4",
    mode: "preview",
    showHeader: true,
    showFooter: true,
  }),
};

const DEFAULT_SETTINGS: ProfessionalPrintSettings = {
  defaultPrinter: "",
  documents: DEFAULT_DOCUMENTS,
  companyInfo: {
    logo: "",
    nameAr: "مؤسسة تبارك",
    nameEn: "Tabarak Establishment",
    taxNumber: "",
    crNumber: "",
    website: "",
    email: "",
    phone: "",
    address: "",
  },
  headerConfig: {
    showLogo: true,
    showTax: true,
    showCR: true,
    alignment: "center",
    borderStyle: "solid",
    borderColor: "#1e3a5f",
  },
  footerConfig: {
    text: "",
    showPageNumbers: true,
    signatureLine1: "المستلم",
    signatureLine2: "المخزن / المحاسب",
    thankYouText: "شكراً لاختياركم تبارك",
    showSignature: true,
  },
  thermalConfig: {
    width: "80mm",
    fontSize: 10,
    lineCharacter: "─",
    cutPaper: true,
    openDrawer: false,
    printQR: true,
    dense: true,
    beep: false,
  },
  barcodeConfig: {
    widthMm: 50,
    heightMm: 30,
    fontSize: 10,
    showName: true,
    showPrice: true,
    showBarcode: true,
    showSku: false,
    barcodeType: "CODE128",
    columnsPerRow: 3,
    labelGap: 2,
    pageMargin: 5,
    fontFamily: "'Segoe UI', 'Cairo', Tahoma, sans-serif",
    border: false,
  },
  qrConfig: {
    enabled: true,
    size: 80,
    errorCorrection: "M",
    includeInvoiceData: true,
  },
};

function deepMerge<T>(base: T, extra: Partial<T> | undefined | null): T {
  if (!extra) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const k of Object.keys(extra)) {
    const bv = (base as any)[k];
    const ev = (extra as any)[k];
    if (
      ev &&
      typeof ev === "object" &&
      !Array.isArray(ev) &&
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv)
    ) {
      out[k] = deepMerge(bv, ev);
    } else if (ev !== undefined) {
      out[k] = ev;
    }
  }
  return out as T;
}

export function getProfessionalPrintSettings(): ProfessionalPrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...deepMerge(DEFAULT_SETTINGS, parsed),
        documents: (Object.keys(DEFAULT_DOCUMENTS) as DocType[]).reduce(
          (acc, key) => {
            acc[key] = deepMerge(DEFAULT_DOCUMENTS[key], parsed?.documents?.[key]);
            return acc;
          },
          {} as Record<DocType, PrintDocumentConfig>
        ),
      };
    }
  } catch {
    // ignore
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export function saveProfessionalPrintSettings(
  settings: Partial<ProfessionalPrintSettings>
): ProfessionalPrintSettings {
  const current = getProfessionalPrintSettings();
  const next = deepMerge(current, settings);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getDocumentConfig(docType: DocType): PrintDocumentConfig {
  const s = getProfessionalPrintSettings();
  return s.documents[docType] || DEFAULT_DOCUMENTS[docType];
}

export function saveDocumentConfig(
  docType: DocType,
  config: Partial<PrintDocumentConfig>
): PrintDocumentConfig {
  const current = getDocumentConfig(docType);
  const next = deepMerge(current, config);
  const all = getProfessionalPrintSettings();
  all.documents[docType] = next;
  saveProfessionalPrintSettings({ documents: all.documents });
  return next;
}

export async function listAvailablePrinters(): Promise<string[]> {
  try {
    if (api && typeof api.listPrinters === "function") {
      return await api.listPrinters();
    }
  } catch {
    // ignore
  }
  return [];
}

export async function testPagePrint(
  printerName: string,
  paperSize: string
): Promise<void> {
  try {
    if (api && typeof api.testPrint === "function") {
      await api.testPrint(printerName, paperSize);
      return;
    }
  } catch {
    // fallthrough
  }
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>Test Page</title>
    <style>
      body { font-family: 'Cairo', Tahoma, sans-serif; direction: rtl; padding: 40px; text-align: center; }
      h1 { color: #1e3a5f; }
      .box { border: 2px dashed #2563eb; padding: 30px; margin: 20px auto; max-width: 500px; border-radius: 8px; }
      .info { color: #374151; margin: 10px 0; font-size: 14px; }
      .footer { margin-top: 40px; color: #6b7280; font-size: 12px; }
    </style></head><body>
    <div class="box">
      <h1>✅ صفحة اختبار الطباعة</h1>
      <p class="info">الطابعة: <strong>${printerName || "الافتراضية"}</strong></p>
      <p class="info">حجم الورق: <strong>${paperSize}</strong></p>
      <p class="info">نظام الطباعة المحترف - تبارك</p>
      <p class="info">Professional Print System - Tabarak</p>
      <hr style="margin: 20px 0; border-color: #e5e7eb;">
      <p class="info">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</p>
      <p class="info">أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي</p>
    </div>
    <p class="footer">تم الطباعة في: ${new Date().toLocaleString("ar-EG")}</p>
    </body></html>`;
  await printHtmlViaDialog(html, "Test Page");
}

function resolvePrinter(docConfig: PrintDocumentConfig, globalDefault: string): string {
  return docConfig.printer || globalDefault || "";
}

export async function printDocument(
  docType: DocType,
  htmlContent: string,
  customConfig?: Partial<PrintDocumentConfig>
): Promise<void> {
  const globalSettings = getProfessionalPrintSettings();
  const baseConfig = getDocumentConfig(docType);
  const mergedConfig = deepMerge(baseConfig, customConfig);
  const mode = mergedConfig.mode;
  const copies = Math.max(1, mergedConfig.copies || 1);
  const printerName = resolvePrinter(mergedConfig, globalSettings.defaultPrinter);

  if (mode === "direct") {
    await printHtmlDirect(htmlContent, {
      printerName,
      paperSize: mergedConfig.paperSize,
      orientation: mergedConfig.orientation,
      copies,
      margins: mergedConfig.margins,
      customWidthMm: mergedConfig.customWidthMm,
      customHeightMm: mergedConfig.customHeightMm,
      scale: mergedConfig.scale,
    });
    return;
  }

  if (mode === "preview") {
    for (let i = 0; i < copies; i++) {
      await openHtmlPreviewWindow(htmlContent, `${docType}-${i + 1}`);
    }
    return;
  }

  for (let i = 0; i < copies; i++) {
    await printHtmlViaDialog(htmlContent, `${docType}-${i + 1}`);
  }
}

interface DirectPrintOptions {
  printerName: string;
  paperSize: PaperSize;
  orientation: Orientation;
  copies: number;
  margins: { top: number; right: number; bottom: number; left: number };
  customWidthMm?: number;
  customHeightMm?: number;
  scale?: number;
}

async function printHtmlDirect(
  html: string,
  opts: DirectPrintOptions
): Promise<void> {
  try {
    if (api && typeof api.openHtmlInBrowser === "function") {
      await api.openHtmlInBrowser(html, `print-${Date.now()}.html`);
      return;
    }
  } catch {
    // ignore
  }
  await printHtmlViaDialog(html, "direct-fallback");
}

async function openHtmlPreviewWindow(
  html: string,
  title: string
): Promise<void> {
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(
      url,
      `print-preview-${title}-${Date.now()}`,
      "width=900,height=720,resizable=yes,scrollbars=yes"
    );
    if (w) {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }
  } catch {
    // ignore
  }
  await printHtmlViaDialog(html, title);
}

function printHtmlViaDialog(html: string, title: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "1px";
    iframe.style.height = "1px";
    iframe.style.border = "0";
    iframe.title = title;
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      try { document.body.removeChild(iframe); } catch {}
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const tryPrint = () => {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch {
        // ignore
      }
      setTimeout(() => {
        try { document.body.removeChild(iframe); } catch {}
        resolve();
      }, 500);
    };

    const imgCount = doc.images ? doc.images.length : 0;
    if (imgCount === 0) {
      setTimeout(tryPrint, 350);
    } else {
      let loaded = 0;
      const onImg = () => {
        loaded++;
        if (loaded >= imgCount) tryPrint();
      };
      Array.from(doc.images).forEach((img) => {
        if (img.complete) onImg();
        else {
          img.addEventListener("load", onImg);
          img.addEventListener("error", onImg);
        }
      });
      setTimeout(tryPrint, 2500);
    }
  });
}

export interface ThermalReceiptData {
  storeName?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  crNumber?: string;
  invoiceNo: string;
  date: string;
  customerName?: string;
  paymentMethod?: string;
  employeeName?: string;
  docTitle?: string;
  items: { name: string; qty: number | string; price: number | string; total: number | string }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  additional?: number;
  total: number;
  paid?: number;
  remaining?: number;
  currency: string;
  footerText?: string;
  thankYouText?: string;
  qrData?: string;
  notes?: string;
}

export function generateThermalReceiptHTML(
  data: ThermalReceiptData,
  width: "58mm" | "80mm"
): string {
  const settings = getProfessionalPrintSettings();
  const thermal = settings.thermalConfig;
  const company = settings.companyInfo;
  const fontSize = thermal.fontSize;
  const lineChar = thermal.lineCharacter;
  const charsPerLine = width === "80mm" ? 48 : 32;

  const storeName = data.storeName || company.nameAr || "تبارك";
  const phone = data.phone || company.phone || "";
  const address = data.address || company.address || "";
  const taxNumber = data.taxNumber || company.taxNumber || "";
  const crNumber = data.crNumber || company.crNumber || "";
  const thankYou = data.thankYouText || settings.footerConfig.thankYouText || "شكراً لزيارتكم";

  const line = lineChar.repeat(charsPerLine);
  const doubleLine = "═".repeat(charsPerLine);

  const renderRow = (left: string, right: string) => {
    const l = String(left || "");
    const r = String(right || "");
    const maxL = charsPerLine - countPrintableWidth(r) - 2;
    const lp = truncateByWidth(l, Math.max(1, maxL));
    const pad = Math.max(1, charsPerLine - countPrintableWidth(lp) - countPrintableWidth(r));
    return `<div>${escapeHtml(lp)}${" ".repeat(pad)}${escapeHtml(r)}</div>`;
  };

  const rows = data.items.map((it) => {
    const name = String(it.name || "");
    const qty = String(it.qty);
    const price = String(it.price);
    const total = String(it.total);
    const rightSide = `${qty} × ${price} = ${total}`;
    const nameWidth = charsPerLine - countPrintableWidth(rightSide) - 2;
    const nameTrunc = truncateByWidth(name, Math.max(4, nameWidth));
    const pad = Math.max(1, charsPerLine - countPrintableWidth(nameTrunc) - countPrintableWidth(rightSide));
    return `<div>${escapeHtml(nameTrunc)}${" ".repeat(pad)}${escapeHtml(rightSide)}</div>`;
  });

  const qrBlock =
    thermal.printQR && data.qrData
      ? `<div style="text-align:center;margin:10px 0;"><img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=2&data=${encodeURIComponent(
          data.qrData
        )}" style="width:120px;height:120px;image-rendering:pixelated;" /></div>`
      : "";

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>${escapeHtml(data.docTitle || "فاتورة")}</title>
    <style>
      @page { size: ${width}; margin: 2mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; direction: rtl; }
      body {
        font-family: 'Courier New', 'Consolas', monospace;
        font-size: ${fontSize}px;
        line-height: 1.4;
        color: #000;
        background: #fff;
        width: ${width === "80mm" ? "80mm" : "58mm"};
        padding: 2mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .center { text-align: center; }
      .right { text-align: right; }
      .bold { font-weight: bold; }
      .bigger { font-size: ${fontSize + 3}px; font-weight: bold; }
      .line { border-top: 1px dashed #000; margin: 4px 0; }
      .sep { white-space: pre; font-family: 'Courier New', monospace; letter-spacing: 0; }
      .total-row { font-weight: bold; font-size: ${fontSize + 1}px; }
      @media print {
        body { margin: 0; padding: 2mm; }
        @page { margin: 0; size: ${width}; }
      }
    </style></head><body>
    ${company.logo ? `<div class="center" style="margin-bottom:6px;"><img src="${escapeAttr(company.logo)}" style="max-height:24mm;max-width:80%;" alt="logo"/></div>` : ""}
    <div class="center bigger bold">${escapeHtml(storeName)}</div>
    ${phone ? `<div class="center">${escapeHtml(phone)}</div>` : ""}
    ${address ? `<div class="center">${escapeHtml(address)}</div>` : ""}
    ${taxNumber ? `<div class="center">الرقم الضريبي: ${escapeHtml(taxNumber)}</div>` : ""}
    ${crNumber ? `<div class="center">السجل التجاري: ${escapeHtml(crNumber)}</div>` : ""}
    <div class="line"></div>
    ${data.docTitle ? `<div class="center bigger bold">${escapeHtml(data.docTitle)}</div>` : ""}
    <div class="sep">${renderRow("رقم الفاتورة:", data.invoiceNo)}</div>
    <div class="sep">${renderRow("التاريخ:", data.date)}</div>
    ${data.customerName ? `<div class="sep">${renderRow("العميل:", data.customerName)}</div>` : ""}
    ${data.paymentMethod ? `<div class="sep">${renderRow("طريقة الدفع:", data.paymentMethod)}</div>` : ""}
    ${data.employeeName ? `<div class="sep">${renderRow("الموظف:", data.employeeName)}</div>` : ""}
    <div class="line"></div>
    <div class="bold">
      <div class="sep">${renderRow("الصنف", "الكمية × السعر = الإجمالي")}</div>
    </div>
    <div class="line"></div>
    <div class="sep">
      ${rows.join("")}
    </div>
    <div class="line"></div>
    <div class="sep">${renderRow("المجموع الفرعي:", formatCurrency(data.subtotal, data.currency))}</div>
    ${(data.discount ?? 0) > 0 ? `<div class="sep">${renderRow("الخصم:", formatCurrency(-(data.discount || 0), data.currency))}</div>` : ""}
    ${(data.tax ?? 0) > 0 ? `<div class="sep">${renderRow("الضريبة:", formatCurrency(data.tax || 0, data.currency))}</div>` : ""}
    ${(data.additional ?? 0) > 0 ? `<div class="sep">${renderRow("إضافي:", formatCurrency(data.additional || 0, data.currency))}</div>` : ""}
    <div class="line"></div>
    <div class="sep total-row bigger">${renderRow("الإجمالي:", formatCurrency(data.total, data.currency))}</div>
    <div class="line"></div>
    ${data.paid !== undefined ? `<div class="sep">${renderRow("المدفوع:", formatCurrency(data.paid, data.currency))}</div>` : ""}
    ${data.remaining !== undefined ? `<div class="sep total-row">${renderRow("المتبقي:", formatCurrency(data.remaining, data.currency))}</div>` : ""}
    ${qrBlock}
    ${data.notes ? `<div class="line"></div><div><span class="bold">ملاحظات:</span> ${escapeHtml(data.notes)}</div>` : ""}
    ${data.footerText ? `<div class="line"></div><div class="center">${escapeHtml(data.footerText)}</div>` : ""}
    <div class="line"></div>
    <div class="center">${escapeHtml(thankYou)}</div>
    ${thermal.cutPaper ? `<div style="page-break-after:always;"></div>` : ""}
    </body></html>`;
  return html;
}

export interface A4InvoiceData {
  storeName?: string;
  storeNameEn?: string;
  logo?: string;
  phone?: string;
  address?: string;
  taxNumber?: string;
  crNumber?: string;
  website?: string;
  email?: string;
  docTitle: string;
  docTitleEn?: string;
  invoiceNo: string;
  date: string;
  dueDate?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxNumber?: string;
  supplierName?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  employeeName?: string;
  warehouse?: string;
  paymentMethod?: string;
  items: {
    no?: number | string;
    name: string;
    sku?: string;
    qty: number | string;
    unit?: string;
    price: number | string;
    discount?: number | string;
    total: number | string;
  }[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  additionalTotal?: number;
  grandTotal: number;
  paidAmount?: number;
  remainingAmount?: number;
  currency: string;
  notes?: string;
  footerText?: string;
  signature1?: string;
  signature2?: string;
  signature3?: string;
  qrData?: string;
}

export function generateA4InvoiceHTML(data: A4InvoiceData): string {
  const settings = getProfessionalPrintSettings();
  const company = settings.companyInfo;
  const hc = settings.headerConfig;
  const fc = settings.footerConfig;
  const docCfg = settings.documents.sales_invoice;
  const colors = docCfg.colors;
  const font = docCfg.font;

  const storeName = data.storeName || company.nameAr;
  const storeNameEn = data.storeNameEn || company.nameEn;
  const logo = data.logo || company.logo;
  const phone = data.phone || company.phone;
  const address = data.address || company.address;
  const taxNumber = data.taxNumber || company.taxNumber;
  const crNumber = data.crNumber || company.crNumber;
  const website = data.website || company.website;
  const email = data.email || company.email;

  const headerBorder =
    hc.borderStyle === "none"
      ? "none"
      : `2px ${hc.borderStyle} ${hc.borderColor || colors.primary}`;

  const itemsRows = data.items.map((it, idx) => {
    const no = it.no ?? idx + 1;
    return `<tr>
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;">${no}</td>
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:right;">
        <div style="font-weight:600;">${escapeHtml(it.name)}</div>
        ${it.sku ? `<div style="font-size:11px;color:${colors.muted};">SKU: ${escapeHtml(it.sku)}</div>` : ""}
      </td>
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;">${escapeHtml(it.unit || "")}</td>
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;">${it.qty}</td>
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;">${formatCurrency(String(it.price) as any, data.currency)}</td>
      ${
        (data.discountTotal ?? 0) > 0
          ? `<td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;">${
              it.discount !== undefined ? formatCurrency(String(it.discount) as any, data.currency) : "-"
            }</td>`
          : ""
      }
      <td style="padding:8px 6px;border:1px solid ${colors.border};text-align:center;font-weight:600;">${formatCurrency(String(it.total) as any, data.currency)}</td>
    </tr>`;
  });

  const qrBlock =
    settings.qrConfig.enabled && data.qrData
      ? `<div style="text-align:center;margin-top:10px;">
          <img alt="QR" src="https://api.qrserver.com/v1/create-qr-code/?size=${settings.qrConfig.size}x${
            settings.qrConfig.size
          }&margin=2&ecc=${settings.qrConfig.errorCorrection}&data=${encodeURIComponent(data.qrData)}"
          style="width:${settings.qrConfig.size}px;height:${settings.qrConfig.size}px;" />
        </div>`
      : "";

  const signatureLines = fc.showSignature
    ? `<tr>
        <td colspan="2" style="padding:30px 10px 10px;text-align:center;vertical-align:bottom;">
          <div style="border-top:1px solid ${colors.border};display:inline-block;min-width:180px;padding-top:6px;color:${colors.muted};font-size:12px;">
            ${escapeHtml(data.signature1 || fc.signatureLine1 || "التوقيع")}
          </div>
        </td>
        <td colspan="2" style="padding:30px 10px 10px;text-align:center;vertical-align:bottom;">
          <div style="border-top:1px solid ${colors.border};display:inline-block;min-width:180px;padding-top:6px;color:${colors.muted};font-size:12px;">
            ${escapeHtml(data.signature2 || fc.signatureLine2 || "المخزن")}
          </div>
        </td>
        <td colspan="2" style="padding:30px 10px 10px;text-align:center;vertical-align:bottom;">
          <div style="border-top:1px solid ${colors.border};display:inline-block;min-width:180px;padding-top:6px;color:${colors.muted};font-size:12px;">
            ${escapeHtml(data.signature3 || "العميل")}
          </div>
        </td>
      </tr>`
    : "";

  const hasDiscount = (data.discountTotal ?? 0) > 0;
  const extraCols = hasDiscount ? 1 : 0;

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>${escapeHtml(data.docTitle)}</title>
    <style>
      @page { size: A4 ${docCfg.orientation}; margin: ${docCfg.margins.top}mm ${docCfg.margins.right}mm ${docCfg.margins.bottom}mm ${docCfg.margins.left}mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; direction: rtl; }
      body {
        font-family: ${font.family};
        font-size: ${font.bodySize}px;
        color: ${colors.text};
        background: #fff;
        line-height: 1.5;
      }
      .container { width: 100%; max-width: 100%; padding: 0; }
      .invoice-header { border-bottom: ${headerBorder}; padding-bottom: 14px; margin-bottom: 18px; }
      .header-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .logo-block { max-width: 30%; }
      .logo-block img { max-height: 70px; max-width: 100%; }
      .company-block { text-align: ${hc.alignment}; flex: 1; }
      .company-name { font-size: ${font.headerSize}px; font-weight: 700; color: ${colors.primary}; }
      .company-name-en { font-size: ${font.bodySize}px; color: ${colors.muted}; letter-spacing: 0.5px; }
      .company-meta { margin-top: 6px; font-size: 12px; color: ${colors.text}; }
      .company-meta span { margin-left: 14px; }
      .doc-block { text-align: left; min-width: 200px; }
      .doc-title { font-size: ${font.headerSize + 2}px; font-weight: 800; color: #fff; background: ${colors.headerBg}; padding: 8px 14px; border-radius: 4px; display: inline-block; }
      .doc-title-en { font-size: 12px; color: ${colors.muted}; margin-top: 4px; }
      .doc-meta { margin-top: 8px; font-size: 13px; }
      .doc-meta div { margin: 3px 0; }
      .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px; }
      .party { border: 1px solid ${colors.border}; border-radius: 6px; padding: 10px 12px; background: #fafafa; }
      .party h4 { margin: 0 0 6px; font-size: 13px; color: ${colors.primary}; border-bottom: 1px dashed ${colors.border}; padding-bottom: 4px; }
      .party div { margin: 2px 0; font-size: 13px; }
      .party .label { color: ${colors.muted}; display: inline-block; min-width: 80px; }
      .items-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 13px; }
      .items-table thead th { background: ${colors.headerBg}; color: ${colors.headerText}; padding: 9px 6px; font-weight: 600; text-align: center; border: 1px solid ${colors.primary}; }
      .totals-table { width: 100%; max-width: 420px; margin-left: auto; border-collapse: collapse; font-size: 13px; }
      .totals-table td { padding: 7px 10px; border: 1px solid ${colors.border}; }
      .totals-table td.label { background: #f3f4f6; font-weight: 600; width: 55%; }
      .totals-table td.value { text-align: center; font-weight: 600; }
      .totals-table .grand td { background: ${colors.primary}; color: #fff; font-size: 15px; font-weight: 700; }
      .notes { margin-top: 18px; padding: 10px 12px; border: 1px dashed ${colors.border}; border-radius: 4px; background: #fafafa; }
      .notes h4 { margin: 0 0 6px; color: ${colors.primary}; font-size: 13px; }
      .signatures-table { width: 100%; margin-top: 14px; border-collapse: collapse; }
      .invoice-footer { margin-top: 18px; padding-top: 10px; border-top: 1px solid ${colors.border}; font-size: 11px; color: ${colors.muted}; display: flex; justify-content: space-between; gap: 10px; }
      .invoice-footer .thanks { text-align: center; flex: 1; }
      @media print {
        body { margin: 0; }
      }
    </style></head><body>
    <div class="container">
      ${
        docCfg.showHeader
          ? `<div class="invoice-header">
        <div class="header-top">
          ${
            hc.showLogo && logo
              ? `<div class="logo-block"><img src="${escapeAttr(logo)}" alt="logo"/></div>`
              : `<div></div>`
          }
          <div class="company-block">
            <div class="company-name">${escapeHtml(storeName)}</div>
            ${storeNameEn ? `<div class="company-name-en">${escapeHtml(storeNameEn)}</div>` : ""}
            <div class="company-meta">
              ${address ? `<span>📍 ${escapeHtml(address)}</span>` : ""}
              ${phone ? `<span>📞 ${escapeHtml(phone)}</span>` : ""}
              ${email ? `<span>✉️ ${escapeHtml(email)}</span>` : ""}
              ${website ? `<span>🌐 ${escapeHtml(website)}</span>` : ""}
            </div>
            <div class="company-meta">
              ${hc.showTax && taxNumber ? `<span>الرقم الضريبي: <strong>${escapeHtml(taxNumber)}</strong></span>` : ""}
              ${hc.showCR && crNumber ? `<span>السجل التجاري: <strong>${escapeHtml(crNumber)}</strong></span>` : ""}
            </div>
          </div>
          <div class="doc-block">
            <div class="doc-title">${escapeHtml(data.docTitle)}</div>
            ${data.docTitleEn ? `<div class="doc-title-en">${escapeHtml(data.docTitleEn)}</div>` : ""}
            <div class="doc-meta">
              <div><strong>رقم الفاتورة:</strong> ${escapeHtml(data.invoiceNo)}</div>
              <div><strong>التاريخ:</strong> ${escapeHtml(data.date)}</div>
              ${data.dueDate ? `<div><strong>تاريخ الاستحقاق:</strong> ${escapeHtml(data.dueDate)}</div>` : ""}
              ${data.employeeName ? `<div><strong>الموظف:</strong> ${escapeHtml(data.employeeName)}</div>` : ""}
              ${data.warehouse ? `<div><strong>المستودع:</strong> ${escapeHtml(data.warehouse)}</div>` : ""}
              ${data.paymentMethod ? `<div><strong>طريقة الدفع:</strong> ${escapeHtml(data.paymentMethod)}</div>` : ""}
            </div>
          </div>
        </div>
      </div>`
          : ""
      }

      <div class="parties">
        ${
          data.customerName || data.customerPhone || data.customerAddress
            ? `<div class="party">
          <h4>بيانات العميل / Customer</h4>
          ${data.customerName ? `<div><span class="label">الاسم:</span> ${escapeHtml(data.customerName)}</div>` : ""}
          ${data.customerPhone ? `<div><span class="label">الهاتف:</span> ${escapeHtml(data.customerPhone)}</div>` : ""}
          ${data.customerAddress ? `<div><span class="label">العنوان:</span> ${escapeHtml(data.customerAddress)}</div>` : ""}
          ${data.customerTaxNumber ? `<div><span class="label">الرقم الضريبي:</span> ${escapeHtml(data.customerTaxNumber)}</div>` : ""}
        </div>`
            : `<div></div>`
        }
        ${
          data.supplierName || data.supplierPhone || data.supplierAddress
            ? `<div class="party">
          <h4>بيانات المورد / Supplier</h4>
          ${data.supplierName ? `<div><span class="label">الاسم:</span> ${escapeHtml(data.supplierName)}</div>` : ""}
          ${data.supplierPhone ? `<div><span class="label">الهاتف:</span> ${escapeHtml(data.supplierPhone)}</div>` : ""}
          ${data.supplierAddress ? `<div><span class="label">العنوان:</span> ${escapeHtml(data.supplierAddress)}</div>` : ""}
        </div>`
            : `<div></div>`
        }
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width:5%;">م</th>
            <th>الصنف / Description</th>
            <th style="width:7%;">الوحدة</th>
            <th style="width:8%;">الكمية</th>
            <th style="width:12%;">سعر الوحدة</th>
            ${hasDiscount ? `<th style="width:10%;">الخصم</th>` : ""}
            <th style="width:13%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows.join("")}
        </tbody>
      </table>

      <div style="display:flex;gap:14px;align-items:flex-start;">
        <div style="flex:1;">
          ${qrBlock}
        </div>
        <table class="totals-table">
          <tr>
            <td class="label">المجموع الفرعي</td>
            <td class="value">${formatCurrency(data.subtotal, data.currency)}</td>
          </tr>
          ${
            hasDiscount
              ? `<tr><td class="label">إجمالي الخصم</td><td class="value" style="color:#dc2626;">-${formatCurrency(
                  data.discountTotal || 0,
                  data.currency
                )}</td></tr>`
              : ""
          }
          ${
            (data.taxTotal ?? 0) > 0
              ? `<tr><td class="label">الضريبة المضافة</td><td class="value">${formatCurrency(
                  data.taxTotal || 0,
                  data.currency
                )}</td></tr>`
              : ""
          }
          ${
            (data.additionalTotal ?? 0) > 0
              ? `<tr><td class="label">رسوم إضافية</td><td class="value">${formatCurrency(
                  data.additionalTotal || 0,
                  data.currency
                )}</td></tr>`
              : ""
          }
          <tr class="grand">
            <td class="label">الإجمالي النهائي</td>
            <td class="value">${formatCurrency(data.grandTotal, data.currency)}</td>
          </tr>
          ${
            data.paidAmount !== undefined
              ? `<tr><td class="label">المدفوع</td><td class="value">${formatCurrency(
                  data.paidAmount,
                  data.currency
                )}</td></tr>`
              : ""
          }
          ${
            data.remainingAmount !== undefined
              ? `<tr><td class="label" style="background:#fef3c7;">المتبقي</td><td class="value" style="background:#fef3c7;color:#92400e;font-weight:700;">${formatCurrency(
                  data.remainingAmount,
                  data.currency
                )}</td></tr>`
              : ""
          }
        </table>
      </div>

      ${
        data.notes
          ? `<div class="notes"><h4>📝 ملاحظات / Notes</h4><div>${escapeHtml(data.notes).replace(
              /\n/g,
              "<br/>"
            )}</div></div>`
          : ""
      }

      ${
        docCfg.showFooter
          ? `<table class="signatures-table"><tbody>${signatureLines}</tbody></table>
      <div class="invoice-footer">
        ${data.footerText ? `<div>${escapeHtml(data.footerText)}</div>` : fc.text ? `<div>${escapeHtml(fc.text)}</div>` : `<div></div>`}
        <div class="thanks">🙏 ${escapeHtml(fc.thankYouText)}</div>
        ${fc.showPageNumbers ? `<div>صفحة <span class="page-num">1</span></div>` : `<div></div>`}
      </div>`
          : ""
      }
    </div>
    </body></html>`;
  return html;
}

export interface BarcodeLabel {
  name: string;
  barcode: string;
  price?: number | string;
  sku?: string;
  quantity?: number;
}

export function generateBarcodeLabelsHTML(
  labels: BarcodeLabel[],
  customConfig?: Partial<BarcodeConfig>
): string {
  const settings = getProfessionalPrintSettings();
  const config = { ...settings.barcodeConfig, ...(customConfig || {}) };
  const {
    widthMm,
    heightMm,
    fontSize,
    showName,
    showPrice,
    showBarcode,
    showSku,
    columnsPerRow,
    labelGap,
    pageMargin,
    fontFamily,
    border,
    barcodeType,
  } = config;

  const colPct = 100 / columnsPerRow;

  const labelCards = labels.flatMap((lbl) => {
    const qty = Math.max(1, lbl.quantity || 1);
    const cards: string[] = [];
    for (let i = 0; i < qty; i++) {
      const bcSrc =
        barcodeType === "QR_CODE"
          ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(
              lbl.barcode
            )}`
          : `https://bwipjs-api.metafloor.com/?bcid=${
              barcodeType === "EAN13" ? "ean13" : "code128"
            }&text=${encodeURIComponent(lbl.barcode)}&scale=2&height=10&includetext=false&backgroundcolor=ffffff&barcolor=000000`;
      const borderStyle = border ? `1px solid #000;` : "none;";
      const card = `<div style="
        box-sizing:border-box;
        width:${widthMm}mm;
        height:${heightMm}mm;
        margin:0 auto;
        padding:1mm 1.5mm;
        border:${borderStyle}
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        align-items:stretch;
        overflow:hidden;
        font-family:${fontFamily};
        font-size:${fontSize}px;
        line-height:1.15;
        color:#000;
        direction:rtl;
        text-align:center;
        background:#fff;
      ">
        ${
          showName
            ? `<div style="font-weight:600;font-size:${Math.max(
                8,
                fontSize - 1
              )}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(
                lbl.name
              )}</div>`
            : ""
        }
        ${
          showSku && lbl.sku
            ? `<div style="font-size:${Math.max(7, fontSize - 3)}px;color:#333;">SKU: ${escapeHtml(
                lbl.sku
              )}</div>`
            : ""
        }
        ${
          showBarcode
            ? `<div style="flex:1;display:flex;align-items:center;justify-content:center;min-height:0;">
                <img src="${bcSrc}" alt="${escapeAttr(lbl.barcode)}" style="
                  ${
                    barcodeType === "QR_CODE"
                      ? `width:${Math.min(heightMm * 0.6, widthMm * 0.6)}mm;height:${Math.min(
                          heightMm * 0.6,
                          widthMm * 0.6
                        )}mm;`
                      : `max-width:95%;max-height:${Math.max(8, heightMm * 0.55)}mm;`
                  }
                  display:block;image-rendering:pixelated;
                " />
              </div>
              <div style="font-family:'Courier New',monospace;font-size:${Math.max(
                7,
                fontSize - 3
              )}px;letter-spacing:1px;">${escapeHtml(lbl.barcode)}</div>`
            : ""
        }
        ${
          showPrice && lbl.price !== undefined
            ? `<div style="font-weight:700;font-size:${fontSize + 1}px;color:#000;margin-top:1px;">${formatCurrency(
                String(lbl.price) as any,
                getProfessionalPrintSettings().companyInfo?.nameAr
                  ? "ج.م"
                  : "EGP"
              )}</div>`
            : ""
        }
      </div>`;
      cards.push(card);
    }
    return cards;
  });

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>Barcode Labels</title>
    <style>
      @page {
        size: A4;
        margin: ${pageMargin}mm;
      }
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; direction:rtl; }
      body {
        font-family: ${fontFamily};
        background:#fff;
        -webkit-print-color-adjust:exact;
        print-color-adjust:exact;
      }
      .sheet {
        display:grid;
        grid-template-columns: repeat(${columnsPerRow}, 1fr);
        gap: ${labelGap}mm;
        padding: 0;
      }
      .cell {
        display:flex;
        align-items:center;
        justify-content:center;
        width: 100%;
      }
      @media print {
        body { margin: 0; }
        .page-break { page-break-after: always; }
      }
    </style></head><body>
    <div class="sheet">
      ${labelCards
        .map((c) => `<div class="cell">${c}</div>`)
        .join("")}
    </div>
    </body></html>`;
  return html;
}

export interface StatementTransaction {
  date: string;
  reference?: string;
  description: string;
  debit?: number;
  credit?: number;
  balance: number;
  notes?: string;
}

export interface StatementData {
  docTitle: string;
  partyType: "customer" | "supplier";
  partyName: string;
  partyPhone?: string;
  partyAddress?: string;
  partyTaxNumber?: string;
  fromDate: string;
  toDate: string;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  currency: string;
  transactions: StatementTransaction[];
  preparedBy?: string;
  reviewedBy?: string;
  approvedBy?: string;
}

export function generateStatementHTML(data: StatementData): string {
  const settings = getProfessionalPrintSettings();
  const company = settings.companyInfo;
  const docCfg = settings.documents[data.partyType === "customer" ? "customer_statement" : "supplier_statement"];
  const colors = docCfg.colors;
  const font = docCfg.font;

  const rows = data.transactions.map((t, idx) => {
    const balClass =
      t.balance > 0 ? "color:#b91c1c;" : t.balance < 0 ? "color:#047857;" : "";
    return `<tr>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;">${idx + 1}</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;">${escapeHtml(
        t.date
      )}</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;">${escapeHtml(
        t.reference || "-"
      )}</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:right;">${escapeHtml(
        t.description
      )}${t.notes ? `<div style="font-size:11px;color:${colors.muted};">${escapeHtml(t.notes)}</div>` : ""}</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;font-weight:600;color:#b91c1c;">${
        t.debit !== undefined ? formatCurrency(t.debit, data.currency) : "-"
      }</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;font-weight:600;color:#047857;">${
        t.credit !== undefined ? formatCurrency(t.credit, data.currency) : "-"
      }</td>
      <td style="padding:7px 6px;border:1px solid ${colors.border};text-align:center;font-weight:700;${balClass}">${formatCurrency(
        t.balance,
        data.currency
      )}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
    <title>${escapeHtml(data.docTitle)}</title>
    <style>
      @page { size: A4 ${docCfg.orientation}; margin: ${docCfg.margins.top}mm ${docCfg.margins.right}mm ${docCfg.margins.bottom}mm ${docCfg.margins.left}mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin:0; padding:0; direction:rtl; }
      body { font-family: ${font.family}; font-size: ${font.bodySize}px; color:${colors.text}; line-height:1.5; }
      .hdr { display:flex; justify-content:space-between; align-items:center; gap:14px; padding-bottom:12px; border-bottom:2px solid ${colors.primary}; margin-bottom:18px; }
      .logo { max-height:70px; }
      .company { text-align:center; flex:1; }
      .company .name { font-size:${font.headerSize}px; font-weight:700; color:${colors.primary}; }
      .company .meta { font-size:12px; color:${colors.muted}; margin-top:4px; }
      .doc-title-box { text-align:left; }
      .doc-title-box .t { font-size:${font.headerSize + 2}px; font-weight:800; color:#fff; background:${colors.headerBg}; padding:8px 16px; border-radius:4px; display:inline-block; }
      .range { margin-top:6px; font-size:13px; color:${colors.text}; }
      .party-card { border:1px solid ${colors.border}; border-radius:6px; padding:10px 14px; background:#fafafa; margin-bottom:14px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
      .party-card h4 { margin:0 0 4px; font-size:13px; color:${colors.primary}; }
      .summary { display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-bottom:16px; }
      .sum-card { padding:10px 12px; border-radius:6px; color:#fff; text-align:center; }
      .sum-card .label { font-size:12px; opacity:0.9; }
      .sum-card .value { font-size:18px; font-weight:800; margin-top:2px; }
      .tbl { width:100%; border-collapse:collapse; font-size:13px; }
      .tbl thead th { background:${colors.headerBg}; color:${colors.headerText}; padding:9px 6px; font-weight:600; text-align:center; border:1px solid ${colors.primary}; }
      .signatures { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; margin-top:28px; }
      .sig-block { text-align:center; }
      .sig-line { display:inline-block; border-top:1px solid ${colors.border}; min-width:180px; padding-top:8px; color:${colors.muted}; font-size:12px; }
      .footer { margin-top:18px; padding-top:10px; border-top:1px solid ${colors.border}; font-size:11px; color:${colors.muted}; display:flex; justify-content:space-between; }
      @media print { body { margin:0; } }
    </style></head><body>
    <div class="hdr">
      ${company.logo ? `<img class="logo" src="${escapeAttr(company.logo)}" alt="logo"/>` : `<div></div>`}
      <div class="company">
        <div class="name">${escapeHtml(company.nameAr)}</div>
        <div class="meta">${escapeHtml(company.address || "")} | ${escapeHtml(company.phone || "")} | الضريبي: ${escapeHtml(company.taxNumber || "-")}</div>
      </div>
      <div class="doc-title-box">
        <div class="t">${escapeHtml(data.docTitle)}</div>
        <div class="range">الفترة: <strong>${escapeHtml(data.fromDate)}</strong> ← <strong>${escapeHtml(data.toDate)}</strong></div>
      </div>
    </div>

    <div class="party-card">
      <div>
        <h4>${data.partyType === "customer" ? "بيانات العميل" : "بيانات المورد"}</h4>
        <div><strong>الاسم:</strong> ${escapeHtml(data.partyName)}</div>
        ${data.partyPhone ? `<div><strong>الهاتف:</strong> ${escapeHtml(data.partyPhone)}</div>` : ""}
        ${data.partyAddress ? `<div><strong>العنوان:</strong> ${escapeHtml(data.partyAddress)}</div>` : ""}
        ${data.partyTaxNumber ? `<div><strong>الرقم الضريبي:</strong> ${escapeHtml(data.partyTaxNumber)}</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;">
        <div style="text-align:center;">
          <div style="font-size:12px;color:${colors.muted};">تاريخ الطباعة</div>
          <div style="font-weight:600;">${formatDate(new Date().toISOString())}</div>
        </div>
      </div>
      <div style="text-align:left;">
        <div style="font-size:12px;color:${colors.muted};">العملة</div>
        <div style="font-weight:700;font-size:16px;">${escapeHtml(data.currency)}</div>
      </div>
    </div>

    <div class="summary">
      <div class="sum-card" style="background:#4b5563;">
        <div class="label">الرصيد الافتتاحي</div>
        <div class="value">${formatCurrency(data.openingBalance, data.currency)}</div>
      </div>
      <div class="sum-card" style="background:#b91c1c;">
        <div class="label">إجمالي المدين (مدى)</div>
        <div class="value">${formatCurrency(data.totalDebit, data.currency)}</div>
      </div>
      <div class="sum-card" style="background:#047857;">
        <div class="label">إجمالي الدائن (سداد)</div>
        <div class="value">${formatCurrency(data.totalCredit, data.currency)}</div>
      </div>
      <div class="sum-card" style="background:${colors.primary};">
        <div class="label">الرصيد الختامي</div>
        <div class="value">${formatCurrency(data.closingBalance, data.currency)}</div>
      </div>
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th style="width:5%;">م</th>
          <th style="width:12%;">التاريخ</th>
          <th style="width:13%;">المرجع</th>
          <th>البيان</th>
          <th style="width:13%;">مدين</th>
          <th style="width:13%;">دائن</th>
          <th style="width:13%;">الرصيد</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows.join("") : `<tr><td colspan="7" style="padding:20px;text-align:center;color:${colors.muted};border:1px solid ${colors.border};">لا توجد معاملات في الفترة المحددة</td></tr>`}
      </tbody>
    </table>

    <div class="signatures">
      <div class="sig-block"><div class="sig-line">${escapeHtml(data.preparedBy || "أعدها / Prepared by")}</div></div>
      <div class="sig-block"><div class="sig-line">${escapeHtml(data.reviewedBy || "راجعها / Reviewed by")}</div></div>
      <div class="sig-block"><div class="sig-line">${escapeHtml(data.approvedBy || "اعتمدها / Approved by")}</div></div>
    </div>

    <div class="footer">
      <div>نظام إدارة تبارك المحترف</div>
      <div>🙏 ${escapeHtml(settings.footerConfig.thankYouText)}</div>
      <div>صفحة 1 / 1</div>
    </div>
    </body></html>`;
  return html;
}

const ARABIC_DIGIT_MAP: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
};

function toArabicDigits(s: string): string {
  return s.replace(/\d/g, (d) => ARABIC_DIGIT_MAP[d] || d);
}

export function formatCurrency(amount: number | string, currency: string): string {
  const n = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, "")) || 0;
  const fixed = n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${fixed} ${currency}`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

function isArabicChar(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 0x0600 && code <= 0x06ff) || (code >= 0x0750 && code <= 0x077f) || (code >= 0xfb50 && code <= 0xfdff) || (code >= 0xfe70 && code <= 0xfeff);
}

function countPrintableWidth(text: string): number {
  let w = 0;
  for (const ch of text) {
    w += isArabicChar(ch) ? 2 : /[\u1100-\u115f\u2e80-\u9fff\ua000-\ua4cf\uac00-\ud7a3\uf900-\ufaff]/.test(ch) ? 2 : 1;
  }
  return w;
}

export function arabicPad(text: string, length: number, padChar = " "): string {
  const current = countPrintableWidth(text);
  if (current >= length) {
    return truncateByWidth(text, length);
  }
  return text + padChar.repeat(length - current);
}

function truncateByWidth(text: string, maxWidth: number): string {
  let w = 0;
  let out = "";
  for (const ch of text) {
    const cw = isArabicChar(ch) ? 2 : 1;
    if (w + cw > maxWidth) break;
    out += ch;
    w += cw;
  }
  return out;
}

function escapeHtml(str: string | undefined | null): string {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str: string | undefined | null): string {
  return escapeHtml(str);
}
