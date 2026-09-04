import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { Modal, confirmDialog, money, useToast } from "../../components/ui";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type MaintenanceStatus,
  type ServiceOrder,
  type ServiceOrderSummary,
} from "../../types";

const STATUS_FLOW_NEXT: Record<string, MaintenanceStatus[]> = {
  received: ["delivered", "cancelled"],
  inspection: ["received", "delivered", "cancelled"],
  pending_approval: ["received", "delivered", "cancelled"],
  repairing: ["received", "delivered", "cancelled"],
  pending_parts: ["received", "delivered", "cancelled"],
  repaired: ["received", "delivered", "cancelled"],
  ready: ["received", "delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  rejected: [],
};

const STATUS_ICONS: Record<string, string> = {
  received: "📥",
  inspection: "🔍",
  pending_approval: "⏳",
  repairing: "🔧",
  pending_parts: "📦",
  repaired: "✅",
  ready: "🟢",
  delivered: "🚚",
  cancelled: "❌",
  rejected: "🚫",
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
  const [deliveryAmount, setDeliveryAmount] = useState(0);

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
  const totalPaid = filtered.reduce((s, o) => s + (o.amount_paid ?? 0), 0);
  const totalRemaining = filtered.reduce((s, o) => s + (o.remaining ?? 0), 0);

  const openStatusModal = (o: ServiceOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setStatusModalOrder(o);
    const nexts = STATUS_FLOW_NEXT[o.status] || [];
    setNewStatus(nexts[0] || o.status);
    setStatusNotes("");
    setDeliveryAmount(o.remaining);
  };

  const handleChangeStatus = async () => {
    if (!statusModalOrder) return;
    try {
      if (newStatus === "delivered" && deliveryAmount > 0 && statusModalOrder.remaining > 0) {
        const amount = Math.min(deliveryAmount, statusModalOrder.remaining);
        await api.addServicePayment(statusModalOrder.id, {
          amount,
          payment_method: "cash",
          notes: "المبلغ المدفوع عند التسليم",
        });
      }
      await api.changeServiceStatus(statusModalOrder.id, newStatus, statusNotes.trim() || undefined);
      notify("تم تغيير الحالة بنجاح");
      setStatusModalOrder(null);
      load();

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

  const handleDelete = async (o: ServiceOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDialog(`هل أنت متأكد من حذف أمر الصيانة ${o.order_no}؟`)) return;
    try {
      await api.deleteServiceOrder(o.id);
      notify("تم حذف أمر الصيانة");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const printHtml = (html: string, width: string = "210mm", height: string = "297mm") => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) { document.body.removeChild(frame); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{size:${width} ${height};margin:10mm} *{margin:0;padding:0;box-sizing:border-box} body{font-family:Arial,sans-serif;font-size:12px;color:#000}</style></head><body>${html}</body></html>`);
    doc.close();
    setTimeout(() => {
      frame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(frame), 1000);
    }, 300);
  };

  const printReceipt = async (o: ServiceOrderSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const fullOrder = await api.getServiceOrder(o.id) as ServiceOrder;
      const partsHtml = fullOrder.parts.map((p, i) =>
        `<tr><td>${i + 1}</td><td>${p.part_name}</td><td>${p.quantity}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.quantity)}</td></tr>`
      ).join("");
      const totalCost = fullOrder.parts_cost + fullOrder.labor_cost + fullOrder.service_cost;
      const taxAmt = totalCost * (fullOrder.tax_rate / 100);
      const finalTotal = totalCost + taxAmt - fullOrder.discount;
      printHtml(`<div dir="rtl" lang="ar" style="font-family:system-ui,sans-serif;padding:15px;font-size:12px;color:#1f2937">
        <h2 style="text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px">إيصال صيانة — ${fullOrder.order_no}</h2>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">العميل:</span><strong>${fullOrder.customer_name ?? "—"}</strong></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">الهاتف:</span><strong>${fullOrder.customer_phone ?? "—"}</strong></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">الجهاز:</span><strong>${fullOrder.device_type} ${fullOrder.device_brand ?? ""} ${fullOrder.device_model ?? ""}</strong></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">الحالة:</span><strong>${STATUS_LABELS[fullOrder.status]}</strong></div>
        </div>
        ${fullOrder.parts.length > 0 ? `
        <h3 style="font-size:13px;margin:8px 0 4px">قطع الغيار</h3>
        <table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">#</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">القطعة</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">الكمية</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">السعر</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">الإجمالي</th></tr></thead>
        <tbody>${partsHtml}</tbody></table>` : ""}
        <table style="width:100%;border-collapse:collapse;margin:8px 0">
          <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">قطع الغيار</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(fullOrder.parts_cost)}</td></tr>
          <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">أجرة العمل</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(fullOrder.labor_cost)}</td></tr>
          <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">رسوم الخدمة</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(fullOrder.service_cost)}</td></tr>
          ${fullOrder.discount > 0 ? `<tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الخصم</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:#dc2626">-${money(fullOrder.discount)}</td></tr>` : ""}
          ${fullOrder.tax_rate > 0 ? `<tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الضريبة (${fullOrder.tax_rate}%)</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(taxAmt)}</td></tr>` : ""}
          <tr style="font-weight:700;border-top:2px solid #333"><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الإجمالي</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(finalTotal)}</td></tr>
          <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">المدفوع</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:#10b981;font-weight:700">${money(fullOrder.amount_paid)}</td></tr>
          <tr style="font-weight:700;border-top:2px solid #333"><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">المتبقي</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:${fullOrder.remaining > 0 ? "#dc2626" : "#10b981"}">${money(fullOrder.remaining)}</td></tr>
        </table>
        <div style="margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center">شكراً لثقتكم بنا — صيانة تبارك</div></div>`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const printDeliveryInvoice = () => {
    if (!invoiceOrder) return;
    const partsHtml = invoiceOrder.parts.map((p, i) =>
      `<tr><td>${i + 1}</td><td>${p.part_name}</td><td>${p.quantity}</td><td>${money(p.cost_price)}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.quantity)}</td></tr>`
    ).join("");
    const totalCost = invoiceOrder.parts_cost + invoiceOrder.labor_cost + invoiceOrder.service_cost;
    const taxAmt = totalCost * (invoiceOrder.tax_rate / 100);
    const finalTotal = totalCost + taxAmt - invoiceOrder.discount;
    const profit = finalTotal - invoiceOrder.parts_cost;
    printHtml(`<div dir="rtl" lang="ar" style="font-family:system-ui,sans-serif;padding:15px;font-size:12px;color:#1f2937">
      <h2 style="text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px">فاتورة تسليم جهاز صيانة</h2>
      <div style="text-align:center;color:#6b7280;margin-bottom:12px">رقم أمر الصيانة: <strong style="color:#0f8a5f">${invoiceOrder.order_no}</strong></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">العميل:</span><strong>${invoiceOrder.customer_name ?? "—"}</strong></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">الهاتف:</span><strong>${invoiceOrder.customer_phone ?? "—"}</strong></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span style="color:#6b7280">الجهاز:</span><strong>${invoiceOrder.device_type} ${invoiceOrder.device_brand ?? ""} ${invoiceOrder.device_model ?? ""}</strong></div>
      </div>
      ${invoiceOrder.parts.length > 0 ? `
      <h3 style="font-size:13px;margin:8px 0 4px">قطع الغيار المستخدمة</h3>
      <table style="width:100%;border-collapse:collapse;margin:8px 0"><thead><tr><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">#</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">القطعة</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">الكمية</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">سعر البيع</th><th style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px;background:#f3f4f6;font-weight:700">الإجمالي</th></tr></thead>
      <tbody>${partsHtml}</tbody></table>` : ""}
      <table style="width:100%;border-collapse:collapse;margin:8px 0">
        <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">قطع الغيار</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(invoiceOrder.parts_cost)}</td></tr>
        <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">أجرة العمل</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(invoiceOrder.labor_cost)}</td></tr>
        <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">رسوم الخدمة</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(invoiceOrder.service_cost)}</td></tr>
        ${invoiceOrder.discount > 0 ? `<tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الخصم</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:#dc2626">-${money(invoiceOrder.discount)}</td></tr>` : ""}
        ${invoiceOrder.tax_rate > 0 ? `<tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الضريبة (${invoiceOrder.tax_rate}%)</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(taxAmt)}</td></tr>` : ""}
        <tr style="font-weight:700;border-top:2px solid #333"><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">الإجمالي</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px">${money(finalTotal)}</td></tr>
        <tr><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">المدفوع</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:#10b981;font-weight:700">${money(invoiceOrder.amount_paid)}</td></tr>
        <tr style="font-weight:700;border-top:2px solid #333"><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:right;font-size:11px">المتبقي</td><td style="border:1px solid #d1d5db;padding:5px 8px;text-align:left;font-size:11px;color:${invoiceOrder.remaining > 0 ? "#dc2626" : "#10b981"}">${money(invoiceOrder.remaining)}</td></tr>
      </table>
      <div style="margin-top:12px;padding:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;text-align:center">
        <div style="font-size:12px;color:#6b7280">المكسب الصافي</div>
        <div style="font-size:20px;font-weight:700;color:#0f8a5f">${money(profit)}</div>
      </div>
      <div style="margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center">شكراً لثقتكم بنا — صيانة تبارك</div></div>`);
  };

  const nextOptions = statusModalOrder ? (STATUS_FLOW_NEXT[statusModalOrder.status] || []) : [];

  return (
    <div className="page">
      <div className="page-head">
        <h1>🔧 أوامر الصيانة</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="🔍 بحث برقم الصيانة أو اسم العميل..."
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

      {/* Summary Cards */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160, background: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 600 }}>عدد الأوامر</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a5f" }}>{filtered.length}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>الإجمالي</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#14532d" }}>{money(totalValue)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#166534", fontWeight: 600 }}>المدفوع</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0f8a5f" }}>{money(totalPaid)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 160, background: "linear-gradient(135deg,#fef2f2,#fecaca)", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px" }}>
          <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 600 }}>المتبقي</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#b91c1c" }}>{money(totalRemaining)}</div>
        </div>
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
                  <td>{STATUS_ICONS[o.status] ?? "📱"} {o.device_type}</td>
                  <td>{[o.device_brand, o.device_model].filter(Boolean).join(" — ") || "—"}</td>
                  <td>
                    <span style={{
                      background: STATUS_COLORS[o.status],
                      color: "#fff",
                      padding: "3px 12px",
                      borderRadius: 14,
                      fontSize: 11,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="strong">{money(o.total_cost)}</td>
                  <td style={{ color: "#0f8a5f", fontWeight: 600 }}>{money(o.amount_paid)}</td>
                  <td style={{ color: o.remaining > 0 ? "#dc2626" : undefined, fontWeight: o.remaining > 0 ? 700 : 400 }}>{money(o.remaining)}</td>
                  <td>{o.created_at ? new Date(o.created_at).toLocaleDateString("ar-EG") : "—"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {nexts.length > 0 && (
                        <button
                          className="btn sm"
                          style={{
                            fontSize: 11,
                            padding: "3px 10px",
                            background: "#3b82f6",
                            color: "#fff",
                            border: "none",
                          }}
                          onClick={(e) => openStatusModal(o, e)}
                        >
                          تغيير الحالة
                        </button>
                      )}
                      <button
                        className="btn sm"
                        style={{ fontSize: 11, padding: "3px 10px", background: "#f59e0b", color: "#fff", border: "none" }}
                        onClick={(e) => printReceipt(o, e)}
                      >
                        🖨️
                      </button>
                      <button
                        className="btn sm"
                        style={{ fontSize: 11, padding: "3px 10px", background: "#dc2626", color: "#fff", border: "none" }}
                        onClick={(e) => handleDelete(o, e)}
                      >
                        🗑️
                      </button>
                    </div>
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
            الأمر: <strong>{statusModalOrder.order_no}</strong> — الحالة الحالية: <strong style={{ color: STATUS_COLORS[statusModalOrder.status] }}>{STATUS_LABELS[statusModalOrder.status]}</strong>
          </div>
          <label className="field">
            <span>الحالة الجديدة *</span>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as MaintenanceStatus)}>
              {nextOptions.map((s) => (
                <option key={s} value={s}>{STATUS_ICONS[s]} {STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          {newStatus === "delivered" && statusModalOrder.remaining > 0 && (
            <div style={{ marginTop: 10, padding: 12, background: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "1px solid #fed7aa", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#92400e" }}>المتبقي من الصيانة:</span>
                <strong style={{ color: "#c2410c" }}>{money(statusModalOrder.remaining)}</strong>
              </div>
              <label className="field" style={{ marginBottom: 0 }}>
                <span style={{ color: "#92400e", fontWeight: 600 }}>💰 المبلغ المستلم من العميل</span>
                <input
                  type="number"
                  min={0}
                  max={statusModalOrder.remaining}
                  step="0.01"
                  value={deliveryAmount}
                  onChange={(e) => setDeliveryAmount(Math.min(Number(e.target.value), statusModalOrder.remaining))}
                  placeholder="0"
                  style={{ fontSize: 16, fontWeight: 700, textAlign: "center" }}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12 }}>
                <span style={{ color: "#92400e" }}>المتبقي بعد الدفع:</span>
                <strong style={{ color: statusModalOrder.remaining - deliveryAmount > 0 ? "#dc2626" : "#0f8a5f" }}>
                  {money(statusModalOrder.remaining - deliveryAmount)}
                </strong>
              </div>
            </div>
          )}
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

          {invoiceOrder.remaining > 0 && (
            <div style={{ marginTop: 8, padding: 10, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 13, color: "#166534" }}>
              ✅ تم تسجيل المتبقي ({money(invoiceOrder.remaining)}) في الصندوق تلقائياً
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn primary" onClick={printDeliveryInvoice}>🖨️ طباعة الفاتورة</button>
            <button className="btn" onClick={() => setInvoiceOrder(null)}>إغلاق</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
