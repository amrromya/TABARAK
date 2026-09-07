import { api } from "../api";
import { getPrintSettings, generateBarcodeImage, getActiveBarcodeTemplate, getStoreName } from "./directPrint";

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

export function getBarcodeSettings(): BarcodePrintSettings {
  const ps = getPrintSettings();
  const template = getActiveBarcodeTemplate();
  return {
    barcodePrinter: ps.barcodePrinter,
    barcodeWidth: template.widthMm,
    barcodeHeight: template.heightMm,
    barcodeFontSize: template.fontSize,
    barcodeShowName: template.showName,
    barcodeShowPrice: template.showPrice,
    barcodeShowBarcode: template.showBarcode,
    barcodeShowStoreName: template.showStoreName,
  };
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
  const ps = getPrintSettings();
  const template = getActiveBarcodeTemplate();
  const svgData = await generateBarcodeImage(barcodeValue);
  const label = `Order: ${orderNo} | ${customerName} | ${deviceType}${deviceModel ? " " + deviceModel : ""}`;

  try {
    await api.printBarcodeLabel({
      barcodeImageBase64: svgData,
      productName: label,
      barcodeValue,
      price: total,
      storeName: storeName || (await getStoreName()),
      quantity: 1,
      widthMm: template.widthMm,
      heightMm: template.heightMm + 20,
      showName: true,
      showPrice: true,
      showBarcode: template.showBarcode,
      showStore: template.showStoreName && !!storeName,
      printerName: ps.barcodePrinter || "",
    });
  } catch {
    // fallback: ignore
  }
}
