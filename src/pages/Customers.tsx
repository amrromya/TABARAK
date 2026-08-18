import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { PrintStatement } from "../components/PrintStatement";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  money,
  qty,
  today,
  useToast,
} from "../components/ui";
import type {
  Customer,
  CustomerPayment,
  NewCustomer,
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

type StatementMode = "summary" | "detailed" | null;

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
}

export function Customers({
  onViewSale,
}: {
  onViewSale?: (id: number) => void;
}) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<NewCustomer>({
    name: "",
    phone: "",
    notes: "",
  });

  const [paying, setPaying] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(today());
  const [payNotes, setPayNotes] = useState("");

  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(
    null,
  );
  const [statementMode, setStatementMode] = useState<StatementMode>(null);
  const [statementSales, setStatementSales] = useState<Sale[]>([]);
  const [statementPayments, setStatementPayments] = useState<CustomerPayment[]>(
    [],
  );
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const [expandedSaleId, setExpandedSaleId] = useState<number | null>(null);
  const [expandedSaleItems, setExpandedSaleItems] = useState<SaleItem[]>([]);

  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [printStatement, setPrintStatement] = useState<StatementMode>(null);

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custs, settings] = await Promise.all([
        api.listCustomers(),
        api.getSettings(),
      ]);
      setCustomers(custs);
      setSettings(settings);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return setDropdownOpen(null);
      if (!target.closest(".cust-dropdown-wrap")) {
        setDropdownOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.includes(search) ||
      (c.phone ?? "").includes(search),
  );

  const totalDebts = customers.reduce(
    (s, c) => s + Math.max(0, c.balance),
    0,
  );
  const totalCredit = customers.reduce(
    (s, c) => s + Math.max(0, -c.balance),
    0,
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateCustomer(editing.id, form);
        notify("تم تعديل بيانات العميل");
      } else {
        await api.createCustomer(form);
        notify("تمت إضافة العميل");
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (c: Customer) => {
    if (
      !confirmDialog(
        `هل تريد حذف العميل «${c.name}»؟ سيفقد تاريخه في المبيعات والمدفوعات.`,
      )
    )
      return;
    try {
      await api.deleteCustomer(c.id);
      notify("تم حذف العميل");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    if (payAmount <= 0) {
      notify("المبلغ يجب أن يكون أكبر من صفر", "error");
      return;
    }
    try {
      await api.createCustomerPayment({
        customer_id: paying.id,
        date: payDate,
        amount: payAmount,
        notes: payNotes || null,
      });
      notify(`تم تحصيل ${money(payAmount)} من ${paying.name}`);
      setPaying(null);
      load();
      if (statementCustomer?.id === paying.id) {
        reloadStatement(paying);
      }
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const reloadStatement = async (customer: Customer) => {
    try {
      const [p, s] = await Promise.all([
        api.listCustomerPayments(customer.id),
        api.listSales(),
      ]);
      setStatementPayments(p);
      setStatementSales(s.filter((x) => x.customer_id === customer.id));
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const toggleSaleDetails = async (saleId: number) => {
    if (expandedSaleId === saleId) {
      setExpandedSaleId(null);
      setExpandedSaleItems([]);
    } else {
      try {
        const fullSale = await api.getSale(saleId);
        setExpandedSaleItems(fullSale.items);
        setExpandedSaleId(saleId);
      } catch (e) {
        notify(String(e), "error");
      }
    }
  };

  const openStatement = async (
    customer: Customer,
    mode: Exclude<StatementMode, null>,
  ) => {
    setDropdownOpen(null);
    setStatementCustomer(customer);
    setStatementMode(mode);
    setDateFrom("");
    setDateTo("");
    await reloadStatement(customer);
  };

  const removePayment = async (p: CustomerPayment) => {
    if (!confirmDialog("هل تريد حذف هذا التحصيل؟")) return;
    try {
      await api.deleteCustomerPayment(p.id);
      if (statementCustomer) {
        await reloadStatement(statementCustomer);
      }
      load();
      notify("تم حذف التحصيل");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const totalSalesForCustomer = useMemo(() => {
    return statementSales.reduce((sum, s) => sum + s.net_total, 0);
  }, [statementSales]);

  const totalPaymentsForCustomer = useMemo(() => {
    return statementPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [statementPayments]);

  const creditSales = useMemo(() => {
    return statementSales.filter((s) => s.payment_method === "credit");
  }, [statementSales]);

  const totalCreditSales = creditSales.reduce(
    (sum, s) => sum + s.net_total,
    0,
  );

  const filteredSales = useMemo(() => {
    return statementSales.filter((s) => {
      if (dateFrom && s.date < dateFrom) return false;
      if (dateTo && s.date > dateTo) return false;
      return true;
    });
  }, [statementSales, dateFrom, dateTo]);

  const filteredPayments = useMemo(() => {
    return statementPayments.filter((p) => {
      if (dateFrom && p.date < dateFrom) return false;
      if (dateTo && p.date > dateTo) return false;
      return true;
    });
  }, [statementPayments, dateFrom, dateTo]);

  const detailedEntries = useMemo<StatementEntry[]>(() => {
    const entries: StatementEntry[] = [];

    filteredSales.forEach((s) => {
      entries.push({
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
      });
    });

    filteredPayments.forEach((p) => {
      entries.push({
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

    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.type === "sale" && b.type === "payment") return -1;
      if (a.type === "payment" && b.type === "sale") return 1;
      return 0;
    });

    let running = 0;
    entries.forEach((e) => {
      running = running + e.debit - e.credit;
      e.balance = running;
    });

    return entries;
  }, [filteredSales, filteredPayments]);

  const totalsFiltered = useMemo(() => {
    const debit = detailedEntries.reduce((s, e) => s + e.debit, 0);
    const credit = detailedEntries.reduce((s, e) => s + e.credit, 0);
    return { debit, credit, net: debit - credit };
  }, [detailedEntries]);

  return (
    <div className="page cust-page">
      <div className="page-head">
        <h1>العملاء والديون</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={() => {
              setEditing(null);
              setForm({ name: "", phone: "", notes: "" });
              setShowForm(true);
            }}
          >
            + عميل جديد
          </button>
        </div>
      </div>

      <div className="cust-stats-grid">
        <div className="cust-stat-card cust-stat-blue">
          <div className="cust-stat-icon">👥</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{customers.length}</div>
            <div className="cust-stat-label">إجمالي العملاء</div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-red">
          <div className="cust-stat-icon">💸</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{money(totalDebts)}</div>
            <div className="cust-stat-label">إجمالي الديون المستحقة</div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-green">
          <div className="cust-stat-icon">💳</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">{money(totalCredit)}</div>
            <div className="cust-stat-label">أرصدة دائنة للعملاء</div>
          </div>
        </div>
        <div className="cust-stat-card cust-stat-amber">
          <div className="cust-stat-icon">⚠️</div>
          <div className="cust-stat-info">
            <div className="cust-stat-value">
              {customers.filter((c) => c.balance > 0).length}
            </div>
            <div className="cust-stat-label">عدد العملاء مدينيون</div>
          </div>
        </div>
      </div>

      <div className="table-wrap cust-table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الهاتف</th>
              <th>المديونية</th>
              <th>ملاحظات</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="empty">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  لا يوجد عملاء بعد.
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr
                key={c.id}
                className={c.balance > 0 ? "cust-row-debt" : ""}
              >
                <td className="strong">
                  <div className="cust-name-cell">
                    <span className="cust-avatar">
                      {c.name.charAt(0)}
                    </span>
                    <span>{c.name}</span>
                  </div>
                </td>
                <td>
                  {c.phone ? (
                    <a
                      className="cust-phone-link"
                      href={`tel:${c.phone}`}
                      title="اتصال"
                    >
                      📞 {c.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <span
                    className={`cust-balance ${
                      c.balance > 0
                        ? "cust-balance-debt"
                        : c.balance < 0
                          ? "cust-balance-credit"
                          : "cust-balance-zero"
                    }`}
                  >
                    {money(c.balance)}
                    {c.balance > 0 && <span className="cust-bal-tag">مدين</span>}
                    {c.balance < 0 && (
                      <span className="cust-bal-tag cust-bal-tag-credit">
                        دائن
                      </span>
                    )}
                  </span>
                </td>
                <td className="cust-notes-cell">{c.notes ?? "—"}</td>
                <td className="actions cust-actions">
                  <div className="cust-dropdown-wrap" data-customer-id={c.id}>
                    <button
                      type="button"
                      className="btn sm btn-statement"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(dropdownOpen === c.id ? null : c.id);
                      }}
                    >
                      📑 الكشف
                      <span className="cust-dd-arrow">
                        {dropdownOpen === c.id ? "▲" : "▼"}
                      </span>
                    </button>
                    {dropdownOpen === c.id && (
                      <div className="cust-dropdown-menu">
                        <button
                          type="button"
                          className="cust-dd-item"
                          onClick={() => openStatement(c, "summary")}
                        >
                          <span className="cust-dd-ico">📊</span>
                          <div className="cust-dd-text">
                            <div className="cust-dd-title">
                              كشف حساب إجمالي
                            </div>
                            <div className="cust-dd-desc">
                              ملخص المبيعات والمدفوعات
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          className="cust-dd-item"
                          onClick={() => openStatement(c, "detailed")}
                        >
                          <span className="cust-dd-ico">📋</span>
                          <div className="cust-dd-text">
                            <div className="cust-dd-title">
                              كشف حساب تفصيلي
                            </div>
                            <div className="cust-dd-desc">
                              حركات يومية برصيد متداول
                            </div>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    className="btn sm primary"
                    disabled={c.balance <= 0}
                    onClick={() => {
                      setPaying(c);
                      setPayAmount(Math.min(c.balance, 0) ? 0 : c.balance);
                      setPayNotes("");
                      setPayDate(today());
                    }}
                    title={c.balance <= 0 ? "لا يوجد مديونية" : "تسجيل تحصيل"}
                  >
                    💰 تحصيل
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => {
                      setEditing(c);
                      setForm({
                        name: c.name,
                        phone: c.phone ?? "",
                        notes: c.notes ?? "",
                      });
                      setShowForm(true);
                    }}
                  >
                    ✏️ تعديل
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={() => remove(c)}
                  >
                    🗑️ حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? "تعديل عميل" : "إضافة عميل جديد"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form-grid">
            <Field label="اسم العميل *">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="ملاحظات">
              <input
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editing ? "حفظ التعديلات" : "إضافة"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {paying && (
        <Modal
          title={`تحصيل من: ${paying.name}`}
          onClose={() => setPaying(null)}
        >
          <form onSubmit={recordPayment} className="form-grid">
            <Field label="المديونية الحالية">
              <input value={money(paying.balance)} disabled />
            </Field>
            <Field label="مبلغ التحصيل *">
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(Number(e.target.value))}
              />
            </Field>
            <Field label="التاريخ">
              <input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </Field>
            <Field label="ملاحظات">
              <input
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="اختياري"
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                تسجيل التحصيل
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setPaying(null)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {statementCustomer && statementMode === "summary" && (
        <Modal
          title={`كشف حساب إجمالي - ${statementCustomer.name}`}
          onClose={() => {
            setStatementCustomer(null);
            setStatementMode(null);
          }}
          width="880px"
        >
          <div className="stmt-header">
            <div className="stmt-customer-info">
              <div className="stmt-customer-avatar">
                {statementCustomer.name.charAt(0)}
              </div>
              <div>
                <div className="stmt-customer-name">
                  {statementCustomer.name}
                </div>
                <div className="stmt-customer-meta">
                  <span>📞 {statementCustomer.phone ?? "بدون هاتف"}</span>
                  {statementCustomer.notes && (
                    <span>📝 {statementCustomer.notes}</span>
                  )}
                </div>
              </div>
            </div>
            <div
              className={`stmt-current-balance ${
                statementCustomer.balance > 0
                  ? "stmt-bal-debt"
                  : statementCustomer.balance < 0
                    ? "stmt-bal-credit"
                    : "stmt-bal-zero"
              }`}
            >
              <span className="stmt-bal-label">الرصيد الحالي</span>
              <span className="stmt-bal-value">
                {money(statementCustomer.balance)}
              </span>
              <span className="stmt-bal-sub">
                {statementCustomer.balance > 0
                  ? "مدين لنا"
                  : statementCustomer.balance < 0
                    ? "دائن لـ العميل"
                    : "رصيد صفر"}
              </span>
            </div>
          </div>

          <div className="stmt-print-btn-row no-print">
            <button
              className="btn primary"
              onClick={() => setPrintStatement("summary")}
              disabled={!settings}
            >
              🖨️ طباعة كشف الحساب
            </button>
          </div>

          <div className="stmt-summary-cards">
            <div className="stmt-sum-card sc-sales">
              <div className="stmt-sum-ico">🧾</div>
              <div>
                <div className="stmt-sum-label">إجمالي المبيعات</div>
                <div className="stmt-sum-value">{money(totalSalesForCustomer)}</div>
                <div className="stmt-sum-sub">{statementSales.length} فاتورة</div>
              </div>
            </div>
            <div className="stmt-sum-card sc-credit">
              <div className="stmt-sum-ico">⏳</div>
              <div>
                <div className="stmt-sum-label">مبيعات آجل</div>
                <div className="stmt-sum-value">{money(totalCreditSales)}</div>
                <div className="stmt-sum-sub">{creditSales.length} فاتورة</div>
              </div>
            </div>
            <div className="stmt-sum-card sc-paid">
              <div className="stmt-sum-ico">💰</div>
              <div>
                <div className="stmt-sum-label">إجمالي التحصيلات</div>
                <div className="stmt-sum-value">{money(totalPaymentsForCustomer)}</div>
                <div className="stmt-sum-sub">
                  {statementPayments.length} تحصيل
                </div>
              </div>
            </div>
            <div className="stmt-sum-card sc-net">
              <div className="stmt-sum-ico">📊</div>
              <div>
                <div className="stmt-sum-label">صافي الحساب</div>
                <div
                  className={`stmt-sum-value ${
                    totalSalesForCustomer - totalPaymentsForCustomer > 0
                      ? "text-red"
                      : "text-green"
                  }`}
                >
                  {money(totalSalesForCustomer - totalPaymentsForCustomer)}
                </div>
                <div className="stmt-sum-sub">
                  مبيعات − تحصيلات
                </div>
              </div>
            </div>
          </div>

          {creditSales.length > 0 && (
            <>
              <div className="stmt-section-head">
                <h4 className="stmt-section-title">
                  💳 فواتير البيع الآجل (المستحقة)
                </h4>
                <span className="stmt-section-badge">
                  إجماليها: {money(totalCreditSales)}
                </span>
              </div>
              <div className="stmt-table-wrap">
                <table className="table stmt-table">
                  <thead>
                    <tr>
                      <th>رقم الفاتورة</th>
                      <th>التاريخ</th>
                      <th>المستودع</th>
                      <th>الطريقة</th>
                      <th>الصافي</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creditSales.map((s) => (
                      <tr key={s.id} className="stmt-sale-row">
                        <td className="strong stmt-inv-no">
                          {s.invoice_no}
                        </td>
                        <td>{fmtDate(s.date)}</td>
                        <td>{s.warehouse_name ?? "—"}</td>
                        <td>
                          <span
                            className={`pay-badge ${s.payment_method}`}
                          >
                            {PAYMENT_LABELS[s.payment_method] ??
                              s.payment_method}
                          </span>
                        </td>
                        <td className="strong text-red">
                          {money(s.net_total)}
                        </td>
                        <td>
                          {onViewSale ? (
                            <button
                              className="btn sm stmt-edit-btn"
                              onClick={() => onViewSale(s.id)}
                              title="فتح الفاتورة للتعديل"
                            >
                              ✏️ فتح / تعديل
                            </button>
                          ) : (
                            <span className="stmt-inv-no">#{s.id}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {statementSales.length > 0 && (
            <>
              <div className="stmt-section-head">
                <h4 className="stmt-section-title">🧾 جميع فواتير المبيعات</h4>
                <span className="stmt-section-badge">
                  {statementSales.length} فاتورة
                </span>
              </div>
              <div className="stmt-table-wrap">
                <table className="table stmt-table">
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
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementSales.map((s) => (
                      <tr key={s.id}>
                        <td className="strong">{s.invoice_no}</td>
                        <td>{fmtDate(s.date)}</td>
                        <td>{s.warehouse_name ?? "—"}</td>
                        <td>
                          <span
                            className={`pay-badge ${s.payment_method}`}
                          >
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
                        <td>
                          {onViewSale && (
                            <button
                              className="btn sm primary"
                              onClick={() => onViewSale(s.id)}
                              title="فتح وتعديل الفاتورة"
                            >
                              تعديل
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="stmt-tfoot">
                      <td colSpan={7} className="strong">
                        الإجمالي
                      </td>
                      <td className="strong stmt-total-net">
                        {money(totalSalesForCustomer)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          <div className="stmt-section-head">
            <h4 className="stmt-section-title">💵 التحصيلات والمدفوعات</h4>
            <span className="stmt-section-badge">
              {statementPayments.length} عملية
            </span>
          </div>
          <div className="stmt-table-wrap">
            <table className="table stmt-table">
              <thead>
                <tr>
                  <th>رقم العملية</th>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>ملاحظات</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {statementPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty">
                      لا توجد تحصيلات مسجلة لهذا العميل بعد.
                    </td>
                  </tr>
                )}
                {statementPayments.map((p) => (
                  <tr key={p.id}>
                    <td className="strong">#{p.id}</td>
                    <td>{fmtDate(p.date)}</td>
                    <td className="strong text-green">{money(p.amount)}</td>
                    <td>{p.notes ?? "—"}</td>
                    <td>
                      <button
                        className="btn sm danger"
                        onClick={() => removePayment(p)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {statementPayments.length > 0 && (
                <tfoot>
                  <tr className="stmt-tfoot">
                    <td colSpan={2} className="strong">
                      إجمالي التحصيلات
                    </td>
                    <td className="strong text-green stmt-total-net">
                      {money(totalPaymentsForCustomer)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}

      {statementCustomer && statementMode === "detailed" && (
        <Modal
          title={`كشف حساب تفصيلي - ${statementCustomer.name}`}
          onClose={() => {
            setStatementCustomer(null);
            setStatementMode(null);
          }}
          width="980px"
        >
          <div className="stmt-header">
            <div className="stmt-customer-info">
              <div className="stmt-customer-avatar stmt-avatar-det">
                {statementCustomer.name.charAt(0)}
              </div>
              <div>
                <div className="stmt-customer-name">
                  {statementCustomer.name}
                </div>
                <div className="stmt-customer-meta">
                  <span>📞 {statementCustomer.phone ?? "بدون هاتف"}</span>
                  <span>🆔 #{statementCustomer.id}</span>
                </div>
              </div>
            </div>
            <div
              className={`stmt-current-balance ${
                statementCustomer.balance > 0
                  ? "stmt-bal-debt"
                  : statementCustomer.balance < 0
                    ? "stmt-bal-credit"
                    : "stmt-bal-zero"
              }`}
            >
              <span className="stmt-bal-label">الرصيد الحالي</span>
              <span className="stmt-bal-value">
                {money(statementCustomer.balance)}
              </span>
              <span className="stmt-bal-sub">
                {statementCustomer.balance > 0
                  ? "مدين لنا"
                  : statementCustomer.balance < 0
                    ? "دائن لـ العميل"
                    : "رصيد صفري"}
              </span>
            </div>
          </div>

          <div className="stmt-date-range">
            <span className="stmt-dr-label">📅 نطاق التاريخ (اختياري):</span>
            <div className="stmt-dr-fields">
              <Field label="من تاريخ">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </Field>
              <Field label="إلى تاريخ">
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </Field>
              {(dateFrom || dateTo) && (
                <button
                  className="btn sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                >
                  إعادة تعيين
                </button>
              )}
            </div>
          </div>

          <div className="stmt-print-btn-row no-print">
            <button
              className="btn primary"
              onClick={() => setPrintStatement("detailed")}
              disabled={!settings}
            >
              🖨️ طباعة كشف الحساب
            </button>
          </div>

          <div className="stmt-det-totals">
            <div className="stmt-det-total debit">
              <span>إجمالي المدين (المبيعات)</span>
              <b>{money(totalsFiltered.debit)}</b>
            </div>
            <div className="stmt-det-total credit">
              <span>إجمالي الدائن (التحصيلات)</span>
              <b>{money(totalsFiltered.credit)}</b>
            </div>
            <div
              className={`stmt-det-total net ${
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

          <div className="stmt-section-head">
            <h4 className="stmt-section-title">📒 سجل الحركات التفصيلي</h4>
            <span className="stmt-section-badge">
              {detailedEntries.length} حركة
            </span>
          </div>
          <div className="stmt-table-wrap stmt-det-wrap">
            <table className="table stmt-table stmt-detailed-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th style={{ width: 100 }}>التاريخ</th>
                  <th>النوع</th>
                  <th>المرجع / الوصف</th>
                  <th style={{ width: 110 }}>مدين</th>
                  <th style={{ width: 110 }}>دائن</th>
                  <th style={{ width: 110 }}>الرصيد المتداول</th>
                  <th style={{ width: 90 }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {detailedEntries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="empty">
                      لا توجد حركات في الفترة المحددة.
                    </td>
                  </tr>
                )}
                {detailedEntries.map((e, idx) => {
                  const rowClass =
                    e.type === "sale"
                      ? "stmt-row-sale"
                      : "stmt-row-payment";
                  return (
                    <React.Fragment key={e.id}>
                      <tr className={`${rowClass}`}>
                        <td className="text-center">{idx + 1}</td>
                        <td className="nowrap">{fmtDate(e.date)}</td>
                        <td>
                          <span
                            className={`stmt-type-badge ${
                              e.type === "sale"
                                ? "type-sale"
                                : "type-payment"
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
                        <td>
                          {e.type === "sale" && e.saleId && (
                            <>
                              <button
                                className="btn sm stmt-edit-btn"
                                onClick={() => toggleSaleDetails(e.saleId!)}
                                title={
                                  expandedSaleId === e.saleId
                                    ? "إخفاء التفاصيل"
                                    : "عرض تفاصيل الفاتورة"
                                }
                              >
                                {expandedSaleId === e.saleId
                                  ? "إخفاء"
                                  : "تفاصيل"}
                              </button>
                              {onViewSale && (
                                <button
                                  className="btn sm stmt-edit-btn"
                                  onClick={() => onViewSale(e.saleId!)}
                                  title="فتح الفاتورة للتعديل"
                                >
                                  تعديل
                                </button>
                              )}
                            </>
                          )}
                          {e.type === "payment" && e.paymentId ? (
                            <button
                              className="btn sm danger"
                              onClick={() => {
                                const p = statementPayments.find(
                                  (pp) => pp.id === e.paymentId,
                                );
                                if (p) removePayment(p);
                              }}
                              title="حذف العملية"
                            >
                              حذف
                            </button>
                          ) : (
                            e.type === "sale" && (
                              <span className="stmt-dash">—</span>
                            )
                          )}
                        </td>
                      </tr>
                      {e.type === "sale" &&
                        e.saleId &&
                        expandedSaleId === e.saleId && (
                          <tr className="stmt-inv-details-row">
                            <td colSpan={8}>
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
                                    {expandedSaleItems.map((it, i) => (
                                      <tr key={i}>
                                        <td>{i + 1}</td>
                                        <td className="strong">
                                          {it.product_name}
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
                  );
                })}
              </tbody>
              {detailedEntries.length > 0 && (
                <tfoot>
                  <tr className="stmt-tfoot stmt-tfoot-det">
                    <td colSpan={4} className="strong">
                      الإجمالي
                    </td>
                    <td className="strong text-red stmt-total-net">
                      {money(totalsFiltered.debit)}
                    </td>
                    <td className="strong text-green stmt-total-net">
                      {money(totalsFiltered.credit)}
                    </td>
                    <td
                      className={`strong stmt-total-net ${
                        totalsFiltered.net > 0
                          ? "text-red"
                          : totalsFiltered.net < 0
                            ? "text-green"
                            : ""
                      }`}
                    >
                      {money(totalsFiltered.net)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}

      {statementCustomer && printStatement && settings && (
        <PrintStatement
          customer={statementCustomer}
          sales={statementSales}
          payments={statementPayments}
          mode={printStatement}
          dateFrom={dateFrom}
          dateTo={dateTo}
          settings={settings}
          onClose={() => setPrintStatement(null)}
        />
      )}
    </div>
  );
}
