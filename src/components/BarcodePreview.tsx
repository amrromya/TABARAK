import { useState, useEffect } from "react";
import { generateBarcodePreview, validateBarcode, getPrintSettings, getActiveBarcodeTemplate, type BarcodeType } from "../utils/directPrint";

interface BarcodePreviewProps {
  value: string;
  productName?: string;
  price?: number;
  barcodeType?: BarcodeType;
  showName?: boolean;
  showPrice?: boolean;
  showBarcode?: boolean;
  showStoreName?: boolean;
  storeName?: string;
  width?: number;
  height?: number;
  compact?: boolean;
}

export default function BarcodePreview({
  value,
  productName = "",
  price = 0,
  barcodeType,
  showName,
  showPrice,
  showBarcode,
  showStoreName,
  storeName = "تبارك",
  width,
  height,
  compact = false,
}: BarcodePreviewProps) {
  const [imgSrc, setImgSrc] = useState("");
  const [error, setError] = useState("");
  const settings = getPrintSettings();
  const template = getActiveBarcodeTemplate();

  const type = barcodeType || settings.barcodeType || "CODE128";
  const w = width || template.widthMm;
  const h = height || template.heightMm;
  const sName = showName !== undefined ? showName : template.showName;
  const sPrice = showPrice !== undefined ? showPrice : template.showPrice;
  const sBarcode = showBarcode !== undefined ? showBarcode : template.showBarcode;
  const sStore = showStoreName !== undefined ? showStoreName : template.showStoreName;

  useEffect(() => {
    if (!value) {
      setImgSrc("");
      setError("أدخل قيمة الباركود");
      return;
    }
    const validation = validateBarcode(value, type);
    if (!validation.valid) {
      setImgSrc("");
      setError(validation.error || "باركود غير صالح");
      return;
    }
    setError("");
    generateBarcodePreview(value, type)
      .then(setImgSrc)
      .catch(() => setError("فشل إنشاء الباركود"));
  }, [value, type]);

  if (compact) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: 8, background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0",
        minWidth: 120,
      }}>
        {imgSrc && (
          <img src={imgSrc} alt="barcode" style={{ width: Math.min(w * 2, 160), height: "auto", marginBottom: 4 }} />
        )}
        {error && <span style={{ color: "#ef4444", fontSize: 10 }}>{error}</span>}
        {sBarcode && !error && <span style={{ fontSize: 9, color: "#64748b" }}>{value}</span>}
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: 16, background: "#fff", borderRadius: 12,
      border: "1px solid #e2e8f0", width: w * 3 + 32,
    }}>
      {sStore && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
          {storeName}
        </span>
      )}
      {sName && productName && (
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 8, textAlign: "center" }}>
          {productName}
        </span>
      )}
      {imgSrc ? (
        <img
          src={imgSrc}
          alt="barcode"
          style={{
            width: w * 2.5,
            height: "auto",
            marginBottom: 8,
          }}
        />
      ) : error ? (
        <div style={{
          width: w * 2.5, height: 60,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#fef2f2", borderRadius: 8, border: "1px dashed #fca5a5",
          marginBottom: 8,
        }}>
          <span style={{ color: "#ef4444", fontSize: 11 }}>⚠ {error}</span>
        </div>
      ) : (
        <div style={{
          width: w * 2.5, height: 60,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#f8fafc", borderRadius: 8, marginBottom: 8,
        }}>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>جاري التحميل...</span>
        </div>
      )}
      {sBarcode && !error && (
        <span style={{ fontFamily: "Courier New, monospace", fontSize: 11, color: "#475569", marginBottom: 2 }}>
          {value}
        </span>
      )}
      {sPrice && price > 0 && (
        <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
          {price.toFixed(2)} ج.م
        </span>
      )}
      <span style={{ fontSize: 9, color: "#94a3b8", marginTop: 4 }}>
        {w}×{h}mm · {type}
      </span>
    </div>
  );
}
