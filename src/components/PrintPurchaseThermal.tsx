import { fmtDate, money, qty } from "./ui";
import { t } from "../i18n";
import type { Purchase, Settings } from "../types";

export function PrintPurchaseThermal({
  purchase,
  settings,
  printerType,
  onClose,
}: {
  purchase: Purchase;
  settings: Settings;
  printerType: "58mm" | "80mm";
  onClose: () => void;
}) {
  const w = printerType === "58mm" ? 200 : 300;

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ طباعة الإيصال
        </button>
        <button className="btn" onClick={onClose}>
          {t("close")}
        </button>
      </div>

      <div
        className="thermal-receipt print-area"
        style={{
          width: `${w}px`,
          margin: "0 auto",
          fontFamily: "monospace",
          fontSize: printerType === "58mm" ? "11px" : "13px",
          padding: "8px",
          background: "#fff",
          color: "#000",
          lineHeight: 1.6,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "6px" }}>
          <div
            style={{
              fontSize: printerType === "58mm" ? "14px" : "16px",
              fontWeight: "bold",
            }}
          >
            {settings.store_name || "تبارك"}
          </div>
          {settings.phone && (
            <div style={{ fontSize: "11px" }}>{settings.phone}</div>
          )}
          {settings.address && (
            <div style={{ fontSize: "11px" }}>{settings.address}</div>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            fontSize: printerType === "58mm" ? "13px" : "15px",
            fontWeight: "bold",
            margin: "6px 0",
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "4px 0",
          }}
        >
          {t("purchaseReceipt")}
        </div>

        <div style={{ fontSize: "11px", marginBottom: "6px" }}>
          <div>
            {t("date")}: {fmtDate(purchase.date)}
          </div>
          <div>
            {t("supplier")}: {purchase.supplier_name || "—"}
          </div>
          {purchase.warehouse_name && (
            <div>
              {t("warehouse")}: {purchase.warehouse_name}
            </div>
          )}
          {purchase.employee_name && (
            <div>
              {t("employee")}: {purchase.employee_name}
            </div>
          )}
          {purchase.notes && (
            <div>
              {t("notes")}: {purchase.notes}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: "1px dashed #000",
            borderBottom: "1px dashed #000",
            padding: "4px 0",
            marginBottom: "4px",
          }}
        >
          {purchase.items.map((it, i) => (
            <div
              key={i}
              style={{
                marginBottom: "4px",
                fontSize: printerType === "58mm" ? "11px" : "12px",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{it.product_name}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>
                  {qty(it.quantity)} × {money(it.cost_price)}
                </span>
                <span>{money(it.total)}</span>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: "12px",
            borderTop: "1px dashed #000",
            paddingTop: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>{t("total")}:</span>
            <span>{money(purchase.total)}</span>
          </div>
          {purchase.discount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{t("discount")}:</span>
              <span>{money(purchase.discount)}</span>
            </div>
          )}
          {purchase.additional > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>{t("additional")}:</span>
              <span>{money(purchase.additional)}</span>
            </div>
          )}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: printerType === "58mm" ? "13px" : "14px",
              borderTop: "1px dashed #000",
              marginTop: "4px",
              paddingTop: "4px",
            }}
          >
            <span>{t("netTotal")}:</span>
            <span>
              {money(
                purchase.total - purchase.discount + purchase.additional,
              )}{" "}
              {settings.currency}
            </span>
          </div>
        </div>

        {settings.invoice_footer && (
          <div
            style={{
              textAlign: "center",
              marginTop: "8px",
              fontSize: "10px",
              borderTop: "1px dashed #000",
              paddingTop: "4px",
            }}
          >
            {settings.invoice_footer}
          </div>
        )}
      </div>
    </div>
  );
}
