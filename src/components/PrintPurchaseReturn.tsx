import { fmtDate, money, qty } from "./ui";
import type { PurchaseReturn, Settings } from "../types";

export function PrintPurchaseReturn({
  purchaseReturn,
  settings,
  onClose,
}: {
  purchaseReturn: PurchaseReturn;
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
          <div className="inv-title">مردود مشتريات</div>
          <div className="inv-no">رقم: {purchaseReturn.invoice_no}</div>
        </div>

        <div className="inv-meta">
          <div>
            <span>التاريخ: </span>
            <b>{fmtDate(purchaseReturn.date)}</b>
          </div>
          <div>
            <span>المورد: </span>
            <b>{purchaseReturn.supplier_name ?? "—"}</b>
          </div>
          <div>
            <span>الفاتورة الأصلية: </span>
            <b>P-{purchaseReturn.purchase_id}</b>
          </div>
          {purchaseReturn.warehouse_name && (
            <div>
              <span>المستودع: </span>
              <b>{purchaseReturn.warehouse_name}</b>
            </div>
          )}
          {purchaseReturn.employee_name && (
            <div>
              <span>الموظف: </span>
              <b>{purchaseReturn.employee_name}</b>
            </div>
          )}
        </div>

        <table className="inv-items">
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر الشراء</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {purchaseReturn.items.map((it, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{it.product_name}</td>
                <td>{qty(it.quantity)}</td>
                <td>{money(it.cost_price)}</td>
                <td>{money(it.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="inv-totals">
          <div>
            <span>الإجمالي:</span>
            <b>{money(purchaseReturn.total)}</b>
          </div>
          <div>
            <span>الخصم:</span>
            <b>{money(purchaseReturn.discount)}</b>
          </div>
          {purchaseReturn.additional > 0 && (
            <div>
              <span>إضافي:</span>
              <b>{money(purchaseReturn.additional)}</b>
            </div>
          )}
          <div className="inv-net">
            <span>الصافي:</span>
            <b>
              {money(purchaseReturn.total - purchaseReturn.discount + purchaseReturn.additional)}{" "}
              {settings.currency}
            </b>
          </div>
        </div>

        {purchaseReturn.notes && (
          <div className="inv-notes">
            <b>ملاحظات:</b> {purchaseReturn.notes}
          </div>
        )}

        {settings.invoice_footer && (
          <div className="inv-footer">{settings.invoice_footer}</div>
        )}
      </div>
    </div>
  );
}
