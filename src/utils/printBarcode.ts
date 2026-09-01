import JsBarcode from "jsbarcode";

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

export function printMaintenanceBarcode({
  barcodeValue,
  orderNo,
  customerName,
  customerPhone,
  deviceType,
  deviceModel,
  complaint,
  total,
  date,
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
  const showStore = ps.barcodeShowStoreName && storeName;

  // Generate barcode image via canvas
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
    // Fallback: no barcode image
  }

  const storeLineH = showStore ? 10 : 0;
  const totalH =
    ps.barcodeHeight +
    storeLineH +
    (ps.barcodeShowName ? 12 : 0) +
    (ps.barcodeShowPrice ? 8 : 0);

  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;left:-9999px;width:1px;height:1px;border:none";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    document.body.removeChild(frame);
    return;
  }

  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      @page{size:${ps.barcodeWidth}mm ${totalH}mm;margin:0}
      *{margin:0;padding:0;box-sizing:border-box}
      body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:'Segoe UI',system-ui,sans-serif}
      .box{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px}
      .title{font-size:${ps.barcodeFontSize + 3}px;font-weight:800;color:#0f172a;margin-bottom:2px}
      .store{font-size:${ps.barcodeFontSize + 1}px;font-weight:600;color:#333}
      .num{font-size:${ps.barcodeFontSize + 4}px;font-weight:800;letter-spacing:2px;color:#0f8a5f;margin:4px 0}
      .info{font-size:${ps.barcodeFontSize - 1}px;color:#333;margin:1px 0}
      .code{font-size:9px;color:#666;letter-spacing:1px}
      .price{font-size:${ps.barcodeFontSize}px;font-weight:700;color:#0f8a5f;margin-top:4px}
      .date{font-size:${ps.barcodeFontSize - 2}px;color:#999;margin-top:2px}
      img{display:block}
    </style></head><body>
    <div class="box">
      ${showStore ? `<div class="store">${storeName}</div>` : ""}
      <div class="title">تبارك — صيانة</div>
      <div class="num">${orderNo}</div>
      ${svgData ? `<img src="${svgData}" />` : ""}
      ${ps.barcodeShowBarcode ? `<div class="code">${barcodeValue}</div>` : ""}
      ${ps.barcodeShowName ? `<div class="info">العميل: ${customerName}</div>` : ""}
      ${customerPhone ? `<div class="info">الهاتف: ${customerPhone}</div>` : ""}
      <div class="info">الجهاز: ${deviceType} ${deviceModel || ""}</div>
      ${complaint ? `<div class="info" style="font-size:${ps.barcodeFontSize - 2}px;color:#666">${complaint.length > 40 ? complaint.slice(0, 40) + "..." : complaint}</div>` : ""}
      ${ps.barcodeShowPrice ? `<div class="price">${total.toFixed(2)} ج.م</div>` : ""}
      <div class="date">${date}</div>
    </div>
  </body></html>`);
  doc.close();

  const tryPrint = (attempt: number) => {
    try {
      frame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(frame), 1000);
    } catch {
      if (attempt < 5) setTimeout(() => tryPrint(attempt + 1), 300);
      else document.body.removeChild(frame);
    }
  };
  setTimeout(() => tryPrint(0), 500);
}
