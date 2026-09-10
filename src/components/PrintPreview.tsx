import { useState, useEffect, useRef } from "react";
import { listPrinters } from "../utils/directPrint";

interface PrintPreviewProps {
  html: string;
  title?: string;
  onClose: () => void;
  onPrint?: (printer: string, copies: number) => void;
  paperSize?: string;
}

export default function PrintPreview({ html, title, onClose, onPrint, paperSize }: PrintPreviewProps) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [zoom, setZoom] = useState(100);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    listPrinters().then(setPrinters).catch(() => {});
  }, []);

  const isThermal = paperSize === "58mm" || paperSize === "80mm";

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        const style = doc.createElement("style");
        style.textContent = `
          @media print {
            @page { size: ${paperSize || "80mm"} auto; margin: ${isThermal ? "2mm" : "10mm"}; }
            body { width: ${paperSize || "80mm"}; margin: 0; padding: ${isThermal ? "2mm" : "8mm"}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `;
        doc.head.appendChild(style);
      }
    }
  }, [html, paperSize, isThermal]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint(selectedPrinter, copies);
      return;
    }
    // Open HTML in a new window and print from there (works in Tauri)
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const isA5 = paperSize === "A5";

  // Paper dimensions in mm for display container
  const paperMmWidth = paperSize === "58mm" ? 58 : paperSize === "80mm" ? 80 : isA5 ? 148 : 210;
  const paperMmHeight = paperSize === "58mm" ? 200 : paperSize === "80mm" ? 250 : isA5 ? 210 : 297;

  // Scale: mm to px at 96DPI (1mm ≈ 3.7795px), then apply zoom
  const mmToPx = 3.7795;
  const displayScale = zoom / 100;

  const containerWidthPx = paperMmWidth * mmToPx * displayScale;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.6)", display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, width: "95vw", height: "95vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 20px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#f8fafc",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
              {title || "معاينة الطباعة"}
            </h3>
            {paperSize && (
              <span style={{
                background: isThermal ? "#fef3c7" : "#e0e7ff",
                color: isThermal ? "#92400e" : "#3730a3",
                padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              }}>
                {paperSize} {paperMmWidth}×{paperMmHeight}mm
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 22, cursor: "pointer",
            color: "#64748b", padding: 4,
          }}>✕</button>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: "8px 20px", borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
          background: "#f1f5f9",
        }}>
          <label style={{ fontSize: 12, color: "#475569" }}>الطابعة:</label>
          <select
            value={selectedPrinter}
            onChange={(e) => setSelectedPrinter(e.target.value)}
            style={{
              padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1",
              fontSize: 12, minWidth: 150,
            }}
          >
            <option value="">الافتراضية</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <label style={{ fontSize: 12, color: "#475569" }}>النسخ:</label>
          <input
            type="number"
            min={1}
            max={99}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            style={{
              width: 50, padding: "4px 6px", borderRadius: 6,
              border: "1px solid #cbd5e1", fontSize: 12, textAlign: "center",
            }}
          />

          <div style={{ flex: 1 }} />

          <label style={{ fontSize: 12, color: "#475569" }}>التكبير:</label>
          <button
            onClick={() => setZoom(Math.max(25, zoom - 25))}
            style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #cbd5e1", cursor: "pointer", fontSize: 12, background: "#fff" }}
          >−</button>
          <span style={{ fontSize: 12, color: "#475569", minWidth: 40, textAlign: "center" }}>{zoom}%</span>
          <button
            onClick={() => setZoom(Math.min(300, zoom + 25))}
            style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #cbd5e1", cursor: "pointer", fontSize: 12, background: "#fff" }}
          >+</button>
        </div>

        {/* Preview Area */}
        <div style={{
          flex: 1, overflow: "auto", background: "#64748b",
          display: "flex", justifyContent: "center", alignItems: "flex-start",
          padding: 24,
        }}>
          {/* Paper sheet container */}
          <div style={{
            background: "#fff",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
            borderRadius: isThermal ? 2 : 4,
            overflow: "hidden",
            width: containerWidthPx,
            minWidth: containerWidthPx,
            flexShrink: 0,
          }}>
            <iframe
              ref={iframeRef}
              title="print-preview"
              style={{
                width: paperMmWidth + "mm",
                height: paperMmHeight + "mm",
                border: "none",
                display: "block",
              }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid #e2e8f0",
          display: "flex", gap: 8, justifyContent: "flex-end",
          background: "#f8fafc",
        }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1",
            background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>إلغاء</button>
          <button onClick={handlePrint} style={{
            padding: "8px 20px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#fff",
            cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>🖨️ طباعة</button>
        </div>
      </div>
    </div>
  );
}
