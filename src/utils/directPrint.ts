import { api } from "../api";
import type { Settings } from "../types";

export interface PrintSettings {
  receiptPrinter: string;
  invoicePrinter: string;
  barcodePrinter: string;
  invoicePaper: string;
  invoiceLandscape: boolean;
  invoiceMargins: number;
  invoiceHeader: boolean;
  invoiceFooter: boolean;
  invoiceLogo: string;
  warrantyText: string;
  barcodeWidth: number;
  barcodeHeight: number;
  barcodeFontSize: number;
  barcodeShowName: boolean;
  barcodeShowPrice: boolean;
  barcodeShowBarcode: boolean;
  barcodeShowStoreName: boolean;
  receiptFontSize: number;
  receiptPrimaryColor: string;
  receiptShowEmployee: boolean;
  receiptShowPayment: boolean;
  receiptShowDate: boolean;
  receiptShowCustomer: boolean;
  receiptThankYouText: string;
  receiptHeaderAlign: string;
}

const STORAGE_KEY = "tabarak_print_settings";

const DEFAULT_SETTINGS: PrintSettings = {
  receiptPrinter: "A4",
  invoicePrinter: "",
  barcodePrinter: "",
  invoicePaper: "A4",
  invoiceLandscape: false,
  invoiceMargins: 10,
  invoiceHeader: true,
  invoiceFooter: true,
  invoiceLogo: "",
  warrantyText: "",
  barcodeWidth: 50,
  barcodeHeight: 25,
  barcodeFontSize: 10,
  barcodeShowName: true,
  barcodeShowPrice: true,
  barcodeShowBarcode: true,
  barcodeShowStoreName: true,
  receiptFontSize: 10,
  receiptPrimaryColor: "#000000",
  receiptShowEmployee: true,
  receiptShowPayment: true,
  receiptShowDate: true,
  receiptShowCustomer: true,
  receiptThankYouText: "شكراً لاختياركم!",
  receiptHeaderAlign: "center",
};

export function getPrintSettings(): PrintSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function savePrintSettings(settings: Partial<PrintSettings>) {
  const current = getPrintSettings();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...settings }));
}

function getReceiptPrinter(): string {
  const ps = getPrintSettings();
  return ps.invoicePrinter || "";
}

function getBarcodePrinter(): string {
  const ps = getPrintSettings();
  return ps.barcodePrinter || "";
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

// ===== Core Print Functions =====

export async function printTurnNumber(number: number, storeName: string, createdAt: string) {
  await api.printTurnNumber(number, storeName, createdAt, getReceiptPrinter());
}

export async function printSaleReceipt(params: {
  storeName: string; phone: string; address: string; invoiceNo: string;
  date: string; customerName: string; paymentMethod: string; employeeName: string;
  items: { name: string; qty: string; price: string; total: string }[];
  total: number; discount: number; additional: number;
  netTotal: number; currency: string; footer: string;
}) {
  const ps = getPrintSettings();
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
  await api.printSaleReceipt({
    ...params,
    itemsJson: JSON.stringify(params.items),
    printerWidth: width,
    printerName: getReceiptPrinter(),
    templateJson: template,
  });
}

export async function printBarcodeLabel(params: {
  barcodeImageBase64: string; productName: string; barcodeValue: string;
  price: number; storeName: string; quantity: number;
}) {
  const ps = getPrintSettings();
  await api.printBarcodeLabel({
    ...params,
    widthMm: ps.barcodeWidth,
    heightMm: ps.barcodeHeight,
    showName: ps.barcodeShowName,
    showPrice: ps.barcodeShowPrice,
    showBarcode: ps.barcodeShowBarcode,
    showStore: ps.barcodeShowStoreName,
    printerName: getBarcodePrinter(),
  });
}

// ===== Sale Receipt (thermal/A4) =====

export async function printSale(sale: {
  invoice_no: string; date: string; customer_name: string | null;
  payment_method: string; employee_name: string | null;
  items: { product_name: string; item_name?: string | null; quantity: number; sell_price: number; total: number }[];
  total: number; discount: number; additional: number; net_total: number;
}, settings: Settings) {
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
  });
}

// ===== Barcode generation helper =====

export async function generateAndPrintBarcode(product: {
  id: number; name: string; barcode?: string | null; sell_price: number; quantity: number;
}) {
  const ps = getPrintSettings();
  const JsBarcode = (await import("jsbarcode")).default;
  const barcodeValue = product.barcode || String(product.id);
  const storeName = await getStoreName();

  let svgData = "";
  try {
    const canvas = document.createElement("canvas");
    JsBarcode(canvas, barcodeValue, {
      format: "CODE128",
      width: Math.max(1, Math.floor(ps.barcodeWidth / 15)),
      height: Math.min(ps.barcodeHeight * 2, 60),
      displayValue: false,
      margin: 0,
    });
    svgData = canvas.toDataURL("image/png");
  } catch {
    throw new Error("Failed to generate barcode");
  }

  await printBarcodeLabel({
    barcodeImageBase64: svgData,
    productName: product.name,
    barcodeValue,
    price: product.sell_price,
    storeName,
    quantity: product.quantity > 0 ? product.quantity : 1,
  });
}
