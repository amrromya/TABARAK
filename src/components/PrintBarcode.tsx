import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export interface BarcodeCard {
  name: string;
  barcode: string;
  price?: number;
}

export function PrintBarcode({
  cards,
  storeName,
  onClose,
}: {
  cards: BarcodeCard[];
  storeName: string;
  onClose: () => void;
}) {
  const refs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    cards.forEach((c, i) => {
      const el = refs.current[i];
      if (!el) return;
      try {
        JsBarcode(el, c.barcode || "000000", {
          format: "CODE128",
          width: 2,
          height: 50,
          displayValue: false,
          margin: 2,
        });
      } catch {
        /* ignore */
      }
    });
  }, [cards]);

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ طباعة الباركود
        </button>
        <button className="btn" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div className="barcode-sheet print-area">
        {(storeName || "").trim() && (
          <div className="bc-sheet-head no-print">{storeName}</div>
        )}
        {cards.length === 0 && (
          <div className="hint" style={{ padding: 30, textAlign: "center" }}>
            لا توجد أصناف في الفاتورة لطباعة باركودها
          </div>
        )}
        {cards.map((c, i) => (
          <div key={i} className="bc-card">
            <div className="bc-store">{storeName || ""}</div>
            <div className="bc-name">{c.name}</div>
            <canvas
              className="bc-canvas"
              ref={(el) => {
                refs.current[i] = el;
              }}
            />
            <div className="bc-code">{c.barcode || "—"}</div>
            {c.price != null && <div className="bc-price">{c.price} ج.م</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
