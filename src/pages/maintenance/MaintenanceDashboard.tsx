import { useEffect, useState } from "react";
import { api } from "../../api";
import { fmtDate, money, today, useToast } from "../../components/ui";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type MaintenanceDashboard as MaintenanceDashboardData,
  type MaintenanceStatus,
} from "../../types";

export function MaintenanceDashboard() {
  const [data, setData] = useState<MaintenanceDashboardData | null>(null);
  const notify = useToast();

  useEffect(() => {
    const load = () =>
      api
        .getMaintenanceDashboard()
        .then(setData)
        .catch((e) => notify(String(e), "error"));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [notify]);

  const cards = [
    {
      label: "إجمالي الأجهزة بالصيانة",
      value: data?.total_in维修 ?? 0,
      icon: "🔧",
      cls: "blue",
    },
    {
      label: "تم الاستلام اليوم",
      value: data?.received_today ?? 0,
      icon: "📥",
      cls: "blue",
    },
    {
      label: "تم التسليم اليوم",
      value: data?.delivered_today ?? 0,
      icon: "📤",
      cls: "green",
    },
    {
      label: "تحت الفحص",
      value: data?.under_inspection ?? 0,
      icon: "🔍",
      cls: "amber",
    },
    {
      label: "جاري الإصلاح",
      value: data?.in_repair ?? 0,
      icon: "⚙️",
      cls: "red",
    },
    {
      label: "بانتظار موافقة",
      value: data?.awaiting_approval ?? 0,
      icon: "⏳",
      cls: "purple",
    },
    {
      label: "بانتظار قطعة غيار",
      value: data?.awaiting_parts ?? 0,
      icon: "🔩",
      cls: "orange",
    },
    {
      label: "جاهز للتسليم",
      value: data?.ready_for_delivery ?? 0,
      icon: "✅",
      cls: "teal",
    },
    {
      label: "الأجهزة المتأخرة",
      value: data?.overdue ?? 0,
      icon: "⚠️",
      cls: "red",
    },
    {
      label: "تحت الضمان",
      value: data?.under_warranty ?? 0,
      icon: "🛡️",
      cls: "blue",
    },
    {
      label: "إيرادات اليوم",
      value: money(data?.revenue_today ?? 0),
      icon: "💰",
      cls: "green",
    },
    {
      label: "إيرادات الشهر",
      value: money(data?.revenue_month ?? 0),
      icon: "📈",
      cls: "green",
    },
    {
      label: "تكلفة قطع الغيار",
      value: money(data?.total_parts_cost ?? 0),
      icon: "🧩",
      cls: "amber",
    },
    {
      label: "إجمالي المصنعية",
      value: money(data?.total_labor ?? 0),
      icon: "👷",
      cls: "purple",
    },
    {
      label: "صافي الأرباح",
      value: money(data?.net_profit ?? 0),
      icon: "💵",
      cls: "green",
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>لوحة تحكم الصيانة</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="date-badge">{fmtDate(today())}</span>
          <button
            className="btn"
            onClick={() =>
              api
                .getMaintenanceDashboard()
                .then(setData)
                .catch((e) => notify(String(e), "error"))
            }
          >
            تحديث
          </button>
        </div>
      </div>

      <div className="cards-grid">
        {cards.map((c) => (
          <div key={c.label} className={`card ${c.cls}`}>
            <div className="card-icon">{c.icon}</div>
            <div>
              <div className="card-value">{c.value}</div>
              <div className="card-label">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <h2>أحدث طلبات الصيانة</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>رقم الصيانة</th>
              <th>العميل</th>
              <th>الجهاز</th>
              <th>الحالة</th>
              <th>التكلفة</th>
              <th>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {data?.recent_orders?.map((o, i) => (
              <tr key={o.id}>
                <td>{i + 1}</td>
                <td>{o.order_no}</td>
                <td>{o.customer_name ?? "-"}</td>
                <td>
                  {o.device_type}
                  {o.device_brand ? ` - ${o.device_brand}` : ""}
                </td>
                <td>
                  <span
                    style={{
                      backgroundColor: STATUS_COLORS[o.status as MaintenanceStatus],
                      color: "#fff",
                      borderRadius: 4,
                      padding: "2px 8px",
                      fontSize: 12,
                    }}
                  >
                    {STATUS_LABELS[o.status as MaintenanceStatus]}
                  </span>
                </td>
                <td>{money(o.total_cost)}</td>
                <td>{fmtDate(o.created_at)}</td>
              </tr>
            ))}
            {(!data?.recent_orders || data.recent_orders.length === 0) && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center" }}>
                  لا توجد طلبات حديثة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
