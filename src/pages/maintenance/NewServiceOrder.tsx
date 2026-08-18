import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { Field, money, useToast } from "../../components/ui";
import type {
  CustomerSearchResult,
  Employee,
  NewServiceOrder as NewServiceOrderInput,
} from "../../types";

export function NewServiceOrder({ onDone }: { onDone: (orderId: number) => void }) {
  const notify = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: number; orderNo: string } | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);

  // Customer search
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form fields
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deviceType, setDeviceType] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceColor, setDeviceColor] = useState("");
  const [accessories, setAccessories] = useState("");
  const [complaint, setComplaint] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedEmployee, setAssignedEmployee] = useState(0);

  // Parts (optional)
  const [parts, setParts] = useState<{ name: string; qty: number; price: number }[]>([]);
  const [partName, setPartName] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [partPrice, setPartPrice] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const emps = await api.listEmployees();
        setEmployees(emps);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const onCustomerSearch = useCallback((q: string) => {
    setCustomerSearch(q);
    if (selectedCustomer && q !== selectedCustomer.name) {
      setSelectedCustomer(null);
      setIsNewCustomer(false);
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try { setSearchResults(await api.searchCustomersForMaintenance(q.trim())); }
      catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
  }, [selectedCustomer]);

  const selectCustomer = (c: CustomerSearchResult) => {
    setSelectedCustomer(c);
    setCustomerSearch(c.name);
    setSearchResults([]);
    setIsNewCustomer(false);
  };

  const addPart = () => {
    if (!partName.trim()) { notify("أدخل اسم القطعة", "error"); return; }
    setParts([...parts, { name: partName.trim(), qty: partQty, price: partPrice }]);
    setPartName(""); setPartQty(1); setPartPrice(0);
  };

  const removePart = (i: number) => setParts(parts.filter((_, idx) => idx !== i));

  const totalParts = parts.reduce((s, p) => s + p.price * p.qty, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceType.trim()) { notify("يجب إدخال نوع الجهاز", "error"); return; }
    if (!complaint.trim()) { notify("يجب إدخال وصف المشكلة", "error"); return; }
    if (!selectedCustomer && !customerName.trim()) { notify("يجب إدخال اسم العميل", "error"); return; }

    setSaving(true);
    try {
      const input: NewServiceOrderInput = {
        customer_id: selectedCustomer?.id ?? null,
        customer_name: selectedCustomer ? null : customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        device_type: deviceType.trim(),
        device_model: deviceModel.trim() || null,
        device_color: deviceColor.trim() || null,
        accessories: accessories.trim() || null,
        customer_complaint: complaint.trim() || null,
        technician_notes: notes.trim() || null,
        parts_cost: totalParts || null,
      };
      const result = await api.createServiceOrder(input);

      // Assign employee if selected
      if (assignedEmployee && result.id) {
        try {
          await api.assignTechnician(result.id, { technician_id: assignedEmployee, work_type: "استلام وصيانة" });
        } catch (e) {
          console.error("Failed to assign technician:", e);
          notify("تم إنشاء الأمر لكن فشل تعيين الموظف: " + String(e), "error");
        }
      }

      // Add parts if any
      for (const p of parts) {
        try {
          await api.addServicePart(result.id, {
            part_name: p.name,
            quantity: p.qty,
            cost_price: p.price,
            sell_price: p.price,
          });
        } catch {}
      }

      notify("تم إنشاء أمر الصيانة بنجاح");
      setCreated({ id: result.id, orderNo: result.order_no || `#${result.id}` });
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setSaving(false);
    }
  };

  // ---- Print Barcode ----
  const printBarcode = () => {
    if (!created) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:system-ui,sans-serif;padding:10px;margin:0;text-align:center;font-size:12px}
      .box{border:2px solid #000;padding:10px;margin:0 auto;max-width:300px}
      .num{font-size:14px;font-weight:700;letter-spacing:2px;margin:6px 0}
      .info{font-size:11px;margin:3px 0;color:#333}</style></head><body>
      <div class="box">
        <div style="font-weight:700;font-size:13px">تبارك — صيانة</div>
        <div class="num">${created.orderNo}</div>
        <div class="info">${customerSearch || customerName}</div>
        <div class="info">${deviceType} ${deviceModel}</div>
        <div class="info">${new Date().toLocaleDateString("ar-EG")}</div>
      </div></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  // ---- Print Receipt ----
  const printReceipt = () => {
    if (!created) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    const partsHtml = parts.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.qty}</td><td>${money(p.price)}</td><td>${money(p.price * p.qty)}</td></tr>`).join("");
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:system-ui,sans-serif;padding:15px;margin:0;font-size:12px;color:#1f2937}
      h2{text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px}
      .row{display:flex;justify-content:space-between;margin:3px 0}
      .lbl{color:#6b7280}table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:4px 8px;text-align:right;font-size:11px}
      th{background:#f3f4f6;font-weight:700}
      .total{font-weight:700;border-top:2px solid #333}
      .footer{margin-top:16px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center}
      .sig{margin-top:30px;display:flex;justify-content:space-between}
      .sig-line{border-top:1px solid #333;width:200px;text-align:center;padding-top:4px;font-size:11px}</style></head><body>
      <h2>إيصال استلام جهاز</h2>
      <div style="text-align:center;color:#6b7280;margin-bottom:10px">رقم: <strong style="color:#0f8a5f">${created.orderNo}</strong></div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:10px">
        <div class="row"><span class="lbl">العميل:</span><strong>${selectedCustomer?.name || customerName}</strong></div>
        <div class="row"><span class="lbl">الهاتف:</span><strong>${selectedCustomer?.phone || customerPhone}</strong></div>
        <div class="row"><span class="lbl">الجهاز:</span><strong>${deviceType} ${deviceModel}</strong></div>
        <div class="row"><span class="lbl">اللون:</span><strong>${deviceColor || "—"}</strong></div>
        <div class="row"><span class="lbl">المتعلقات:</span><strong>${accessories || "—"}</strong></div>
      </div>
      <div style="margin:8px 0"><strong>وصف المشكلة:</strong> ${complaint}</div>
      ${parts.length > 0 ? `<table><thead><tr><th>#</th><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${partsHtml}</tbody></table>` : ""}
      <div style="margin-top:8px"><strong>المبلغ الإجمالي:</strong> <strong style="color:#0f8a5f">${money(totalParts)}</strong></div>
      ${notes ? `<div style="margin-top:8px"><strong>ملاحظات:</strong> ${notes}</div>` : ""}
      <div class="sig"><div class="sig-line">توقيع المستلم</div><div class="sig-line">توقيع الموظف</div></div>
      <div class="footer">شكراً لثقتكم بنا — صيانة تبارك</div></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-head"><h1>أمر صيانة جديد</h1></div>
        <p style={{ textAlign: "center", padding: 40 }}>جارٍ التحميل...</p>
      </div>
    );
  }

  // ---- Success Screen ----
  if (created) {
    return (
      <div className="page">
        <div className="page-head"><h1>تم الإنشاء بنجاح</h1></div>
        <div className="settings-card" style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h2 style={{ marginBottom: 4 }}>تم إنشاء أمر الصيانة</h2>
          <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 15 }}>{created.orderNo}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn primary" onClick={printReceipt}>🖨️ طباعة الإيصال</button>
            <button className="btn" onClick={printBarcode}>🏷️ طباعة الباركود</button>
            <button className="btn" onClick={() => onDone(created.id)}>العودة لأوامر الصيانة</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head"><h1>أمر صيانة جديد</h1></div>

      <form onSubmit={submit} className="nso-layout">
        <div className="nso-form-col">

          {/* بيانات العميل */}
          <div className="settings-card">
            <h3>👤 بيانات العميل</h3>
            <Field label="بحث عن عميل">
              <div className="nso-search-wrap">
                <input
                  value={customerSearch}
                  onChange={(e) => onCustomerSearch(e.target.value)}
                  placeholder="اكتب اسم أو رقم هاتف..."
                />
                {searching && <span className="nso-search-spinner" />}
              </div>
              {searchResults.length > 0 && (
                <div className="nso-customer-results">
                  {searchResults.map((c) => (
                    <button key={c.id} type="button" className="nso-customer-item" onClick={() => selectCustomer(c)}>
                      <span className="nso-customer-avatar">{c.name.charAt(0)}</span>
                      <span className="nso-customer-info">
                        <strong>{c.name}</strong>
                        {c.phone && <small>{c.phone}</small>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Field>

            {selectedCustomer && (
              <div className="nso-selected-customer">
                <span className="nso-check-icon">✓</span>
                <div>
                  <strong>{selectedCustomer.name}</strong>
                  {selectedCustomer.phone && <small>{selectedCustomer.phone}</small>}
                </div>
              </div>
            )}

            {!selectedCustomer && (
              <button type="button" className="btn nso-toggle-btn" onClick={() => setIsNewCustomer(!isNewCustomer)}>
                {isNewCustomer ? "✕ إلغاء" : "＋ عميل جديد"}
              </button>
            )}

            {isNewCustomer && !selectedCustomer && (
              <div className="nso-new-customer-fields">
                <div className="nso-fields-row">
                  <Field label="اسم العميل *">
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="الاسم الكامل" />
                  </Field>
                  <Field label="رقم الهاتف">
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05xxxxxxxx" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* بيانات الجهاز */}
          <div className="settings-card">
            <h3>📱 بيانات الجهاز</h3>
            <div className="nso-fields-row">
              <Field label="نوع الجهاز *">
                <input value={deviceType} onChange={(e) => setDeviceType(e.target.value)} placeholder="موبايل، لابتوب، تابلت..." />
              </Field>
              <Field label="الموديل">
                <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="iPhone 15, Samsung S24..." />
              </Field>
            </div>
            <div className="nso-fields-row">
              <Field label="اللون">
                <input value={deviceColor} onChange={(e) => setDeviceColor(e.target.value)} />
              </Field>
              <Field label="المتعلقات المستلمة">
                <input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="شاحن، سماعة..." />
              </Field>
            </div>
          </div>

          {/* وصف المشكلة */}
          <div className="settings-card">
            <h3>🔧 وصف المشكلة</h3>
            <Field label="شكوى العميل *">
              <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="وصف المشكلة كما يذكرها العميل" />
            </Field>
            <Field label="الملاحظات">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="ملاحظات إضافية..." />
            </Field>
          </div>

          {/* قطع الغيار */}
          <div className="settings-card">
            <h3>🔩 قطع الغيار (اختياري)</h3>
            {parts.length > 0 && (
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table className="table">
                  <thead><tr><th>#</th><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th></th></tr></thead>
                  <tbody>
                    {parts.map((p, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td className="strong">{p.name}</td>
                        <td>{p.qty}</td>
                        <td>{money(p.price)}</td>
                        <td className="strong">{money(p.price * p.qty)}</td>
                        <td><button type="button" className="btn danger sm" onClick={() => removePart(i)}>حذف</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="nso-parts-adder">
              <input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="اسم القطعة" style={{ flex: 2 }} />
              <input type="number" min={1} value={partQty} onChange={(e) => setPartQty(Number(e.target.value))} style={{ flex: 1 }} />
              <input type="number" min={0} step="0.01" value={partPrice || ""} onChange={(e) => setPartPrice(Number(e.target.value))} placeholder="السعر" style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={addPart}>+ إضافة</button>
            </div>
            {totalParts > 0 && (
              <div style={{ marginTop: 8, textAlign: "left", color: "#6b7280" }}>
                إجمالي القطع: <strong style={{ color: "#0f8a5f" }}>{money(totalParts)}</strong>
              </div>
            )}
          </div>

          {/* الموظف المسؤول */}
          <div className="settings-card">
            <h3>👷 الموظف المسؤول</h3>
            <Field label="الموظف القائم بالاستلام والصيانة">
              <select value={assignedEmployee} onChange={(e) => setAssignedEmployee(Number(e.target.value))}>
                <option value={0}>-- اختر موظف --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        {/* ملخص */}
        <div className="nso-sidebar">
          <div className="nso-summary-card">
            <h4>ملخص الأمر</h4>
            <div className="nso-summary-rows">
              <div className="nso-summary-row">
                <span>قطع الغيار</span>
                <strong>{money(totalParts)}</strong>
              </div>
              <div className="nso-summary-divider" />
              <div className="nso-summary-row nso-total">
                <span>الإجمالي</span>
                <strong>{money(totalParts)}</strong>
              </div>
            </div>
            {selectedCustomer && (
              <div className="nso-summary-badge nso-badge-green">
                <span>✓</span> {selectedCustomer.name}
              </div>
            )}
            {deviceType && (
              <div className="nso-summary-badge nso-badge-blue">
                <span>📱</span> {deviceType}{deviceModel ? ` - ${deviceModel}` : ""}
              </div>
            )}
            {assignedEmployee > 0 && (
              <div className="nso-summary-badge nso-badge-purple">
                <span>👷</span> {employees.find(e => e.id === assignedEmployee)?.name}
              </div>
            )}
          </div>

          <div className="nso-actions">
            <button type="submit" className="btn primary nso-submit-btn" disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "إنشاء أمر الصيانة"}
            </button>
            <button type="button" className="btn nso-cancel-btn" onClick={() => onDone(0)} disabled={saving}>
              إلغاء
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
