import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Modal, fmtDate, money, useToast } from "../../components/ui";
import type { Customer, ServiceOrderSummary } from "../../types";

const STATUS_COLORS: Record<string, string> = {
  received: "#6366f1",
  diagnosed: "#f59e0b",
  waiting_parts: "#f97316",
  repairing: "#3b82f6",
  testing: "#8b5cf6",
  ready: "#10b981",
  delivered: "#6b7280",
  cancelled: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  received: "مستلم",
  diagnosed: "تم التشخيص",
  waiting_parts: "بانتظار قطع",
  repairing: "قيد الإصلاح",
  testing: "جاري الفحص",
  ready: "جاهز للتسليم",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

interface CustomerStats {
  customer: Customer;
  orders: ServiceOrderSummary[];
  totalOrders: number;
  totalPaid: number;
  totalCost: number;
  lastDate: string | null;
}

export function MaintenanceCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<ServiceOrderSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerStats | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [custs, ords] = await Promise.all([
        api.listCustomers(),
        api.listServiceOrders(),
      ]);
      setCustomers(custs);
      setOrders(ords as ServiceOrderSummary[]);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const customerStats = useMemo<CustomerStats[]>(() => {
    return customers.map((c) => {
      const matched = orders.filter(
        (o) =>
          o.customer_name === c.name ||
          (o.customer_phone && c.phone && o.customer_phone === c.phone),
      );
      const totalPaid = matched.reduce((s, o) => s + (o.amount_paid ?? 0), 0);
      const totalCost = matched.reduce((s, o) => s + (o.total_cost ?? 0), 0);
      const dates = matched
        .map((o) => o.created_at)
        .filter(Boolean)
        .sort()
        .reverse();
      return {
        customer: c,
        orders: matched,
        totalOrders: matched.length,
        totalPaid,
        totalCost,
        lastDate: dates[0] ?? null,
      };
    });
  }, [customers, orders]);

  const filtered = customerStats.filter(
    (s) =>
      !search ||
      s.customer.name.includes(search) ||
      (s.customer.phone ?? "").includes(search),
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>عملاء الصيانة</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث بالاسم أو الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>العميل</th>
              <th>الهاتف</th>
              <th>عدد الأجهزة</th>
              <th>إجمالي المدفوعات</th>
              <th>آخر صيانة</th>
              <th>إجراء</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  لا يوجد عملاء صيانة.
                </td>
              </tr>
            )}
            {!loading &&
              filtered.map((s, idx) => (
                <tr
                  key={s.customer.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(s)}
                >
                  <td>{idx + 1}</td>
                  <td className="strong">{s.customer.name}</td>
                  <td>{s.customer.phone ?? "—"}</td>
                  <td>{s.totalOrders}</td>
                  <td>{money(s.totalPaid)}</td>
                  <td>{s.lastDate ? fmtDate(s.lastDate) : "—"}</td>
                  <td>
                    <button
                      className="btn sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(s);
                      }}
                    >
                      تفاصيل
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <Modal
          title={`بيانات العميل - ${selected.customer.name}`}
          onClose={() => setSelected(null)}
          width="880px"
        >
          <div className="stmt-header">
            <div className="stmt-customer-info">
              <div className="stmt-customer-avatar">
                {selected.customer.name.charAt(0)}
              </div>
              <div>
                <div className="stmt-customer-name">
                  {selected.customer.name}
                </div>
                <div className="stmt-customer-meta">
                  <span>📞 {selected.customer.phone ?? "بدون هاتف"}</span>
                  {selected.customer.notes && (
                    <span>📝 {selected.customer.notes}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="stmt-summary-cards">
            <div className="stmt-sum-card sc-sales">
              <div className="stmt-sum-ico">🔧</div>
              <div>
                <div className="stmt-sum-label">عدد أوامر الصيانة</div>
                <div className="stmt-sum-value">{selected.totalOrders}</div>
              </div>
            </div>
            <div className="stmt-sum-card sc-paid">
              <div className="stmt-sum-ico">💰</div>
              <div>
                <div className="stmt-sum-label">إجمالي المدفوعات</div>
                <div className="stmt-sum-value">{money(selected.totalPaid)}</div>
              </div>
            </div>
            <div className="stmt-sum-card sc-credit">
              <div className="stmt-sum-ico">🧾</div>
              <div>
                <div className="stmt-sum-label">إجمالي التكلفة</div>
                <div className="stmt-sum-value">{money(selected.totalCost)}</div>
              </div>
            </div>
            <div className="stmt-sum-card sc-net">
              <div className="stmt-sum-ico">📅</div>
              <div>
                <div className="stmt-sum-label">آخر صيانة</div>
                <div className="stmt-sum-value">
                  {selected.lastDate ? fmtDate(selected.lastDate) : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="stmt-section-head">
            <h4 className="stmt-section-title">أوامر الصيانة</h4>
            <span className="stmt-section-badge">
              {selected.orders.length} أمر
            </span>
          </div>
          <div className="stmt-table-wrap">
            <table className="table stmt-table">
              <thead>
                <tr>
                  <th>رقم الصيانة</th>
                  <th>الجهاز</th>
                  <th>الماركة</th>
                  <th>الحالة</th>
                  <th>التكلفة</th>
                  <th>المدفوع</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {selected.orders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      لا توجد أوامر صيانة لهذا العميل.
                    </td>
                  </tr>
                )}
                {selected.orders.map((o) => (
                  <tr key={o.id}>
                    <td className="strong">{o.order_no}</td>
                    <td>{o.device_type}</td>
                    <td>
                      {[o.device_brand, o.device_model]
                        .filter(Boolean)
                        .join(" — ") || "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          background: STATUS_COLORS[o.status] ?? "#6b7280",
                          color: "#fff",
                          padding: "2px 10px",
                          borderRadius: 12,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                    </td>
                    <td>{money(o.total_cost)}</td>
                    <td>{money(o.amount_paid)}</td>
                    <td>
                      {o.created_at
                        ? fmtDate(o.created_at)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              {selected.orders.length > 0 && (
                <tfoot>
                  <tr className="stmt-tfoot">
                    <td colSpan={4} className="strong">
                      الإجمالي
                    </td>
                    <td className="strong stmt-total-net">
                      {money(selected.totalCost)}
                    </td>
                    <td className="strong stmt-total-net">
                      {money(selected.totalPaid)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
