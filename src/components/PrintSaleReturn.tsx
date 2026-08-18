import { fmtDate, money, qty } from "./ui";
import type { SaleReturn, Settings } from "../types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit: "آجل",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

export function PrintSaleReturn({
  saleReturn,
  settings,
  onClose,
}: {
  saleReturn: SaleReturn;
  settings: Settings;
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
          <h2>{settings.store_name || "تبارك"}</h2>
          {settings.phone && <p>هاتف: {settings.phone}</p>}
          {settings.address && <p>{settings.address}</p>}
        </div>

        <div className="inv-title-row">
          <div className="inv-title">مردود مبيعات</div>
          <div className="inv-no">رقم: {saleReturn.invoice_no}</div>
        </div>

        <div className="inv-meta">
          <div>
            <span>التاريخ: </span>
            <b>{fmtDate(saleReturn.date)}</b>
          </div>
          <div>
            <span>العميل: </span>
            <b>{saleReturn.customer_name ?? "—"}</b>
          </div>
          <div>
            <span>طريقة الدفع: </span>
            <b>{PAYMENT_LABELS[saleReturn.payment_method] ?? saleReturn.payment_method}</b>
          </div>
          {saleReturn.warehouse_name && (
            <div>
              <span>المستودع: </span>
              <b>{saleReturn.warehouse_name}</b>
            </div>
          )}
          {saleReturn.employee_name && (
            <div>
              <span>الموظف: </span>
              <b>{saleReturn.employee_name}</b>
            </div>
          )}
        </div>

        <table className="inv-items">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر البيع</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {saleReturn.items.map((it, i) => (
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
            <b>{money(saleReturn.total)}</b>
          </div>
          <div>
            <span>الخصم:</span>
            <b>{money(saleReturn.discount)}</b>
          </div>
          {saleReturn.additional > 0 && (
            <div>
              <span>إضافي:</span>
              <b>{money(saleReturn.additional)}</b>
            </div>
          )}
          <div className="inv-net">
            <span>الصافي:</span>
            <b>
              {money(saleReturn.total - saleReturn.discount + saleReturn.additional)}{" "}
              {settings.currency}
            </b>
          </div>
        </div>

        {saleReturn.notes && (
          <div className="inv-notes">
            <b>ملاحظات:</b> {saleReturn.notes}
          </div>
        )}

        {settings.invoice_footer && (
          <div className="inv-footer">{settings.invoice_footer}</div>
        )}
      </div>
    </div>
  );
}
