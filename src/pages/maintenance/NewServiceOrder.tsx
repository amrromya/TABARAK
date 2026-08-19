import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { money, useToast } from "../../components/ui";
import type { Employee, Product } from "../../types";

interface PartLine {
  product_id: number | null;
  name: string;
  qty: number;
  sell_price: number;
}

export function NewServiceOrder({ onDone }: { onDone: (orderId: number) => void }) {
  const notify = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ id: number; orderNo: string } | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Customer
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Device
  const [deviceType, setDeviceType] = useState("");
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceColor, setDeviceColor] = useState("");
  const [accessories, setAccessories] = useState("");

  // Problem
  const [complaint, setComplaint] = useState("");

  // Parts
  const [parts, setParts] = useState<PartLine[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [partResults, setPartResults] = useState<Product[]>([]);
  const [searchingPart, setSearchingPart] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New product inline
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProdName, setNewProdName] = useState("");
  const [newProdPrice, setNewProdPrice] = useState(0);

  // Labor
  const [laborCost, setLaborCost] = useState(0);
  const [warrantyDays, setWarrantyDays] = useState(0);
  const [assignedEmployee, setAssignedEmployee] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [emps, prods] = await Promise.all([api.listEmployees(), api.listProducts()]);
        setEmployees(emps);
        setProducts(prods);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  // ---- Parts search ----
  const onPartSearch = useCallback((q: string) => {
    setPartSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 1) { setPartResults([]); return; }
    setSearchingPart(true);
    searchTimer.current = setTimeout(() => {
      const lower = q.trim().toLowerCase();
      setPartResults(products.filter((p) => p.name.toLowerCase().includes(lower) || (p.barcode && p.barcode.includes(q.trim()))).slice(0, 8));
      setSearchingPart(false);
    }, 200);
  }, [products]);

  const addExistingPart = (p: Product) => {
    setParts([...parts, { product_id: p.id, name: p.name, qty: 1, sell_price: p.sell_price }]);
    setPartSearch("");
    setPartResults([]);
  };

  const addNewProductPart = () => {
    if (!newProdName.trim()) { notify("أدخل اسم الصنف", "error"); return; }
    if (newProdPrice <= 0) { notify("أدخل سعر البيع", "error"); return; }
    setParts([...parts, { product_id: null, name: newProdName.trim(), qty: 1, sell_price: newProdPrice }]);
    setNewProdName("");
    setNewProdPrice(0);
    setShowNewProduct(false);
  };

  const updatePartQty = (i: number, qty: number) => {
    setParts(parts.map((p, idx) => idx === i ? { ...p, qty: Math.max(1, qty) } : p));
  };

  const updatePartPrice = (i: number, price: number) => {
    setParts(parts.map((p, idx) => idx === i ? { ...p, sell_price: price } : p));
  };

  const removePart = (i: number) => setParts(parts.filter((_, idx) => idx !== i));

  const totalParts = parts.reduce((s, p) => s + p.sell_price * p.qty, 0);
  const grandTotal = totalParts + laborCost;

  // ---- Submit ----
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { notify("يجب إدخال اسم العميل", "error"); return; }
    if (!deviceType.trim()) { notify("يجب إدخال نوع الجهاز", "error"); return; }
    if (!complaint.trim()) { notify("يجب إدخال وصف المشكلة", "error"); return; }

    setSaving(true);
    try {
      // Create service order
      const result = await api.createServiceOrder({
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        device_type: deviceType.trim(),
        device_model: deviceModel.trim() || null,
        device_color: deviceColor.trim() || null,
        accessories: accessories.trim() || null,
        customer_complaint: complaint.trim(),
        parts_cost: totalParts || null,
        labor_cost: laborCost || null,
        warranty_days: warrantyDays || null,
      });

      // Assign employee
      if (assignedEmployee && result.id) {
        try {
          await api.assignTechnician(result.id, { technician_id: assignedEmployee, work_type: "صيانة" });
        } catch {}
      }

      // Add parts
      for (const p of parts) {
        try {
          let pid = p.product_id;
          // If new product, create it first (negative stock until purchase)
          if (!pid) {
            const createdProd = await api.createProduct({
              name: p.name,
              cost_price: p.sell_price,
              sell_price: p.sell_price,
              quantity: -p.qty,
              min_quantity: 0,
            });
            pid = createdProd.id;
          }
          await api.addServicePart(result.id, {
            product_id: pid,
            part_name: p.name,
            quantity: p.qty,
            cost_price: p.sell_price,
            sell_price: p.sell_price,
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

  // ---- Print Order ----
  const printOrder = () => {
    if (!created) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    const partsHtml = parts.map((p, i) =>
      `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.qty}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.qty)}</td></tr>`
    ).join("");
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>
        body{font-family:'Segoe UI',system-ui,sans-serif;padding:20px;margin:0;color:#1f2937;font-size:13px}
        h2{text-align:center;color:#0f172a;border-bottom:3px solid #0f172a;padding-bottom:8px;margin-bottom:16px}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px}
        .info-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px}
        .info-box .lbl{color:#6b7280;font-size:11px;margin-bottom:2px}
        .info-box .val{font-weight:700;font-size:14px}
        table{width:100%;border-collapse:collapse;margin:12px 0}
        th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px}
        th{background:#f1f5f9;font-weight:700}
        .total-row{background:#f0fdf4;font-weight:700}
        .summary{margin-top:12px;text-align:left;font-size:14px}
        .summary .line{display:flex;justify-content:space-between;margin:4px 0}
        .summary .grand{border-top:2px solid #0f172a;padding-top:6px;font-size:16px;color:#0f8a5f}
        .footer{margin-top:24px;border-top:1px dashed #d1d5db;padding-top:10px;color:#6b7280;font-size:11px;text-align:center}
      </style></head><body>
      <h2>🔧 أمر صيانة — ${created.orderNo}</h2>
      <div class="info-grid">
        <div class="info-box"><div class="lbl">العميل</div><div class="val">${customerName}</div></div>
        <div class="info-box"><div class="lbl">الهاتف</div><div class="val">${customerPhone || "—"}</div></div>
        <div class="info-box"><div class="lbl">الجهاز</div><div class="val">${deviceType} ${deviceModel}</div></div>
        <div class="info-box"><div class="lbl">اللون</div><div class="val">${deviceColor || "—"}</div></div>
      </div>
      <div style="margin-bottom:12px"><strong>المتعلقات:</strong> ${accessories || "—"}</div>
      <div style="margin-bottom:12px"><strong>وصف المشكلة:</strong> ${complaint}</div>
      ${parts.length > 0 ? `
        <h3 style="margin:12px 0 6px">قطع الغيار</h3>
        <table>
          <thead><tr><th>#</th><th>القطعة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${partsHtml}
            <tr class="total-row"><td colSpan={4}>إجمالي القطع</td><td>${money(totalParts)}</td></tr>
          </tbody>
        </table>` : ""}
      <div class="summary">
        <div class="line"><span>قطع الغيار:</span><span>${money(totalParts)}</span></div>
        <div class="line"><span>أجرا الصيانة:</span><span>${money(laborCost)}</span></div>
        <div class="line grand"><span>الإجمالي:</span><span>${money(grandTotal)}</span></div>
      </div>
      ${assignedEmployee > 0 ? `<div style="margin-top:12px"><strong>الموظف:</strong> ${employees.find(e => e.id === assignedEmployee)?.name}</div>` : ""}
      ${warrantyDays > 0 ? `<div style="margin-top:6px"><strong>مدة الضمان:</strong> ${warrantyDays} يوم</div>` : ""}
      <div class="footer">شكراً لثقتكم بنا — صيانة تبارك</div>
    </body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
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
      <style>
        body{font-family:system-ui,sans-serif;padding:10px;margin:0;text-align:center;font-size:12px}
        .box{border:2px solid #000;padding:12px;margin:0 auto;max-width:300px}
        .title{font-weight:800;font-size:14px;margin-bottom:6px;color:#0f172a}
        .num{font-size:16px;font-weight:800;letter-spacing:3px;color:#0f8a5f;margin:6px 0}
        .info{font-size:11px;margin:3px 0;color:#333;line-height:1.5}
        .total{font-size:13px;font-weight:700;margin-top:8px;color:#b91c1c}
      </style></head><body>
      <div class="box">
        <div class="title">تبارك — صيانة</div>
        <div class="num">${created.orderNo}</div>
        <div class="info">العميل: ${customerName}</div>
        <div class="info">الجهاز: ${deviceType} ${deviceModel}</div>
        <div class="info">المشكلة: ${complaint}</div>
        <div class="total">الإجمالي: ${money(grandTotal)}</div>
        <div class="info" style="margin-top:6px;color:#6b7280">${new Date().toLocaleDateString("ar-EG")}</div>
      </div>
    </body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => document.body.removeChild(frame), 1000);
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div className="page nso2-page">
        <div className="page-head"><h1>أمر صيانة جديد</h1></div>
        <p style={{ textAlign: "center", padding: 40 }}>جارٍ التحميل...</p>
      </div>
    );
  }

  // ---- Success Screen ----
  if (created) {
    return (
      <div className="page nso2-page">
        <div className="page-head"><h1>تم الإنشاء بنجاح</h1></div>
        <div className="nso-success">
          <div className="nso-success-icon">✅</div>
          <h2>تم إنشاء أمر الصيانة</h2>
          <p className="nso-success-no">{created.orderNo}</p>
          <div className="nso-success-actions">
            <button className="btn primary" onClick={printOrder}>🖨️ طباعة الأمر</button>
            <button className="btn" onClick={printBarcode}>🏷️ طباعة باركود</button>
            <button className="btn" onClick={() => onDone(created.id)}>العودة لأوامر الصيانة</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page nso2-page">
      <div className="page-head">
        <h1>🔧 أمر صيانة جديد</h1>
      </div>

      <form onSubmit={submit} className="nso2-layout">
        {/* ===== Left Column (Form) ===== */}
        <div className="nso2-form">

          {/* بيانات العميل */}
          <div className="nso2-section">
            <div className="nso2-section-head">
              <span className="nso2-section-icon">👤</span>
              <span className="nso2-section-title">بيانات العميل</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field">
                  <label>اسم العميل / العمل *</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="الاسم الكامل" />
                </div>
                <div className="nso2-field">
                  <label>رقم الهاتف</label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05xxxxxxxx" />
                </div>
              </div>
            </div>
          </div>

          {/* بيانات الجهاز */}
          <div className="nso2-section">
            <div className="nso2-section-head">
              <span className="nso2-section-icon">📱</span>
              <span className="nso2-section-title">بيانات الجهاز</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field">
                  <label>نوع الجهاز *</label>
                  <input value={deviceType} onChange={(e) => setDeviceType(e.target.value)} placeholder="موبايل، لابتوب، تابلت..." />
                </div>
                <div className="nso2-field">
                  <label>الموديل</label>
                  <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="iPhone 15, Samsung S24..." />
                </div>
              </div>
              <div className="nso2-row">
                <div className="nso2-field">
                  <label>اللون</label>
                  <input value={deviceColor} onChange={(e) => setDeviceColor(e.target.value)} placeholder="أسود، أزرق..." />
                </div>
                <div className="nso2-field">
                  <label>المتعلقات المستلمة</label>
                  <input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="شاحن، سماعة، غلاف..." />
                </div>
              </div>
            </div>
          </div>

          {/* وصف المشكلة */}
          <div className="nso2-section">
            <div className="nso2-section-head">
              <span className="nso2-section-icon">🔧</span>
              <span className="nso2-section-title">وصف المشكلة</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-field">
                <label>شكوى العميل *</label>
                <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="وصف المشكلة كما يذكرها العميل" />
              </div>
            </div>
          </div>

          {/* قطع الغيار */}
          <div className="nso2-section">
            <div className="nso2-section-head">
              <span className="nso2-section-icon">🔩</span>
              <span className="nso2-section-title">قطع الغيار</span>
            </div>
            <div className="nso2-section-body">
              {/* Search bar */}
              <div className="nso2-part-search">
                <input
                  value={partSearch}
                  onChange={(e) => onPartSearch(e.target.value)}
                  placeholder="🔍 ابحث عن صنف..."
                />
                {searchingPart && <span className="nso2-search-spinner" />}
                {partResults.length > 0 && (
                  <div className="nso2-part-results">
                    {partResults.map((p) => (
                      <button key={p.id} type="button" className="nso2-part-result-item" onClick={() => addExistingPart(p)}>
                        <span className="nso2-part-result-name">{p.name}</span>
                        <span className="nso2-part-result-price">{money(p.sell_price)}</span>
                        <span className="nso2-part-result-stock">{p.quantity} في المخزون</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Add new product */}
              <div className="nso2-new-prod-toggle">
                <button type="button" className="btn sm" onClick={() => setShowNewProduct(!showNewProduct)}>
                  {showNewProduct ? "✕ إلغاء" : "＋ صنف جديد"}
                </button>
              </div>
              {showNewProduct && (
                <div className="nso2-new-prod-form">
                  <div className="nso2-row">
                    <div className="nso2-field">
                      <label>اسم الصنف *</label>
                      <input value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder="اسم الصنف الجديد" />
                    </div>
                    <div className="nso2-field" style={{ maxWidth: 160 }}>
                      <label>سعر البيع *</label>
                      <input type="number" min={0} step="0.01" value={newProdPrice || ""} onChange={(e) => setNewProdPrice(Number(e.target.value))} placeholder="0" />
                    </div>
                    <button type="button" className="btn primary sm" onClick={addNewProductPart} style={{ alignSelf: "flex-end", height: 38 }}>إضافة</button>
                  </div>
                  <p className="nso2-hint">سيتم تسجيل الصنف بالمخزون برصيد سالب حتى يتم إنشاء فاتورة شراء له</p>
                </div>
              )}

              {/* Parts table */}
              {parts.length > 0 && (
                <div className="nso2-parts-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>الصنف</th>
                        <th>الكمية</th>
                        <th>سعر البيع</th>
                        <th>الإجمالي</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parts.map((p, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="strong">{p.name}</td>
                          <td>
                            <input type="number" min={1} value={p.qty} onChange={(e) => updatePartQty(i, Number(e.target.value))} className="nso2-inline-input" />
                          </td>
                          <td>
                            <input type="number" min={0} step="0.01" value={p.sell_price} onChange={(e) => updatePartPrice(i, Number(e.target.value))} className="nso2-inline-input" />
                          </td>
                          <td className="strong">{money(p.sell_price * p.qty)}</td>
                          <td>
                            <button type="button" className="btn danger sm" onClick={() => removePart(i)}>حذف</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* الموظف */}
          <div className="nso2-section">
            <div className="nso2-section-head">
              <span className="nso2-section-icon">👷</span>
              <span className="nso2-section-title">الموظف المسؤول</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field">
                  <label>الموظف القائم بالصيانة</label>
                  <select value={assignedEmployee} onChange={(e) => setAssignedEmployee(Number(e.target.value))}>
                    <option value={0}>-- اختر موظف --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="nso2-field" style={{ maxWidth: 140 }}>
                  <label>أجرة الصيانة</label>
                  <input type="number" min={0} step="0.01" value={laborCost || ""} onChange={(e) => setLaborCost(Number(e.target.value))} placeholder="0" />
                </div>
                <div className="nso2-field" style={{ maxWidth: 120 }}>
                  <label>مدة الضمان (يوم)</label>
                  <input type="number" min={0} value={warrantyDays || ""} onChange={(e) => setWarrantyDays(Number(e.target.value))} placeholder="اختياري" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== Right Sidebar (Summary) ===== */}
        <div className="nso2-sidebar">
          <div className="nso2-summary">
            <h4>ملخص الأمر</h4>
            <div className="nso2-summary-rows">
              <div className="nso2-summary-row">
                <span>قطع الغيار</span>
                <strong>{money(totalParts)}</strong>
              </div>
              <div className="nso2-summary-row">
                <span>أجرة الصيانة</span>
                <strong>{money(laborCost)}</strong>
              </div>
              <div className="nso2-summary-divider" />
              <div className="nso2-summary-row nso2-total">
                <span>الإجمالي</span>
                <strong>{money(grandTotal)}</strong>
              </div>
            </div>

            {customerName && (
              <div className="nso2-badge nso2-badge-green">
                <span>👤</span> {customerName}
              </div>
            )}
            {deviceType && (
              <div className="nso2-badge nso2-badge-blue">
                <span>📱</span> {deviceType}{deviceModel ? ` - ${deviceModel}` : ""}
              </div>
            )}
            {assignedEmployee > 0 && (
              <div className="nso2-badge nso2-badge-purple">
                <span>👷</span> {employees.find(e => e.id === assignedEmployee)?.name}
              </div>
            )}
          </div>

          <div className="nso2-actions">
            <button type="submit" className="btn primary nso2-submit" disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "💾 حفظ أمر الصيانة"}
            </button>
            <button type="button" className="btn" onClick={() => onDone(0)} disabled={saving}>
              إلغاء
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
