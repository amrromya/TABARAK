import { fmtDate, money, qty } from "./ui";
import type { Sale, Settings } from "../types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit: "آجل",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

export function PrintInvoice({
  sale,
  settings,
  invoiceLogo,
  warrantyText,
  onClose,
}: {
  sale: Sale;
  settings: Settings;
  invoiceLogo?: string;
  warrantyText?: string;
  onClose: () => void;
}) {
  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ طباعة الفاتورة
        </button>
        <button className="btn" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div className="invoice print-area">
        <div className="inv-head">
          {invoiceLogo && (
            <img src={invoiceLogo} alt="logo" style={{ maxWidth: 160, maxHeight: 80, marginBottom: 8, display: "block", marginInline: "auto" }} />
          )}
          <h2>{settings.store_name || "تبارك"}</h2>
          {settings.phone && <p>هاتف: {settings.phone}</p>}
          {settings.address && <p>{settings.address}</p>}
        </div>

        <div className="inv-title-row">
          <div className="inv-title">فاتورة بيع</div>
          <div className="inv-no">رقم: {sale.invoice_no}</div>
        </div>

        <div className="inv-meta">
          <div>
            <span>التاريخ: </span>
            <b>{fmtDate(sale.date)}</b>
          </div>
          <div>
            <span>العميل: </span>
            <b>{sale.customer_name ?? "نقدي"}</b>
          </div>
          <div>
            <span>طريقة الدفع: </span>
            <b>{PAYMENT_LABELS[sale.payment_method] ?? sale.payment_method}</b>
          </div>
          {sale.warehouse_name && (
            <div>
              <span>المستودع: </span>
              <b>{sale.warehouse_name}</b>
            </div>
          )}
          {sale.employee_name && (
            <div>
              <span>الموظف: </span>
              <b>{sale.employee_name}</b>
            </div>
          )}
        </div>

        <table className="inv-items">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.product_name}</td>
                <td>{qty(it.quantity)}</td>
                <td>{money(it.sell_price)}</td>
                <td>{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-totals">
          <div>
            <span>الإجمالي:</span>
            <b>{money(sale.total)}</b>
          </div>
          <div>
            <span>الخصم:</span>
            <b>{money(sale.discount)}</b>
          </div>
          {sale.additional > 0 && (
            <div>
              <span>الإضافي:</span>
              <b>{money(sale.additional)}</b>
            </div>
          )}
          <div className="inv-net">
            <span>الصافي:</span>
            <b>
              {money(sale.net_total)} {settings.currency}
            </b>
          </div>
        </div>

        {warrantyText && (
          <div className="inv-warranty" style={{ marginTop: 12, padding: "10px 14px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
            <strong style={{ color: "#111827", fontSize: 13 }}>📋 سياسة الضمان:</strong>
            <br />
            {warrantyText}
          </div>
        )}

        {settings.invoice_footer && (
          <div className="inv-footer">{settings.invoice_footer}</div>
        )}
      </div>
    </div>
  );
}
