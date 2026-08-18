import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { Modal, money, useToast } from "../../components/ui";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type MaintenanceStatus,
  type ServiceOrder,
  type ServiceOrderSummary,
} from "../../types";

const STATUS_FLOW_NEXT: Record<string, MaintenanceStatus[]> = {
  received: ["inspection", "cancelled"],
  inspection: ["pending_approval", "repairing", "cancelled"],
  pending_approval: ["repairing", "cancelled"],
  repairing: ["repaired", "pending_parts", "cancelled"],
  pending_parts: ["repairing", "cancelled"],
  repaired: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export function ServiceOrders({
  onNew,
  onView,
}: {
  onNew: () => void;
  onView: (id: number) => void;
}) {
  const [orders, setOrders] = useState<ServiceOrderSummary[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const notify = useToast();

  // Status change modal
  const [statusModalOrder, setStatusModalOrder] = useState<ServiceOrderSummary | null>(null);
  const [newStatus, setNewStatus] = useState<MaintenanceStatus>("received");
  const [statusNotes, setStatusNotes] = useState("");

  // Invoice modal (on delivery)
  const [invoiceOrder, setInvoiceOrder] = useState<ServiceOrder | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listServiceOrders(search || undefined);
      setOrders(data as ServiceOrderSummary[]);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === "all" || o.status === statusFilter;
    if (!matchStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (o.order_no ?? "").toLowerCase().includes(q) ||
      (o.customer_name ?? "").toLowerCase().includes(q) ||
      (o.customer_phone ?? "").toLowerCase().includes(q) ||
      (o.device_model ?? "").toLowerCase().includes(q)
    );
  });

  const totalValue = filtered.reduce((s, o) => s + (o.total_cost ?? 0), 0);

  const openStatusModal = (o: ServiceOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusModalOrder(o);
    const nexts = STATUS_FLOW_NEXT[o.status] || [];
    setNewStatus(nexts[0] || o.status);
    setStatusNotes("");
  };

  const handleChangeStatus = async () => {
    if (!statusModalOrder) return;
    try {
      await api.changeServiceStatus(statusModalOrder.id, newStatus, statusNotes.trim() || undefined);
      notify("تم تغيير الحالة بنجاح");
      setStatusModalOrder(null);
      load();

      // If delivered, open invoice
      if (newStatus === "delivered") {
        try {
          const fullOrder = await api.getServiceOrder(statusModalOrder.id);
          setInvoiceOrder(fullOrder as ServiceOrder);
        } catch (e) {
          notify(String(e), "error");
        }
      }
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const printDeliveryInvoice = () => {
    if (!invoiceOrder) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    const partsHtml = invoiceOrder.parts.map((p, i) =>
      `<tr><td>${i + 1}</td><td>${p.part_name}</td><td>${p.quantity}</td><td>${money(p.cost_price)}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.quantity)}</td></tr>`
    ).join("");
    const totalCost = invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost;
    const taxAmt = totalCost * (invoiceOrder.tax_rate / 100);
    const finalTotal = totalCost + taxAmt - invoiceOrder.discount;
    const profit = finalTotal - invoiceOrder.parts_cost;
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:system-ui,sans-serif;padding:15px;margin:0;font-size:12px;color:#1f2937}
      h2{text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px}
      .row{display:flex;justify-content:space-between;margin:4px 0}
      .lbl{color:#6b7280}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px}
      th{background:#f3f4f6;font-weight:700}
      .total{font-weight:700;border-top:2px solid #333}
      .profit{color:#0f8a5f;font-weight:700}
      .footer{margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center}</style></head><body>
      <h2>فاتورة تسليم جهاز صيانة</h2>
      <div style="text-align:center;color:#6b7280;margin-bottom:12px">رقم أمر الصيانة: <strong style="color:#0f8a5f">${invoiceOrder.order_no}</strong></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:12px">
        <div class="row"><span class="lbl">العميل:</span><strong>${invoiceOrder.customer_name ?? "—"}</strong></div>
        <div class="row"><span class="lbl">الهاتف:</span><strong>${invoiceOrder.customer_phone ?? "—"}</strong></div>
        <div class="row"><span class="lbl">الجهاز:</span><strong>${invoiceOrder.device_type} ${invoiceOrder.device_brand ?? ""} ${invoiceOrder.device_model ?? ""}</strong></div>
        <div class="row"><span class="lbl">اللون:</span><strong>${invoiceOrder.device_color ?? "—"}</strong></div>
      </div>
      ${invoiceOrder.parts.length > 0 ? `
      <h3 style="font-size:13px;margin:8px 0 4px">قطع الغيار المستخدمة</h3>
      <table><thead><tr><th>#</th><th>القطعة</th><th>الكمية</th><th>سعر التكلفة</th><th>سعر البيع</th><th>الإجمالي</th></tr></thead>
      <tbody>${partsHtml}</tbody></table>` : ""}
      <h3 style="font-size:13px;margin:8px 0 4px">تفاصيل التكاليف</h3>
      <table>
        <tr><td>تكلفة قطع الغيار</td><td style="text-align:left">${money(invoiceOrder.parts_cost)}</td></tr>
        <tr><td>أجرة العمل</td><td style="text-align:left">${money(invoiceOrder.labor_cost)}</td></tr>
        <tr><td>رسوم الخدمة</td><td style="text-align:left">${money(invoiceOrder.service_cost)}</td></tr>
        ${invoiceOrder.discount > 0 ? `<tr><td>الخصم</td><td style="text-align:left;color:#dc2626">-${money(invoiceOrder.discount)}</td></tr>` : ""}
        ${invoiceOrder.tax_rate > 0 ? `<tr><td>الضريبة (${invoiceOrder.tax_rate}%)</td><td style="text-align:left">${money(taxAmt)}</td></tr>` : ""}
        <tr class="total"><td>الإجمالي</td><td style="text-align:left">${money(finalTotal)}</td></tr>
        <tr><td>المبلغ المدفوع من العميل</td><td style="text-align:left;color:#10b981;font-weight:700">${money(invoiceOrder.amount_paid)}</td></tr>
        <tr class="total"><td>المتبقي</td><td style="text-align:left;color:${(finalTotal - invoiceOrder.amount_paid) > 0 ? "#dc2626" : "#10b981"}">${money(finalTotal - invoiceOrder.amount_paid)}</td></tr>
      </table>
      <div style="margin-top:12px;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;text-align:center">
        <div style="font-size:13px;color:#6b7280">المكسب الصافي</div>
        <div style="font-size:20px;font-weight:700;color:#0f8a5f">${money(profit)}</div>
      </div>
      <div class="footer">شكراً لثقتكم بنا — صيانة تبارك</div></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  const nextOptions = statusModalOrder ? (STATUS_FLOW_NEXT[statusModalOrder.status] || []) : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>أوامر الصيانة</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث برقم الصيانة أو اسم العميل أو الجهاز..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">كل الحالات</option>
            {(Object.keys(STATUS_LABELS) as MaintenanceStatus[]).map((k) => (
              <option key={k} value={k}>{STATUS_LABELS[k]}</option>
            ))}
          </select>
          <button className="btn primary" onClick={onNew}>+ أمر صيانة جديد</button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>عدد الأوامر: <b>{filtered.length}</b></span>
        <span>الإجمالي: <b>{money(totalValue)}</b></span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>رقم الصيانة</th>
              <th>العميل</th>
              <th>الجهاز</th>
              <th>الماركة/الموديل</th>
              <th>الحالة</th>
              <th>التكلفة</th>
              <th>المدفوع</th>
              <th>المتبقي</th>
              <th>التاريخ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="empty">جارٍ التحميل...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="empty">لا توجد أوامر صيانة.</td></tr>
            )}
            {!loading && filtered.map((o) => {
              const nexts = STATUS_FLOW_NEXT[o.status] || [];
              return (
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => onView(o.id)}>
                  <td>{o.id}</td>
                  <td className="strong">{o.order_no}</td>
                  <td>{o.customer_name ?? "—"}</td>
                  <td>{o.device_type}</td>
                  <td>{[o.device_brand, o.device_model].filter(Boolean).join(" — ") || "—"}</td>
                  <td>
                    <span style={{
                      background: STATUS_COLORS[o.status],
                      color: "#fff",
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontSize: 12,
                      whiteSpace: "nowrap",
                    }}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>{money(o.total_cost)}</td>
                  <td>{money(o.amount_paid)}</td>
                  <td style={{ color: o.remaining > 0 ? "#dc2626" : undefined }}>{money(o.remaining)}</td>
                  <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {nexts.length > 0 && (
                      <button
                        className="btn sm"
                        style={{ fontSize: 11, padding: "3px 10px" }}
                        onClick={(e) => openStatusModal(o, e)}
                      >
                        تغيير الحالة
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Status Change Modal */}
      {statusModalOrder && (
        <Modal title="تغيير الحالة" onClose={() => setStatusModalOrder(null)}>
          <div style={{ marginBottom: 8, color: "#6b7280", fontSize: 13 }}>
            الأمر: <strong>{statusModalOrder.order_no}</strong> — الحالة الحالية: <strong>{STATUS_LABELS[statusModalOrder.status]}</strong>
          </div>
          <label className="field">
            <span>الحالة الجديدة *</span>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as MaintenanceStatus)}>
              {nextOptions.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <label className="field" style={{ marginTop: 10 }}>
            <span>ملاحظات (اختياري)</span>
            <textarea rows={3} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="سبب تغيير الحالة..." />
          </label>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={handleChangeStatus}>تأكيد</button>
            <button className="btn" onClick={() => setStatusModalOrder(null)}>إلغاء</button>
          </div>
        </Modal>
      )}

      {/* Delivery Invoice Modal */}
      {invoiceOrder && (
        <Modal title="فاتورة التسليم" onClose={() => setInvoiceOrder(null)} width="600px">
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 32 }}>✅</span>
            <h3 style={{ margin: "4px 0" }}>تم التسليم بنجاح</h3>
            <p style={{ color: "#6b7280" }}>رقم الأمر: {invoiceOrder.order_no}</p>
          </div>

          <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#6b7280" }}>العميل:</span>
              <strong>{invoiceOrder.customer_name ?? "—"}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ color: "#6b7280" }}>الجهاز:</span>
              <strong>{invoiceOrder.device_type} {invoiceOrder.device_model ?? ""}</strong>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr><td style={{ padding: "4px 0", color: "#6b7280" }}>تكلفة قطع الغيار</td><td style={{ padding: "4px 0", textAlign: "left" }}>{money(invoiceOrder.parts_cost)}</td></tr>
              <tr><td style={{ padding: "4px 0", color: "#6b7280" }}>أجرة العمل</td><td style={{ padding: "4px 0", textAlign: "left" }}>{money(invoiceOrder.labor_cost)}</td></tr>
              <tr><td style={{ padding: "4px 0", color: "#6b7280" }}>رسوم الخدمة</td><td style={{ padding: "4px 0", textAlign: "left" }}>{money(invoiceOrder.service_cost)}</td></tr>
              {invoiceOrder.discount > 0 && (
                <tr><td style={{ padding: "4px 0", color: "#dc2626" }}>الخصم</td><td style={{ padding: "4px 0", textAlign: "left", color: "#dc2626" }}>-{money(invoiceOrder.discount)}</td></tr>
              )}
              {invoiceOrder.tax_rate > 0 && (
                <tr><td style={{ padding: "4px 0", color: "#6b7280" }}>الضريبة ({invoiceOrder.tax_rate}%)</td><td style={{ padding: "4px 0", textAlign: "left" }}>{money((invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost) * (invoiceOrder.tax_rate / 100))}</td></tr>
              )}
              <tr style={{ borderTop: "2px solid #e5e7eb" }}>
                <td style={{ padding: "6px 0", fontWeight: 700, fontSize: 14 }}>الإجمالي</td>
                <td style={{ padding: "6px 0", textAlign: "left", fontWeight: 700, fontSize: 14 }}>
                  {money(invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost - invoiceOrder.discount + ((invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost) * (invoiceOrder.tax_rate / 100)))}
                </td>
              </tr>
              <tr><td style={{ padding: "4px 0", color: "#10b981" }}>المبلغ المدفوع</td><td style={{ padding: "4px 0", textAlign: "left", color: "#10b981", fontWeight: 700 }}>{money(invoiceOrder.amount_paid)}</td></tr>
              <tr><td style={{ padding: "4px 0", fontWeight: 700 }}>المتبقي</td><td style={{ padding: "4px 0", textAlign: "left", fontWeight: 700, color: invoiceOrder.remaining > 0 ? "#dc2626" : "#10b981" }}>{money(invoiceOrder.remaining)}</td></tr>
            </tbody>
          </table>

          <div style={{ marginTop: 12, padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>المكسب الصافي</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#0f8a5f" }}>
              {money(
                (invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost - invoiceOrder.discount + ((invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost) * (invoiceOrder.tax_rate / 100)))
                - invoiceOrder.parts_cost
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={printDeliveryInvoice}>🖨️ طباعة الفاتورة</button>
            <button className="btn" onClick={() => setInvoiceOrder(null)}>إغلاق</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
