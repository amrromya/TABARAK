import JsBarcode from "jsbarcode";
import { api } from "../api";

export interface BarcodePrintSettings {
  barcodePrinter: string;
  barcodeWidth: number;
  barcodeHeight: number;
  barcodeFontSize: number;
  barcodeShowName: boolean;
  barcodeShowPrice: boolean;
  barcodeShowBarcode: boolean;
  barcodeShowStoreName: boolean;
}

const DEFAULT_SETTINGS: BarcodePrintSettings = {
  barcodePrinter: "",
  barcodeWidth: 50,
  barcodeHeight: 25,
  barcodeFontSize: 10,
  barcodeShowName: true,
  barcodeShowPrice: true,
  barcodeShowBarcode: true,
  barcodeShowStoreName: true,
};

export function getBarcodeSettings(): BarcodePrintSettings {
  try {
    const raw = localStorage.getItem("tabarak_print_settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function printMaintenanceBarcode({
  barcodeValue,
  orderNo,
  customerName,
  deviceType,
  deviceModel,
  total,
  storeName,
}: {
  barcodeValue: string;
  orderNo: string;
  customerName: string;
  customerPhone?: string | null;
  deviceType: string;
  deviceModel?: string | null;
  complaint?: string | null;
  total: number;
  date: string;
  storeName?: string;
}) {
  const ps = getBarcodeSettings();

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
    return;
  }

  const label = `Order: ${orderNo} | ${customerName} | ${deviceType}${deviceModel ? " " + deviceModel : ""}`;

  try {
    await api.printBarcodeLabel({
      barcodeImageBase64: svgData,
      productName: label,
      barcodeValue,
      price: total,
      storeName: storeName || "تبارك",
      quantity: 1,
      widthMm: ps.barcodeWidth,
      heightMm: ps.barcodeHeight + 20,
      showName: true,
      showPrice: true,
      showBarcode: ps.barcodeShowBarcode,
      showStore: ps.barcodeShowStoreName && !!storeName,
    });
  } catch {
    // fallback: ignore
  }
}
