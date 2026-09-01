import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { Field, Modal, confirmDialog, money, fmtDate, today, useToast } from "../../components/ui";
import { printMaintenanceBarcode } from "../../utils/printBarcode";
import { QRCodeCanvas } from "qrcode.react";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  type MaintenanceStatus,
  type ServiceOrder,
  type ServiceTechnician,
  type ServicePart,
  type ServicePayment,
  type StatusHistory,
  type Employee,
} from "../../types";

type TabId = "info" | "technicians" | "parts" | "costs" | "payments" | "images" | "history" | "approval" | "qr";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "المعلومات" },
  { id: "technicians", label: "الفنيين" },
  { id: "parts", label: "قطع الغيار" },
  { id: "costs", label: "التكاليف" },
  { id: "payments", label: "الدفعات" },
  { id: "images", label: "الصور" },
  { id: "history", label: "السجل" },
  { id: "approval", label: "الموافقة" },
  { id: "qr", label: "QR / باركود" },
];

const STATUS_FLOW: MaintenanceStatus[] = [
  "received", "inspection", "pending_approval", "repairing",
  "pending_parts", "repaired", "ready", "delivered", "cancelled", "rejected",
];

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "بطاقة" },
  { value: "transfer", label: "تحويل" },
  { value: "electronic", label: "إلكتروني" },
  { value: "other", label: "أخرى" },
];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "بطاقة",
  transfer: "تحويل",
  electronic: "إلكتروني",
  other: "أخرى",
};

export function ServiceOrderDetail({
  orderId,
  onBack,
}: {
  orderId: number;
  onBack: () => void;
}) {
  const notify = useToast();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [storeName, setStoreName] = useState("");

  // Modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showTechModal, setShowTechModal] = useState(false);
  const [showPartModal, setShowPartModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Status change
  const [newStatus, setNewStatus] = useState<MaintenanceStatus>("received");
  const [statusNotes, setStatusNotes] = useState("");

  // Assign technician
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [techEmployeeId, setTechEmployeeId] = useState<number>(0);
  const [techWorkType, setTechWorkType] = useState("");
  const [techNotes, setTechNotes] = useState("");

  // Add part
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partCost, setPartCost] = useState(0);
  const [partSell, setPartSell] = useState(0);

  // Add payment
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [payNotes, setPayNotes] = useState("");

  // Cost editing
  const [editPartsCost, setEditPartsCost] = useState(0);
  const [editLaborCost, setEditLaborCost] = useState(0);
  const [editServiceCost, setEditServiceCost] = useState(0);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editTaxRate, setEditTaxRate] = useState(0);
  const [savingCosts, setSavingCosts] = useState(false);

  // Approval
  const [approvalPrice, setApprovalPrice] = useState<number | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");

  const loadOrder = useCallback(async () => {
    try {
      const data = await api.getServiceOrder(orderId);
      setOrder(data as ServiceOrder);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [orderId, notify]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (order) {
      setEditPartsCost(order.parts_cost);
      setEditLaborCost(order.labor_cost);
      setEditServiceCost(order.service_cost);
      setEditDiscount(order.discount);
      setEditTaxRate(order.tax_rate);
      setApprovalPrice(order.approval_price);
    }
  }, [order]);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await api.listEmployees();
      setEmployees(data);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    api.getSettings().then((s) => setStoreName(s.store_name || "")).catch(() => {});
  }, []);

  const nextStatuses = STATUS_FLOW.filter(
    (s) => s !== order?.status && s !== "received"
  );

  // ---- Handlers ----

  const handleChangeStatus = async () => {
    if (!order) return;
    if (!newStatus) {
      notify("اختر الحالة الجديدة", "error");
      return;
    }
    try {
      await api.changeServiceStatus(order.id, newStatus, statusNotes.trim() || undefined);
      notify("تم تغيير الحالة بنجاح");
      setShowStatusModal(false);
      setNewStatus("received");
      setStatusNotes("");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleAssignTech = async () => {
    if (!order) return;
    if (!techEmployeeId) {
      notify("اختر الفني", "error");
      return;
    }
    try {
      await api.assignTechnician(order.id, {
        technician_id: techEmployeeId,
        work_type: techWorkType.trim() || null,
        notes: techNotes.trim() || null,
      });
      notify("تم تعيين الفني بنجاح");
      setShowTechModal(false);
      setTechEmployeeId(0);
      setTechWorkType("");
      setTechNotes("");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleRemoveTech = async (techId: number) => {
    if (!confirmDialog("هل أنت متأكد من إزالة الفني؟")) return;
    try {
      await api.removeTechnician(techId);
      notify("تم إزالة الفني");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleAddPart = async () => {
    if (!order) return;
    if (!partName.trim()) {
      notify("أدخل اسم القطعة", "error");
      return;
    }
    if (partQty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر", "error");
      return;
    }
    try {
      await api.addServicePart(order.id, {
        part_name: partName.trim(),
        quantity: partQty,
        cost_price: partCost,
        sell_price: partSell,
      });
      notify("تمت إضافة القطعة بنجاح");
      setShowPartModal(false);
      setPartName("");
      setPartQty(1);
      setPartCost(0);
      setPartSell(0);
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleRemovePart = async (partId: number) => {
    if (!confirmDialog("هل أنت متأكد من حذف القطعة؟")) return;
    try {
      await api.removeServicePart(partId);
      notify("تم حذف القطعة");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleAddPayment = async () => {
    if (!order) return;
    if (payAmount <= 0) {
      notify("أدخل مبلغ صحيح", "error");
      return;
    }
    try {
      await api.addServicePayment(order.id, {
        amount: payAmount,
        payment_method: payMethod,
        notes: payNotes.trim() || null,
      });
      notify("تم تسجيل الدفعة بنجاح");
      setShowPaymentModal(false);
      setPayAmount(0);
      setPayMethod("cash");
      setPayNotes("");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleSaveCosts = async () => {
    if (!order) return;
    setSavingCosts(true);
    try {
      await api.updateServiceOrder(order.id, {
        parts_cost: editPartsCost,
        labor_cost: editLaborCost,
        service_cost: editServiceCost,
        discount: editDiscount,
        tax_rate: editTaxRate,
      });
      notify("تم حفظ التكاليف بنجاح");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setSavingCosts(false);
    }
  };

  const handleApproval = async (status: string) => {
    if (!order) return;
    try {
      await api.changeServiceStatus(
        order.id,
        status === "approved" ? "repairing" : status === "rejected" ? "rejected" : "received",
        `Approval: ${status}`
      );
      await api.updateServiceOrder(order.id, {
        customer_approval: status,
        approval_date: today(),
        approval_price: approvalPrice,
        approval_notes: approvalNotes.trim() || null,
      });
      notify("تم تحديث حالة الموافقة");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    if (!confirmDialog("هل أنت متأكد من إلغاء أمر الصيانة؟")) return;
    try {
      await api.changeServiceStatus(order.id, "cancelled", "تم الإلغاء");
      notify("تم إلغاء أمر الصيانة");
      loadOrder();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  // ---- Print Barcode ----
  const handlePrintBarcode = () => {
    if (!order) return;
    printMaintenanceBarcode({
      barcodeValue: order.order_no,
      orderNo: order.order_no,
      customerName: order.customer_name ?? "",
      customerPhone: order.customer_phone,
      deviceType: order.device_type,
      deviceModel: order.device_model,
      complaint: order.customer_complaint,
      total: order.parts_cost + order.labor_cost + order.service_cost,
      date: fmtDate(order.created_at),
      storeName,
    });
  };

  // ---- Print Delivery Receipt ----
  const handlePrintReceipt = () => {
    if (!order) return;
    const frame = document.createElement("iframe");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    const partsHtml = order.parts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.part_name}</td><td>${p.quantity}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.quantity)}</td></tr>`).join("");
    const paymentsHtml = order.payments.map((p, i) => `<tr><td>${i + 1}</td><td>${money(p.amount)}</td><td>${p.payment_method === "cash" ? "نقدي" : p.payment_method === "card" ? "بطاقة" : p.payment_method === "transfer" ? "تحويل" : p.payment_method}</td><td>${p.date ?? ""}</td></tr>`).join("");
    const taxAmt = (order.parts_cost + order.labor_cost + order.service_cost) * (order.tax_rate / 100);
    const finalTotal = order.parts_cost + order.labor_cost + order.service_cost - order.discount + taxAmt;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head><meta charset="utf-8"><title>إيصال تسليم - ${order.order_no}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:15px;margin:0;color:#1f2937;font-size:12px}
        h2{text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px;font-size:16px}
        .info-row{display:flex;justify-content:space-between;margin:3px 0}
        .info-label{color:#6b7280}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th,td{border:1px solid #d1d5db;padding:4px 8px;text-align:right;font-size:11px}
        th{background:#f3f4f6;font-weight:700}
        .total-row{font-weight:700;border-top:2px solid #333}
        .footer{margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center}
        .signature{margin-top:30px;display:flex;justify-content:space-between}
        .sig-line{border-top:1px solid #333;width:200px;text-align:center;padding-top:4px;font-size:11px}
        @media print{body{padding:10px}}
      </style></head>
      <body>
        <h2>إيصال استلام جهاز</h2>
        <div style="text-align:center;color:#6b7280;margin-bottom:10px">رقم أمر الصيانة: <strong style="color:#0f8a5f">${order.order_no}</strong></div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px">
          <div class="info-row"><span class="info-label">العميل:</span><strong>${order.customer_name ?? "—"}</strong></div>
          <div class="info-row"><span class="info-label">الهاتف:</span><strong>${order.customer_phone ?? "—"}</strong></div>
          <div class="info-row"><span class="info-label">الجهاز:</span><strong>${order.device_type} ${order.device_brand ?? ""} ${order.device_model ?? ""}</strong></div>
          <div class="info-row"><span class="info-label">الحالة:</span><strong>${STATUS_LABELS[order.status]}</strong></div>
          ${order.delivered_to ? `<div class="info-row"><span class="info-label">المستلم:</span><strong>${order.delivered_to}</strong></div>` : ""}
          ${order.delivered_date ? `<div class="info-row"><span class="info-label">تاريخ التسليم:</span><strong>${fmtDate(order.delivered_date)}</strong></div>` : ""}
        </div>
        ${order.parts.length > 0 ? `
        <h3 style="font-size:13px;margin:8px 0 4px">قطع الغيار</h3>
        <table><thead><tr><th>#</th><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
        <tbody>${partsHtml}</tbody></table>` : ""}
        <h3 style="font-size:13px;margin:8px 0 4px">التكاليف</h3>
        <table>
          <tr><td>قطع الغيار</td><td style="text-align:left">${money(order.parts_cost)}</td></tr>
          <tr><td>أجرة العمل</td><td style="text-align:left">${money(order.labor_cost)}</td></tr>
          <tr><td>رسوم الخدمة</td><td style="text-align:left">${money(order.service_cost)}</td></tr>
          ${order.discount > 0 ? `<tr><td>الخصم</td><td style="text-align:left;color:#dc2626">-${money(order.discount)}</td></tr>` : ""}
          ${order.tax_rate > 0 ? `<tr><td>الضريبة (${order.tax_rate}%)</td><td style="text-align:left">${money(taxAmt)}</td></tr>` : ""}
          <tr class="total-row"><td>الإجمالي</td><td style="text-align:left">${money(finalTotal)}</td></tr>
          <tr><td>المدفوع</td><td style="text-align:left;color:#10b981">${money(order.amount_paid)}</td></tr>
          <tr class="total-row"><td>المتبقي</td><td style="text-align:left;color:${(finalTotal - order.amount_paid) > 0 ? "#dc2626" : "#10b981"}">${money(finalTotal - order.amount_paid)}</td></tr>
        </table>
        ${order.warranty_end ? `<div style="margin-top:8px;color:#6b7280"><strong>الضمان:</strong> حتى ${fmtDate(order.warranty_end)}</div>` : ""}
        ${paymentsHtml ? `<h3 style="font-size:13px;margin:8px 0 4px">الدفعات</h3><table><thead><tr><th>#</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead><tbody>${paymentsHtml}</tbody></table>` : ""}
        <div class="signature">
          <div class="sig-line">توقيع المستلم</div>
          <div class="sig-line">توقيع الموظف</div>
        </div>
        <div class="footer">شكراً لثقتكم بنا — صيانة تبارك</div>
      </body></html>
    `);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  // ---- Calculations ----
  const calculatedTotal = (editPartsCost + editLaborCost + editServiceCost);
  const taxAmount = calculatedTotal * (editTaxRate / 100);
  const calculatedFinal = calculatedTotal + taxAmount - editDiscount;
  const remaining = calculatedFinal - (order?.amount_paid ?? 0);

  if (loading) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>تفاصيل أمر الصيانة</h1>
        </div>
        <p style={{ textAlign: "center", padding: 40 }}>جارٍ التحميل...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>تفاصيل أمر الصيانة</h1>
        </div>
        <p style={{ textAlign: "center", padding: 40 }}>الأمر غير موجود.</p>
      </div>
    );
  }

  return (
    <div className="page">
      {/* ---- Header ---- */}
      <div className="page-head" style={{ flexWrap: "wrap", gap: 8 }}>
        <button className="btn" onClick={onBack}>
          &rarr; العودة
        </button>
        <h1 style={{ margin: 0 }}>{order.order_no}</h1>
        <span
          className="badge"
          style={{
            background: STATUS_COLORS[order.status],
            color: "#fff",
            padding: "3px 14px",
            borderRadius: 14,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {STATUS_LABELS[order.status]}
        </span>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          {order.customer_name ?? "عميل غير مسجل"} &mdash; {order.device_type}
          {order.device_brand ? ` / ${order.device_brand}` : ""}
          {order.device_model ? ` ${order.device_model}` : ""}
        </span>
      </div>

      {/* ---- Quick Actions ---- */}
      <div className="settings-card" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 16px" }}>
        <button className="btn primary" onClick={() => {
          setNewStatus(order.status);
          setShowStatusModal(true);
        }}>
          تغيير الحالة
        </button>
        <button className="btn" onClick={() => setShowTechModal(true)}>
          إضافة فني
        </button>
        <button className="btn" onClick={() => setShowPartModal(true)}>
          إضافة قطعة
        </button>
        <button className="btn" onClick={() => setShowPaymentModal(true)}>
          تسجيل دفعة
        </button>
        <button className="btn" onClick={handlePrintBarcode} title="طباعة باركود">
          🏷️ طباعة باركود
        </button>
        <button className="btn" onClick={handlePrintReceipt} title="طباعة إيصال">
          🖨️ طباعة إيصال
        </button>
        <button className="btn danger" onClick={handleDelete}>
          حذف
        </button>
      </div>

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 16, overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className="btn"
            style={{
              borderBottom: activeTab === tab.id ? "2px solid #3b82f6" : "2px solid transparent",
              marginBottom: -2,
              borderRadius: "8px 8px 0 0",
              fontWeight: activeTab === tab.id ? 700 : 400,
              color: activeTab === tab.id ? "#3b82f6" : "#374151",
              background: activeTab === tab.id ? "#eff6ff" : "transparent",
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== Tab Content ==================== */}

      {/* ---- Tab 1: المعلومات ---- */}
      {activeTab === "info" && (
        <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="settings-card">
            <h3>بيانات الجهاز</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "6px 0", color: "#6b7280", width: 140 }}>نوع الجهاز</td><td style={{ padding: "6px 0", fontWeight: 600 }}>{order.device_type}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>الماركة</td><td style={{ padding: "6px 0" }}>{order.device_brand ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>الموديل</td><td style={{ padding: "6px 0" }}>{order.device_model ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>الرقم التسلسلي</td><td style={{ padding: "6px 0" }}>{order.serial_number ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>IMEI</td><td style={{ padding: "6px 0" }}>{order.imei ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>اللون</td><td style={{ padding: "6px 0" }}>{order.device_color ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>حالة الجهاز</td><td style={{ padding: "6px 0" }}>{order.device_condition ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>الأكسسوارات</td><td style={{ padding: "6px 0" }}>{order.accessories ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>كلمة المرور</td><td style={{ padding: "6px 0" }}>{order.device_password ?? "—"}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="settings-card">
            <h3>وصف العطل والإصلاح</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "6px 0", color: "#6b7280", width: 140 }}>شكوى العميل</td><td style={{ padding: "6px 0" }}>{order.customer_complaint ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>التشخيص</td><td style={{ padding: "6px 0" }}>{order.diagnosis ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>إجراء الإصلاح</td><td style={{ padding: "6px 0" }}>{order.repair_action ?? "—"}</td></tr>
                <tr><td style={{ padding: "6px 0", color: "#6b7280" }}>ملاحظات الفني</td><td style={{ padding: "6px 0" }}>{order.technician_notes ?? "—"}</td></tr>
              </tbody>
            </table>
          </div>

          <div className="settings-card" style={{ gridColumn: "1 / -1" }}>
            <h3>معلومات العميل</h3>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div><span style={{ color: "#6b7280" }}>الاسم: </span><strong>{order.customer_name ?? "—"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>الهاتف: </span><strong>{order.customer_phone ?? "—"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>الضمان حتى: </span><strong>{order.warranty_end ? fmtDate(order.warranty_end) : "—"}</strong></div>
              <div><span style={{ color: "#6b7280" }}>تاريخ الإنشاء: </span><strong>{order.created_at ? fmtDate(order.created_at) : "—"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tab 2: الفنيين ---- */}
      {activeTab === "technicians" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button className="btn primary" onClick={() => setShowTechModal(true)}>
              + تعيين فني
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الفني</th>
                  <th>نوع العمل</th>
                  <th>تاريخ البدء</th>
                  <th>تاريخ الانتهاء</th>
                  <th>ملاحظات</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {order.technicians.length === 0 && (
                  <tr><td colSpan={7} className="empty">لا يوجد فنيين معينين.</td></tr>
                )}
                {order.technicians.map((t: ServiceTechnician, i: number) => (
                  <tr key={t.id}>
                    <td>{i + 1}</td>
                    <td className="strong">{t.technician_name}</td>
                    <td>{t.work_type ?? "—"}</td>
                    <td>{t.start_time ? fmtDate(t.start_time) : "—"}</td>
                    <td>{t.end_time ? fmtDate(t.end_time) : "—"}</td>
                    <td>{t.notes ?? "—"}</td>
                    <td>
                      <button className="btn danger sm" onClick={() => handleRemoveTech(t.id)}>
                        إزالة
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Tab 3: قطع الغيار ---- */}
      {activeTab === "parts" && (
        <div>
          <div style={{ marginBottom: 12 }}>
            <button className="btn primary" onClick={() => setShowPartModal(true)}>
              + إضافة قطعة
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>القطعة</th>
                  <th>الكمية</th>
                  <th>سعر التكلفة</th>
                  <th>سعر البيع</th>
                  <th>الإجمالي</th>
                  <th>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {order.parts.length === 0 && (
                  <tr><td colSpan={7} className="empty">لا توجد قطع غيار.</td></tr>
                )}
                {order.parts.map((p: ServicePart, i: number) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td className="strong">{p.part_name}</td>
                    <td>{p.quantity}</td>
                    <td>{money(p.cost_price)}</td>
                    <td>{money(p.sell_price)}</td>
                    <td>{money(p.sell_price * p.quantity)}</td>
                    <td>
                      <button className="btn danger sm" onClick={() => handleRemovePart(p.id)}>
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Tab 4: التكاليف ---- */}
      {activeTab === "costs" && (
        <div className="settings-card" style={{ maxWidth: 520 }}>
          <h3>تفاصيل التكاليف</h3>
          <Field label="تكلفة القطع">
            <input
              type="number"
              min={0}
              step="0.01"
              value={editPartsCost}
              onChange={(e) => setEditPartsCost(Number(e.target.value))}
            />
          </Field>
          <Field label="أجرة العمل">
            <input
              type="number"
              min={0}
              step="0.01"
              value={editLaborCost}
              onChange={(e) => setEditLaborCost(Number(e.target.value))}
            />
          </Field>
          <Field label="رسوم الخدمة">
            <input
              type="number"
              min={0}
              step="0.01"
              value={editServiceCost}
              onChange={(e) => setEditServiceCost(Number(e.target.value))}
            />
          </Field>
          <Field label="الخصم">
            <input
              type="number"
              min={0}
              step="0.01"
              value={editDiscount}
              onChange={(e) => setEditDiscount(Number(e.target.value))}
            />
          </Field>
          <Field label="نسبة الضريبة %">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={editTaxRate}
              onChange={(e) => setEditTaxRate(Number(e.target.value))}
            />
          </Field>

          <div style={{ marginTop: 16, padding: "12px 0", borderTop: "2px solid #e5e7eb" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>قطع الغيار:</span>
              <strong>{money(editPartsCost)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>أجرة العمل:</span>
              <strong>{money(editLaborCost)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>رسوم الخدمة:</span>
              <strong>{money(editServiceCost)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>الخصم:</span>
              <strong style={{ color: "#dc2626" }}>-{money(editDiscount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span>الضريبة ({editTaxRate}%):</span>
              <strong>{money(taxAmount)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 16, fontWeight: 700, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
              <span>الإجمالي:</span>
              <strong>{money(calculatedFinal)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#3b82f6" }}>
              <span>المدفوع:</span>
              <strong>{money(order.amount_paid)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700, color: remaining > 0 ? "#dc2626" : "#10b981" }}>
              <span>المتبقي:</span>
              <strong>{money(remaining)}</strong>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={handleSaveCosts} disabled={savingCosts}>
              {savingCosts ? "جارٍ الحفظ..." : "حفظ التكاليف"}
            </button>
          </div>
        </div>
      )}

      {/* ---- Tab 5: الدفعات ---- */}
      {activeTab === "payments" && (
        <div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <button className="btn primary" onClick={() => setShowPaymentModal(true)}>
              + إضافة دفعة
            </button>
            <span style={{ color: "#6b7280" }}>
              إجمالي المدفوع: <strong style={{ color: "#3b82f6" }}>{money(order.amount_paid)}</strong>
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>المبلغ</th>
                  <th>طريقة الدفع</th>
                  <th>التاريخ</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {order.payments.length === 0 && (
                  <tr><td colSpan={5} className="empty">لا توجد دفعات مسجلة.</td></tr>
                )}
                {order.payments.map((p: ServicePayment, i: number) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td className="strong" style={{ color: "#10b981" }}>{money(p.amount)}</td>
                    <td>{PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}</td>
                    <td>{p.date ? fmtDate(p.date) : "—"}</td>
                    <td>{p.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- Tab 6: الصور ---- */}
      {activeTab === "images" && (
        <div>
          <div className="cards-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            {order.images.length === 0 && (
              <div className="settings-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 30, color: "#9ca3af" }}>
                لا توجد صور مرفقة.
              </div>
            )}
            {order.images.map((img) => (
              <div key={img.id} className="card" style={{ padding: 12, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{img.image_type}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{img.description ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Tab 7: السجل ---- */}
      {activeTab === "history" && (
        <div className="settings-card" style={{ maxWidth: 640 }}>
          <h3>سجل تغييرات الحالة</h3>
          {order.history.length === 0 && (
            <p style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>لا يوجد سجل.</p>
          )}
          <div style={{ position: "relative", paddingRight: 24 }}>
            <div style={{ position: "absolute", right: 8, top: 0, bottom: 0, width: 2, background: "#e5e7eb" }} />
            {order.history.map((h: StatusHistory) => (
              <div key={h.id} style={{ position: "relative", marginBottom: 20, paddingRight: 20 }}>
                <div
                  style={{
                    position: "absolute",
                    right: -12,
                    top: 6,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: STATUS_COLORS[h.new_status as MaintenanceStatus] ?? "#6b7280",
                    border: "2px solid #fff",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  {h.old_status && (
                    <span
                      className="badge"
                      style={{
                        background: STATUS_COLORS[h.old_status as MaintenanceStatus] ?? "#9ca3af",
                        color: "#fff",
                        padding: "1px 8px",
                        borderRadius: 10,
                        fontSize: 11,
                      }}
                    >
                      {STATUS_LABELS[h.old_status as MaintenanceStatus] ?? h.old_status}
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#6b7280" }}>&rarr;</span>
                  <span
                    className="badge"
                    style={{
                      background: STATUS_COLORS[h.new_status as MaintenanceStatus] ?? "#6b7280",
                      color: "#fff",
                      padding: "1px 8px",
                      borderRadius: 10,
                      fontSize: 11,
                    }}
                  >
                    {STATUS_LABELS[h.new_status as MaintenanceStatus] ?? h.new_status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {h.changed_by_name ?? "النظام"} &mdash; {h.created_at ? fmtDate(h.created_at) : ""}
                </div>
                {h.notes && (
                  <div style={{ fontSize: 13, marginTop: 4, color: "#374151" }}>{h.notes}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Tab 8: الموافقة ---- */}
      {activeTab === "approval" && (
        <div className="settings-card" style={{ maxWidth: 480 }}>
          <h3>موافقة العميل</h3>

          <div style={{ marginBottom: 16 }}>
            <span style={{ color: "#6b7280" }}>الحالة الحالية: </span>
            <span
              className="badge"
              style={{
                background:
                  order.customer_approval === "approved"
                    ? "#10b981"
                    : order.customer_approval === "rejected"
                    ? "#dc2626"
                    : order.customer_approval === "no_response"
                    ? "#f59e0b"
                    : "#9ca3af",
                color: "#fff",
                padding: "2px 12px",
                borderRadius: 12,
                fontSize: 13,
              }}
            >
              {order.customer_approval === "approved"
                ? "موافق"
                : order.customer_approval === "rejected"
                ? "مرفوض"
                : order.customer_approval === "no_response"
                ? "لم يرد"
                : "بانتظار الموافقة"}
            </span>
          </div>

          {order.approval_date && (
            <div style={{ marginBottom: 12, color: "#6b7280" }}>
              تاريخ الموافقة: <strong>{fmtDate(order.approval_date)}</strong>
            </div>
          )}

          {order.approval_price != null && (
            <div style={{ marginBottom: 12, color: "#6b7280" }}>
              سعر الموافقة: <strong>{money(order.approval_price)}</strong>
            </div>
          )}

          {order.approval_notes && (
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: "#6b7280" }}>ملاحظات الموافقة: </span>
              <span>{order.approval_notes}</span>
            </div>
          )}

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginTop: 16 }}>
            <Field label="سعر الموافقة">
              <input
                type="number"
                min={0}
                step="0.01"
                value={approvalPrice ?? ""}
                onChange={(e) => setApprovalPrice(e.target.value ? Number(e.target.value) : null)}
              />
            </Field>

            <Field label="ملاحظات">
              <textarea
                rows={3}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
              />
            </Field>

            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn primary" onClick={() => handleApproval("approved")}>
                موافق
              </button>
              <button className="btn danger" onClick={() => handleApproval("rejected")}>
                رفض
              </button>
              <button className="btn" onClick={() => handleApproval("no_response")}>
                لم يرد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tab 9: QR / باركود ---- */}
      {activeTab === "qr" && (
        <div className="cards-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div className="settings-card" style={{ textAlign: "center" }}>
            <h3>QR Code</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>للمتابعة عبر الموبايل</p>
            <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <QRCodeCanvas
                value={order.order_no}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
                includeMargin={false}
              />
            </div>
            <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>{order.order_no}</div>
            <div style={{ fontSize: 13, color: "#6b7280" }}>{STATUS_LABELS[order.status]}</div>
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => {
                const canvas = document.querySelector("canvas") as HTMLCanvasElement;
                if (!canvas) return;
                const link = document.createElement("a");
                link.download = `${order.order_no}_qr.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
                notify("تم تحميل QR Code");
              }}>
                📥 تحميل QR
              </button>
            </div>
          </div>

          <div className="settings-card" style={{ textAlign: "center" }}>
            <h3>Barcode</h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>للاستخدام على الاستيكر</p>
            <div style={{ display: "inline-block", padding: 16, background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <div style={{ fontFamily: "monospace", fontSize: 28, fontWeight: 700, letterSpacing: 4, padding: "8px 0" }}>
                ||||| {order.order_no} |||||
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={handlePrintBarcode} title="طباعة باركود">
                🏷️ طباعة باركود
              </button>
              <button className="btn" onClick={handlePrintReceipt} title="طباعة إيصال" style={{ marginRight: 8 }}>
                🖨️ طباعة إيصال
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== Modals ==================== */}

      {/* ---- Change Status Modal ---- */}
      {showStatusModal && (
        <Modal title="تغيير الحالة" onClose={() => setShowStatusModal(false)}>
          <Field label="الحالة الجديدة">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as MaintenanceStatus)}
            >
              {nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ملاحظات (اختياري)">
            <textarea
              rows={3}
              value={statusNotes}
              onChange={(e) => setStatusNotes(e.target.value)}
              placeholder="سبب تغيير الحالة..."
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={handleChangeStatus}>
              تأكيد
            </button>
            <button className="btn" onClick={() => setShowStatusModal(false)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Assign Technician Modal ---- */}
      {showTechModal && (
        <Modal title="إضافة فني" onClose={() => setShowTechModal(false)}>
          <Field label="الفني *">
            <select
              value={techEmployeeId}
              onChange={(e) => setTechEmployeeId(Number(e.target.value))}
            >
              <option value={0}>-- اختر فني --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="نوع العمل">
            <input
              value={techWorkType}
              onChange={(e) => setTechWorkType(e.target.value)}
              placeholder="إصلاح شاشة، تغيير بطارية..."
            />
          </Field>
          <Field label="ملاحظات">
            <textarea
              rows={2}
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={handleAssignTech}>
              تعيين
            </button>
            <button className="btn" onClick={() => setShowTechModal(false)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Add Part Modal ---- */}
      {showPartModal && (
        <Modal title="إضافة قطعة غيار" onClose={() => setShowPartModal(false)}>
          <Field label="اسم القطعة *">
            <input
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              placeholder="شاشة، بطارية..."
            />
          </Field>
          <Field label="الكمية">
            <input
              type="number"
              min={1}
              value={partQty}
              onChange={(e) => setPartQty(Number(e.target.value))}
            />
          </Field>
          <Field label="سعر التكلفة">
            <input
              type="number"
              min={0}
              step="0.01"
              value={partCost}
              onChange={(e) => setPartCost(Number(e.target.value))}
            />
          </Field>
          <Field label="سعر البيع">
            <input
              type="number"
              min={0}
              step="0.01"
              value={partSell}
              onChange={(e) => setPartSell(Number(e.target.value))}
            />
          </Field>
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 13 }}>
            الإجمالي: <strong>{money(partSell * partQty)}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={handleAddPart}>
              إضافة
            </button>
            <button className="btn" onClick={() => setShowPartModal(false)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}

      {/* ---- Add Payment Modal ---- */}
      {showPaymentModal && (
        <Modal title="تسجيل دفعة" onClose={() => setShowPaymentModal(false)}>
          <Field label="المبلغ *">
            <input
              type="number"
              min={0}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(Number(e.target.value))}
            />
          </Field>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: -8, marginBottom: 8 }}>
            المتبقي: <strong>{money(order.remaining)}</strong>
          </div>
          <Field label="طريقة الدفع">
            <select
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ملاحظات">
            <textarea
              rows={2}
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="btn primary" onClick={handleAddPayment}>
              تسجيل
            </button>
            <button className="btn" onClick={() => setShowPaymentModal(false)}>
              إلغاء
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
