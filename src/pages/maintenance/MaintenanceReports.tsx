import { useEffect, useState } from "react";
import { api } from "../../api";
import { fmtDate, money, useToast } from "../../components/ui";
import type { ServiceOrderSummary } from "../../types";

const todayISO = () => new Date().toISOString().slice(0, 10);

const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const STATUS_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  inspection: "تحت الفحص",
  pending_approval: "بانتظار موافقة",
  repairing: "جاري الإصلاح",
  pending_parts: "بانتظار قطعة غيار",
  repaired: "تم الإصلاح",
  ready: "جاهز للتسليم",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  rejected: "رفض الإصلاح",
};

export function MaintenanceReports() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [orders, setOrders] = useState<ServiceOrderSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const notify = useToast();

  const load = async () => {
    setBusy(true);
    try {
      const data = await api.listServiceOrders();
      setOrders(data as ServiceOrderSummary[]);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = orders.filter((o) => {
    if (!from && !to) return true;
    const d = o.created_at?.slice(0, 10) || "";
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const totalOrders = filtered.length;
  const delivered = filtered.filter((o) => o.status === "delivered").length;
  const inRepair = filtered.filter((o) => o.status === "repairing").length;
  const cancelled = filtered.filter((o) => o.status === "cancelled").length;
  const totalRevenue = filtered.reduce((s, o) => s + (o.total_cost || 0), 0);
  const netProfit = filtered.reduce((s, o) => s + (o.amount_paid || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>تقارير الصيانة</h1>
      </div>

      <div className="range-bar">
        <label>
          من: <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          إلى: <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn sm" onClick={load} disabled={busy}>
          {busy ? "⏳ جاري..." : "🔍 بحث"}
        </button>
      </div>

      <div className="cards-grid">
        <div className="card blue">
          <div className="card-icon">🔧</div>
          <div>
            <div className="card-value">{totalOrders}</div>
            <div className="card-label">إجمالي أوامر الصيانة</div>
          </div>
        </div>
        <div className="card green">
          <div className="card-icon">✅</div>
          <div>
            <div className="card-value">{delivered}</div>
            <div className="card-label">تم التسليم</div>
          </div>
        </div>
        <div className="card amber">
          <div className="card-icon">🛠️</div>
          <div>
            <div className="card-value">{inRepair}</div>
            <div className="card-label">قيد الإصلاح</div>
          </div>
        </div>
        <div className="card red">
          <div className="card-icon">❌</div>
          <div>
            <div className="card-value">{cancelled}</div>
            <div className="card-label">ملغاة</div>
          </div>
        </div>
        <div className="card purple">
          <div className="card-icon">💰</div>
          <div>
            <div className="card-value">{money(totalRevenue)}</div>
            <div className="card-label">إجمالي الإيرادات</div>
          </div>
        </div>
        <div className="card teal">
          <div className="card-icon">📈</div>
          <div>
            <div className="card-value">{money(netProfit)}</div>
            <div className="card-label">صافي الأرباح</div>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <h3 className="table-title">أوامر الصيانة</h3>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", padding: "2rem" }}>
            لا توجد بيانات
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>رقم الصيانة</th>
                <th>العميل</th>
                <th>الجهاز</th>
                <th>الحالة</th>
                <th>التكلفة</th>
                <th>المدفوع</th>
                <th>المتبقي</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id}>
                  <td>{i + 1}</td>
                  <td className="strong">{o.order_no}</td>
                  <td>{o.customer_name || "—"}</td>
                  <td>{o.device_type}{o.device_brand ? ` - ${o.device_brand}` : ""}</td>
                  <td className="strong">{STATUS_LABELS[o.status] || o.status}</td>
                  <td>{money(o.total_cost)}</td>
                  <td>{money(o.amount_paid)}</td>
                  <td>{money(o.remaining)}</td>
                  <td className="strong">{fmtDate(o.created_at?.slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
