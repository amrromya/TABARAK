import React from "react";
import { fmtDate, money, qty } from "./ui";
import type {
  Customer,
  CustomerPayment,
  Sale,
  SaleItem,
  Settings,
} from "../types";

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit: "آجل",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

interface StatementEntry {
  id: string;
  date: string;
  type: "sale" | "payment";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  saleId?: number;
  paymentId?: number;
  notes?: string | null;
  items?: SaleItem[];
}

export function PrintStatement({
  customer,
  sales,
  payments,
  mode,
  dateFrom,
  dateTo,
  settings,
  onClose,
}: {
  customer: Customer;
  sales: Sale[];
  payments: CustomerPayment[];
  mode: "summary" | "detailed";
  dateFrom: string;
  dateTo: string;
  settings: Settings;
  onClose: () => void;
}) {
  const totalSales = sales.reduce((sum, s) => sum + s.net_total, 0);
  const creditSales = sales.filter((s) => s.payment_method === "credit");
  const totalCreditSales = creditSales.reduce(
    (sum, s) => sum + s.net_total,
    0,
  );
  const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0);

  const filteredSales = sales.filter((s) => {
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    return true;
  });

  const filteredPayments = payments.filter((p) => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    return true;
  });

  const detailedEntries: StatementEntry[] = [];
  filteredSales.forEach((s) => {
    detailedEntries.push({
      id: `sale-${s.id}`,
      date: s.date,
      type: "sale",
      reference: s.invoice_no,
      description: `فاتورة مبيعات ${
        s.payment_method === "credit" ? "(آجل)" : "(نقدي/شبكة)"
      }${s.warehouse_name ? ` - ${s.warehouse_name}` : ""}`,
      debit: s.net_total,
      credit: 0,
      balance: 0,
      saleId: s.id,
      items: s.items,
    });
  });
  filteredPayments.forEach((p) => {
    detailedEntries.push({
      id: `pay-${p.id}`,
      date: p.date,
      type: "payment",
      reference: `تحصيل-${p.id}`,
      description: "دفعة / تحصيل",
      debit: 0,
      credit: p.amount,
      balance: 0,
      paymentId: p.id,
      notes: p.notes,
    });
  });
  detailedEntries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.type === "sale" && b.type === "payment") return -1;
    if (a.type === "payment" && b.type === "sale") return 1;
    return 0;
  });
  let running = 0;
  detailedEntries.forEach((e) => {
    running = running + e.debit - e.credit;
    e.balance = running;
  });

  const totalsFiltered = {
    debit: detailedEntries.reduce((s, e) => s + e.debit, 0),
    credit: detailedEntries.reduce((s, e) => s + e.credit, 0),
    net: 0,
  };
  totalsFiltered.net = totalsFiltered.debit - totalsFiltered.credit;

  const printDate = fmtDate(new Date().toISOString());

  return (
    <div className="print-overlay">
      <div className="print-controls no-print">
        <button className="btn primary" onClick={() => window.print()}>
          🖨️ طباعة كشف الحساب
        </button>
        <button className="btn" onClick={onClose}>
          إغلاق
        </button>
      </div>

      <div className="stmt-print print-area">
        <div className="stmt-print-head">
          <div className="stmt-print-store">
            <h2>{settings.store_name || "تبارك"}</h2>
            {settings.phone && <p>هاتف: {settings.phone}</p>}
            {settings.address && <p>{settings.address}</p>}
          </div>
          <div className="stmt-print-title">
            {mode === "summary" ? "كشف حساب إجمالي" : "كشف حساب تفصيلي"}
          </div>
          <div className="stmt-print-date">التاريخ: {printDate}</div>
        </div>

        <div className="stmt-print-customer">
          <div className="stmt-print-cust-name">{customer.name}</div>
          <div className="stmt-print-cust-meta">
            📞 {customer.phone ?? "بدون هاتف"}
            {customer.notes && `  📝 ${customer.notes}`}
          </div>
        </div>

        <div className="stmt-print-balance">
          <span>الرصيد الحالي:</span>
          <b
            className={
              customer.balance > 0
                ? "text-red"
                : customer.balance < 0
                  ? "text-green"
                  : ""
            }
          >
            {money(customer.balance)}
          </b>
          <span className="stmt-print-balance-sub">
            {customer.balance > 0
              ? "مدين لنا"
              : customer.balance < 0
                ? "دائن لـ العميل"
                : "رصيد صفر"}
          </span>
        </div>

        {dateFrom || dateTo ? (
          <div className="stmt-print-daterange">
            <span>
              من: {dateFrom ? fmtDate(dateFrom) : "—"}
            </span>
            <span>
              إلى: {dateTo ? fmtDate(dateTo) : "—"}
            </span>
          </div>
        ) : null}

        {mode === "summary" && (
          <>
            <div className="stmt-print-summary-cards">
              <div className="stmt-print-sum-card">
                <div className="stmt-print-sum-label">إجمالي المبيعات</div>
                <div className="stmt-print-sum-value">
                  {money(totalSales)}
                </div>
                <div className="stmt-print-sum-sub">
                  {sales.length} فاتورة
                </div>
              </div>
              <div className="stmt-print-sum-card">
                <div className="stmt-print-sum-label">مبيعات آجل</div>
                <div className="stmt-print-sum-value">
                  {money(totalCreditSales)}
                </div>
                <div className="stmt-print-sum-sub">
                  {creditSales.length} فاتورة
                </div>
              </div>
              <div className="stmt-print-sum-card">
                <div className="stmt-print-sum-label">إجمالي التحصيلات</div>
                <div className="stmt-print-sum-value">
                  {money(totalPayments)}
                </div>
                <div className="stmt-print-sum-sub">
                  {payments.length} تحصيل
                </div>
              </div>
              <div className="stmt-print-sum-card">
                <div className="stmt-print-sum-label">صافي الحساب</div>
                <div
                  className={
                    totalSales - totalPayments > 0
                      ? "stmt-print-sum-value text-red"
                      : totalSales - totalPayments < 0
                        ? "stmt-print-sum-value text-green"
                        : "stmt-print-sum-value"
                  }
                >
                  {money(totalSales - totalPayments)}
                </div>
                <div className="stmt-print-sum-sub">مبيعات − تحصيلات</div>
              </div>
            </div>

            {creditSales.length > 0 && (
              <>
                <div className="stmt-print-section-title">
                  💳 فواتير البيع الآجل (المستحقة)
                </div>
                <table className="stmt-print-table">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>التاريخ</th>
                      <th>المستودع</th>
                      <th>الطريقة</th>
                      <th>الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditSales.map((s) => (
                      <tr key={s.id}>
                        <td className="strong">{s.invoice_no}</td>
                        <td>{fmtDate(s.date)}</td>
                        <td>{s.warehouse_name ?? "—"}</td>
                        <td>
                          <span className={`pay-badge ${s.payment_method}`}>
                            {PAYMENT_LABELS[s.payment_method] ??
                              s.payment_method}
                          </span>
                        </td>
                        <td className="strong text-red">
                          {money(s.net_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="strong">
                        الإجمالي
                      </td>
                      <td className="strong">{money(totalCreditSales)}</td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}

            {sales.length > 0 && (
              <>
                <div className="stmt-print-section-title">
                  🧾 جميع فواتير المبيعات
                </div>
                <table className="stmt-print-table">
                  <thead>
                    <tr>
                      <th>الفاتورة</th>
                      <th>التاريخ</th>
                      <th>المستودع</th>
                      <th>الطريقة</th>
                      <th>الإجمالي</th>
                      <th>خصم</th>
                      <th>مصاريف</th>
                      <th>الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id}>
                        <td className="strong">{s.invoice_no}</td>
                        <td>{fmtDate(s.date)}</td>
                        <td>{s.warehouse_name ?? "—"}</td>
                        <td>
                          <span className={`pay-badge ${s.payment_method}`}>
                            {PAYMENT_LABELS[s.payment_method] ??
                              s.payment_method}
                          </span>
                        </td>
                        <td>{money(s.total)}</td>
                        <td>{s.discount > 0 ? money(s.discount) : "—"}</td>
                        <td>
                          {s.additional > 0 ? money(s.additional) : "—"}
                        </td>
                        <td className="strong">{money(s.net_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={7} className="strong">
                        الإجمالي
                      </td>
                      <td className="strong">{money(totalSales)}</td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}

            <div className="stmt-print-section-title">
              💵 التحصيلات والمدفوعات
            </div>
            <table className="stmt-print-table">
              <thead>
                <tr>
                  <th>رقم العملية</th>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      لا توجد تحصيلات مسجلة لهذا العميل بعد.
                    </td>
                  </tr>
                )}
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">#{p.id}</td>
                    <td>{fmtDate(p.date)}</td>
                    <td className="strong text-green">{money(p.amount)}</td>
                    <td>{p.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              {payments.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={2} className="strong">
                      إجمالي التحصيلات
                    </td>
                    <td className="strong">{money(totalPayments)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        )}

        {mode === "detailed" && (
          <>
            <div className="stmt-print-det-totals">
              <div className="stmt-print-det-total debit">
                <span>إجمالي المدين (المبيعات)</span>
                <b>{money(totalsFiltered.debit)}</b>
              </div>
              <div className="stmt-print-det-total credit">
                <span>إجمالي الدائن (التحصيلات)</span>
                <b>{money(totalsFiltered.credit)}</b>
              </div>
              <div
                className={`stmt-print-det-total net ${
                  totalsFiltered.net > 0
                    ? "debit"
                    : totalsFiltered.net < 0
                      ? "credit"
                      : ""
                }`}
              >
                <span>الرصيد النهائي</span>
                <b>{money(totalsFiltered.net)}</b>
              </div>
            </div>

            <div className="stmt-print-section-title">
              📒 سجل الحركات التفصيلي
            </div>
            <table className="stmt-print-table stmt-print-det-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th style={{ width: 100 }}>التاريخ</th>
                  <th>النوع</th>
                  <th>المرجع / الوصف</th>
                  <th style={{ width: 110 }}>مدين</th>
                  <th style={{ width: 110 }}>دائن</th>
                  <th style={{ width: 110 }}>الرصيد المتداول</th>
                </tr>
              </thead>
              <tbody>
                {detailedEntries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      لا توجد حركات في الفترة المحددة.
                    </td>
                  </tr>
                )}
                {detailedEntries.map((e, idx) => (
                  <React.Fragment key={e.id}>
                    <tr>
                      <td className="text-center">{idx + 1}</td>
                      <td>{fmtDate(e.date)}</td>
                      <td>
                        <span
                          className={`stmt-type-badge ${
                            e.type === "sale" ? "type-sale" : "type-payment"
                          }`}
                        >
                          {e.type === "sale" ? "🧾 مبيعات" : "💰 تحصيل"}
                        </span>
                      </td>
                      <td>
                        <div className="stmt-ref-cell">
                          <div className="stmt-ref">
                            <span className="strong">{e.reference}</span>
                          </div>
                          <div className="stmt-desc">{e.description}</div>
                          {e.notes && (
                            <div className="stmt-notes-line">
                              📝 {e.notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="stmt-num">
                        {e.debit > 0 ? (
                          <span className="text-red strong">
                            {money(e.debit)}
                          </span>
                        ) : (
                          <span className="stmt-dash">—</span>
                        )}
                      </td>
                      <td className="stmt-num">
                        {e.credit > 0 ? (
                          <span className="text-green strong">
                            {money(e.credit)}
                          </span>
                        ) : (
                          <span className="stmt-dash">—</span>
                        )}
                      </td>
                      <td className="stmt-num">
                        <span
                          className={`stmt-bal-cell ${
                            e.balance > 0
                              ? "text-red"
                              : e.balance < 0
                                ? "text-green"
                                : ""
                          } strong`}
                        >
                          {money(e.balance)}
                        </span>
                      </td>
                    </tr>
                    {e.type === "sale" &&
                      e.items &&
                      e.items.length > 0 && (
                        <tr className="stmt-inv-details-row">
                          <td colSpan={7}>
                            <div className="stmt-inv-details">
                              <table className="table stmt-inv-items-table">
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
                                  {e.items.filter((it) => !(it.sell_price === 0 && !it.item_name)).map((it, i) => (
                                    <tr key={i}>
                                      <td>{i + 1}</td>
                                      <td className="strong">
                                        {it.item_name || it.product_name}
                                      </td>
                                      <td>{qty(it.quantity)}</td>
                                      <td>{money(it.sell_price)}</td>
                                      <td>{money(it.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                  </React.Fragment>
                ))}
              </tbody>
              {detailedEntries.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={4} className="strong">
                      الإجمالي
                    </td>
                    <td className="strong text-red">
                      {money(totalsFiltered.debit)}
                    </td>
                    <td className="strong text-green">
                      {money(totalsFiltered.credit)}
                    </td>
                    <td
                      className={`strong ${
                        totalsFiltered.net > 0
                          ? "text-red"
                          : totalsFiltered.net < 0
                            ? "text-green"
                            : ""
                      }`}
                    >
                      {money(totalsFiltered.net)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </>
        )}

        {settings.invoice_footer && (
          <div className="inv-footer">{settings.invoice_footer}</div>
        )}
      </div>
    </div>
  );
}
