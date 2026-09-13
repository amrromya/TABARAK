import { useState, useEffect, useRef } from "react";
import { listPrinters } from "../utils/directPrint";

const PAPER_SIZES = [
  { value: "58mm", label: "58mm حرارية", width: 58, height: 200 },
  { value: "80mm", label: "80mm حرارية", width: 80, height: 250 },
  { value: "A5", label: "A5", width: 148, height: 210 },
  { value: "A4", label: "A4", width: 210, height: 297 },
];

interface PrintPreviewProps {
  html: string;
  title?: string;
  onClose: () => void;
  onPrint?: (printer: string, copies: number) => void;
  paperSize?: string;
  onPaperSizeChange?: (newPaperSize: string) => void;
}

export default function PrintPreview({ html, title, onClose, onPrint, paperSize: initialPaperSize, onPaperSizeChange }: PrintPreviewProps) {
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [copies, setCopies] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [paperSize, setPaperSize] = useState(initialPaperSize || "80mm");
  const [exporting, setExporting] = useState(false);
  const [currentHtml, setCurrentHtml] = useState(html);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    listPrinters().then(setPrinters).catch(() => {});
  }, []);

  const paperInfo = PAPER_SIZES.find((p) => p.value === paperSize) || PAPER_SIZES[1];
  const isThermal = paperSize === "58mm" || paperSize === "80mm";

  useEffect(() => {
    setCurrentHtml(html);
  }, [html]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(currentHtml);
        doc.close();
      }
    }
  }, [currentHtml]);

  const handlePaperSizeChange = (newSize: string) => {
    setPaperSize(newSize);
    if (onPaperSizeChange) {
      onPaperSizeChange(newSize);
    }
  };

  const handlePrint = async () => {
    if (onPrint) {
      onPrint(selectedPrinter, copies);
      return;
    }
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("print_html_direct", {
        htmlContent: currentHtml,
        printerName: selectedPrinter || "",
        copies: copies,
      });
    } catch (e) {
      console.error("Print failed:", e);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const { save } = await import("@tauri-apps/plugin-dialog");
      const defaultName = `${title || "invoice"}.pdf`;
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) {
        setExporting(false);
        return;
      }
      await invoke("export_pdf_direct", {
        htmlContent: currentHtml,
        title: title || "invoice",
        savePath: savePath,
      });
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  const mmToPx = 3.7795;
  const displayScale = zoom / 100;
  const containerWidthPx = paperInfo.width * mmToPx * displayScale;

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
            <span style={{
              background: isThermal ? "#fef3c7" : "#e0e7ff",
              color: isThermal ? "#92400e" : "#3730a3",
              padding: "2px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            }}>
              {paperInfo.label} {paperInfo.width}×{paperInfo.height}mm
            </span>
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
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, minWidth: 150 }}
          >
            <option value="">الافتراضية</option>
            {printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          <label style={{ fontSize: 12, color: "#475569" }}>المقاس:</label>
          <select
            value={paperSize}
            onChange={(e) => handlePaperSizeChange(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, minWidth: 110 }}
          >
            {PAPER_SIZES.map((ps) => (
              <option key={ps.value} value={ps.value}>{ps.label}</option>
            ))}
          </select>

          <label style={{ fontSize: 12, color: "#475569" }}>النسخ:</label>
          <input
            type="number"
            min={1}
            max={99}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
            style={{ width: 50, padding: "4px 6px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12, textAlign: "center" }}
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
                width: paperInfo.width + "mm",
                height: paperInfo.height + "mm",
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
          display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center",
          background: "#f8fafc",
        }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1",
            background: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 500,
          }}>إلغاء</button>
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "1px solid #cbd5e1",
              background: exporting ? "#f1f5f9" : "#fff", cursor: exporting ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, color: "#1e3a5f",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {exporting ? "⏳ جاري التصدير..." : "📄 تصدير PDF"}
          </button>
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
