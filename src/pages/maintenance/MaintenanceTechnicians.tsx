import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api";
import { Modal, money, today, useToast } from "../../components/ui";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type MaintenanceStatus,
} from "../../types";

interface EmpStat {
  employee_id: number;
  employee_name: string;
  total_orders: number;
  delivered_orders: number;
  labor_balance: number;
  orders: {
    id: number;
    order_no: string;
    customer_name: string | null;
    device_type: string;
    device_brand: string | null;
    device_model: string | null;
    status: string;
    total_cost: number;
    labor_cost: number;
    created_at: string | null;
  }[];
}

export function MaintenanceTechnicians() {
  const [stats, setStats] = useState<EmpStat[]>([]);
  const [loading, setLoading] = useState(true);
  const notify = useToast();

  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today());

  const [reportEmp, setReportEmp] = useState<EmpStat | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getEmployeeMaintenanceStats(fromDate, toDate);
      setStats(data as EmpStat[]);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const reportOrders = useMemo(() => {
    if (!reportEmp) return [];
    return reportEmp.orders.filter((o) => {
      if (reportFromDate && o.created_at && o.created_at.slice(0, 10) < reportFromDate) return false;
      if (reportToDate && o.created_at && o.created_at.slice(0, 10) > reportToDate) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        return (
          (o.order_no ?? "").toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.device_type ?? "").toLowerCase().includes(q) ||
          (o.device_model ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [reportEmp, reportSearch, reportFromDate, reportToDate]);

  const printEmployeeReport = () => {
    if (!reportEmp) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    const rowsHtml = reportOrders.map((o, i) =>
      `<tr>
        <td>${i + 1}</td>
        <td>${o.order_no}</td>
        <td>${o.customer_name ?? "—"}</td>
        <td>${o.device_type} ${o.device_model ?? ""}</td>
        <td>${STATUS_LABELS[o.status as MaintenanceStatus] ?? o.status}</td>
        <td>${money(o.total_cost)}</td>
        <td>${money(o.labor_cost)}</td>
        <td>${o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG") : "—"}</td>
      </tr>`
    ).join("");
    const totalCost = reportOrders.reduce((s, o) => s + (o.total_cost || 0), 0);
    const totalLabor = reportOrders.reduce((s, o) => s + (o.labor_cost || 0), 0);
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:system-ui,sans-serif;padding:15px;margin:0;font-size:12px;color:#1f2937}
      h2{text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px}
      .info{text-align:center;color:#6b7280;margin-bottom:10px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px}
      th{background:#f3f4f6;font-weight:700}
      .total{font-weight:700;background:#f0fdf4;border-top:2px solid #0f8a5f}
      .footer{margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center}
      @media print{body{padding:10px}}</style></head><body>
      <h2>تقرير أعمال الصيانة — ${reportEmp.employee_name}</h2>
      <div class="info">من: ${reportFromDate || fromDate} إلى: ${reportToDate || toDate} | العدد: ${reportOrders.length} أمر</div>
      <table>
        <thead><tr><th>#</th><th>رقم الأمر</th><th>العميل</th><th>الجهاز</th><th>الحالة</th><th>التكلفة</th><th>أجرة العمل</th><th>التاريخ</th></tr></thead>
        <tbody>${rowsHtml}
        <tr class="total"><td colspan="5">الإجمالي</td><td>${money(totalCost)}</td><td>${money(totalLabor)}</td><td></td></tr>
        </tbody>
      </table>
      <div class="footer">تقرير موظفي الصيانة — تبارك — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>👥 موظفو الصيانة</h1>
        <div className="head-actions">
          <div className="field">
            <span>من تاريخ</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field">
            <span>إلى تاريخ</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button className="btn sm" onClick={load} disabled={loading}>
            🔄 تحديث
          </button>
        </div>
      </div>

      {loading ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p>جارٍ تحميل البيانات...</p>
        </div>
      ) : stats.length === 0 ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 16, color: "#6b7280" }}>لا توجد بيانات في هذه الفترة.</p>
        </div>
      ) : (
        <>
          <div className="toolbar-info">
            <span>عدد الموظفين: <b>{stats.length}</b></span>
            <span>الفترة: <b>{fromDate}</b> إلى <b>{toDate}</b></span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الموظف</th>
                  <th>عدد أعمال الصيانة</th>
                  <th>أعمال مسلّمة</th>
                  <th>رصيد أجيرة العمل</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={s.employee_id}>
                    <td>{i + 1}</td>
                    <td className="strong">{s.employee_name}</td>
                    <td className="strong">{s.total_orders}</td>
                    <td className="strong text-green">{s.delivered_orders}</td>
                    <td className="strong" style={{ color: "#0f8a5f" }}>{money(s.labor_balance)}</td>
                    <td>
                      <button
                        className="btn sm"
                        style={{ fontSize: 12 }}
                        onClick={() => {
                          setReportEmp(s);
                          setReportSearch("");
                          setReportFromDate(fromDate);
                          setReportToDate(toDate);
                        }}
                      >
                        📊 التقارير
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {reportEmp && (
        <Modal
          title={`تقرير — ${reportEmp.employee_name}`}
          onClose={() => setReportEmp(null)}
          width="800px"
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              className="search"
              style={{ flex: 2, minWidth: 180 }}
              placeholder="بحث برقم الأمر أو اسم العميل أو الجهاز..."
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
            />
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <span>من</span>
              <input type="date" value={reportFromDate} onChange={(e) => setReportFromDate(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 130 }}>
              <span>إلى</span>
              <input type="date" value={reportToDate} onChange={(e) => setReportToDate(e.target.value)} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13, color: "#6b7280", flexWrap: "wrap" }}>
            <span>الإجمالي: <strong>{reportOrders.length}</strong> أمر</span>
            <span>التكلفة: <strong>{money(reportOrders.reduce((s, o) => s + (o.total_cost || 0), 0))}</strong></span>
            <span>أجرة العمل: <strong style={{ color: "#0f8a5f" }}>{money(reportOrders.reduce((s, o) => s + (o.labor_cost || 0), 0))}</strong></span>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>رقم الأمر</th>
                  <th>العميل</th>
                  <th>الجهاز</th>
                  <th>الحالة</th>
                  <th>التكلفة</th>
                  <th>أجرة العمل</th>
                  <th>التاريخ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reportOrders.length === 0 && (
                  <tr><td colSpan={9} className="empty">لا توجد نتائج في هذه الفترة.</td></tr>
                )}
                {reportOrders.map((o, i) => (
                  <tr key={o.id}>
                    <td>{i + 1}</td>
                    <td className="strong">{o.order_no}</td>
                    <td>{o.customer_name ?? "—"}</td>
                    <td>{o.device_type} {o.device_model ?? ""}</td>
                    <td>
                      <span style={{
                        background: STATUS_COLORS[o.status as MaintenanceStatus] ?? "#6b7280",
                        color: "#fff",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                        whiteSpace: "nowrap",
                      }}>
                        {STATUS_LABELS[o.status as MaintenanceStatus] ?? o.status}
                      </span>
                    </td>
                    <td>{money(o.total_cost)}</td>
                    <td style={{ color: "#0f8a5f" }}>{money(o.labor_cost)}</td>
                    <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                    <td>
                      <button
                        className="btn sm"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={() => {
                          setReportEmp(null);
                          window.dispatchEvent(new CustomEvent("navigate-maint-detail", { detail: o.id }));
                        }}
                      >
                        عرض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={printEmployeeReport}>🖨️ طباعة التقرير</button>
            <button className="btn" onClick={() => setReportEmp(null)}>إغلاق</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
