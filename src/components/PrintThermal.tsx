import { fmtDate, money, qty } from "./ui";
import { t } from "../i18n";
import type { Sale, Settings } from "../types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit: "آجل",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

const RECEIPT_FONT = "'Courier New', Courier, monospace";

export function PrintThermal({
  sale,
  settings,
  printerType,
  onClose,
}: {
  sale: Sale;
  settings: Settings;
  printerType: "58mm" | "80mm";
  onClose: () => void;
}) {
  const w = printerType === "58mm" ? 300 : 400;
  const dash = "┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄";

  const base: React.CSSProperties = {
    fontFamily: RECEIPT_FONT,
    fontSize: printerType === "58mm" ? 11 : 12,
    lineHeight: 1.4,
    color: "#000",
    background: "#fff",
    padding: "8px 6px",
    width: `${w}px`,
    margin: "0 auto",
  };

  const center: React.CSSProperties = { textAlign: "center" };
  const right: React.CSSProperties = { textAlign: "right" };
  const bold: React.CSSProperties = { fontWeight: "bold" };
  const small: React.CSSProperties = { fontSize: printerType === "58mm" ? 9 : 10 };
  const line: React.CSSProperties = {
    borderTop: "1px dashed #000",
    margin: "4px 0",
  };
  const row: React.CSSProperties = { display: "flex", justifyContent: "space-between" };
  const label: React.CSSProperties = { color: "#555" };
  const headerCol: React.CSSProperties = {
    fontWeight: "bold",
    borderBottom: "1px solid #000",
    paddingBottom: 2,
  };
  const itemRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "1px 0",
  };

  const qtyCol = printerType === "58mm" ? "30px" : "40px";
  const priceCol = printerType === "58mm" ? "60px" : "75px";
  const nameCol = printerType === "58mm" ? "calc(100% - 150px)" : "calc(100% - 185px)";

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ {t("thermalPrint")}
        </button>
        <button className="btn" onClick={onClose}>
          {t("close")}
        </button>
      </div>

      <div className="print-area" style={{ background: "#e0e0e0", padding: 16, overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ ...base, boxShadow: "0 0 8px rgba(0,0,0,.15)" }}>

          {/* Store Header */}
          <div style={{ ...center, ...bold, fontSize: printerType === "58mm" ? 13 : 14 }}>
            {settings.store_name || "تبارك"}
          </div>
          {settings.phone && (
            <div style={{ ...center, ...small }}>هاتف: {settings.phone}</div>
          )}
          {settings.address && (
            <div style={{ ...center, ...small }}>{settings.address}</div>
          )}

          {/* Dashed separator */}
          <div style={{ ...center, ...small, margin: "4px 0", letterSpacing: 1 }}>{dash}</div>

          {/* Invoice Title */}
          <div style={{ ...center, ...bold, fontSize: printerType === "58mm" ? 12 : 13, margin: "4px 0" }}>
            {t("saleInvoiceTitle")}
          </div>
          <div style={right}>
            <span style={label}>رقم: </span>
            <span style={bold}>{sale.invoice_no}</span>
          </div>

          {/* Meta info */}
          <div style={{ margin: "4px 0", ...small }}>
            <div style={row}>
              <span style={label}>التاريخ:</span>
              <span>{fmtDate(sale.date)}</span>
            </div>
            <div style={row}>
              <span style={label}>العميل:</span>
              <span>{sale.customer_name ?? "نقدي"}</span>
            </div>
            <div style={row}>
              <span style={label}>طريقة الدفع:</span>
              <span>{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</span>
            </div>
            {sale.employee_name && (
              <div style={row}>
                <span style={label}>الموظف:</span>
                <span>{sale.employee_name}</span>
              </div>
            )}
          </div>

          {/* Dashed separator */}
          <div style={line} />
          <div style={{ ...center, ...small, letterSpacing: 1 }}>{dash}</div>

          {/* Items Header */}
          <div style={{ ...itemRow, ...headerCol, ...small, marginBottom: 2 }}>
            <span style={{ width: "20px" }}>#</span>
            <span style={{ width: nameCol }}>الصنف</span>
            <span style={{ width: qtyCol, textAlign: "center" }}>كمية</span>
            <span style={{ width: priceCol, textAlign: "center" }}>سعر</span>
            <span style={{ width: priceCol, textAlign: "left" }}>الإجمالي</span>
          </div>

          {/* Items */}
          {sale.items.map((it, i) => (
            <div key={i} style={{ ...itemRow, ...small, padding: "1px 0" }}>
              <span style={{ width: "20px" }}>{i + 1}</span>
              <span style={{ width: nameCol, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.product_name}
              </span>
              <span style={{ width: qtyCol, textAlign: "center" }}>{qty(it.quantity)}</span>
              <span style={{ width: priceCol, textAlign: "center" }}>{money(it.sell_price)}</span>
              <span style={{ width: priceCol, textAlign: "left" }}>{money(it.total)}</span>
            </div>
          ))}

          {/* Dashed separator */}
          <div style={line} />
          <div style={{ ...center, ...small, letterSpacing: 1 }}>{dash}</div>

          {/* Totals */}
          <div style={{ margin: "4px 0", ...small }}>
            <div style={{ ...row, padding: "1px 0" }}>
              <span style={label}>الإجمالي:</span>
              <span>{money(sale.total)}</span>
            </div>
            <div style={{ ...row, padding: "1px 0" }}>
              <span style={label}>الخصم:</span>
              <span>{money(sale.discount)}</span>
            </div>
            {sale.additional > 0 && (
              <div style={{ ...row, padding: "1px 0" }}>
                <span style={label}>الإضافي:</span>
                <span>{money(sale.additional)}</span>
              </div>
            )}
            <div style={{ ...row, padding: "2px 0", fontWeight: "bold", fontSize: printerType === "58mm" ? 12 : 13, borderTop: "1px solid #000", marginTop: 2 }}>
              <span>الصافي:</span>
              <span>{money(sale.net_total)} {settings.currency}</span>
            </div>
          </div>

          {/* Footer */}
          {settings.invoice_footer && (
            <div style={{ ...center, ...small, margin: "4px 0" }}>{settings.invoice_footer}</div>
          )}

          {/* Dashed separator */}
          <div style={line} />
          <div style={{ ...center, ...small, letterSpacing: 1 }}>{dash}</div>

          {/* Thank you */}
          <div style={{ ...center, ...bold, fontSize: printerType === "58mm" ? 11 : 12, margin: "4px 0" }}>
            {t("thankYou")}
          </div>

        </div>
      </div>
    </div>
  );
}
