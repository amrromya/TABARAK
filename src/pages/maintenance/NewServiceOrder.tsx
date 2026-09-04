import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../api";
import { money, useToast } from "../../components/ui";
import { printMaintenanceBarcode } from "../../utils/printBarcode";
import type { Customer, Employee, Product } from "../../types";

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<{ id: number; name: string }[]>([]);

  // Customer
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustType, setNewCustType] = useState("regular");

  // Device
  const [deviceType, setDeviceType] = useState("");
  const [showNewDeviceType, setShowNewDeviceType] = useState(false);
  const [newDeviceTypeName, setNewDeviceTypeName] = useState("");
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

  // Deposit
  const [deposit, setDeposit] = useState(0);
  const [depositMethod, setDepositMethod] = useState("cash");

  useEffect(() => {
    (async () => {
      try {
        const [emps, prods, custs, dtypes] = await Promise.all([
          api.listEmployees(),
          api.listProducts(),
          api.listCustomers(),
          api.getDeviceTypes(),
        ]);
        setEmployees(emps);
        setProducts(prods);
        setCustomers(custs);
        setDeviceTypes(dtypes);
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  // ---- Customer handling ----
  const onSelectCustomer = (v: string) => {
    if (v === "__new__") {
      setShowNewCustomer(true);
      setCustomerId("");
      setCustomerName("");
      setCustomerPhone("");
      return;
    }
    setShowNewCustomer(false);
    const c = customers.find((x) => x.id === Number(v));
    setCustomerId(v);
    setCustomerName(c?.name ?? "");
    setCustomerPhone(c?.phone ?? "");
  };

  const addNewCustomer = async () => {
    if (!newCustName.trim()) { notify("أدخل اسم العميل", "error"); return; }
    try {
      const c = await api.createCustomer({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || null,
        customer_type: newCustType,
      });
      setCustomers((prev) => [...prev, c]);
      setCustomerId(String(c.id));
      setCustomerName(c.name);
      setCustomerPhone(c.phone ?? "");
      setShowNewCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustType("regular");
      notify(`تم إضافة العميل "${c.name}"`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  // ---- Device type handling ----
  const addNewDeviceType = async () => {
    if (!newDeviceTypeName.trim()) { notify("أدخل نوع الجهاز", "error"); return; }
    try {
      const created = await api.createDeviceType(newDeviceTypeName.trim());
      setDeviceTypes((prev) => [...prev, created]);
      setDeviceType(created.name);
      setShowNewDeviceType(false);
      setNewDeviceTypeName("");
      notify(`تم إضافة "${created.name}"`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

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
  const remaining = grandTotal - deposit;

  // ---- Submit ----
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { notify("يجب اختيار أو إضافة عميل", "error"); return; }
    if (!deviceType.trim()) { notify("يجب اختيار نوع الجهاز", "error"); return; }
    if (!complaint.trim()) { notify("يجب إدخال وصف المشكلة", "error"); return; }

    setSaving(true);
    try {
      const result = await api.createServiceOrder({
        customer_id: customerId ? Number(customerId) : null,
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
        deposit: deposit || null,
        deposit_method: depositMethod,
      });

      if (assignedEmployee && result.id) {
        try {
          await api.assignTechnician(result.id, { technician_id: assignedEmployee, work_type: "صيانة" });
        } catch {}
      }

      for (const p of parts) {
        try {
          let pid = p.product_id;
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

  const printOrder = () => {
    if (!created) return;
    const partsHtml = parts.map((p, i) =>
      `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.qty}</td><td>${money(p.sell_price)}</td><td>${money(p.sell_price * p.qty)}</td></tr>`
    ).join("");
    printHtml(`<div dir="rtl" lang="ar" style="font-family:'Segoe UI',system-ui,sans-serif;padding:20px;color:#1f2937;font-size:13px">
      <h2 style="text-align:center;color:#0f172a;border-bottom:3px solid #0f172a;padding-bottom:8px;margin-bottom:16px">أمر صيانة — ${created.orderNo}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px"><div style="color:#6b7280;font-size:11px;margin-bottom:2px">العميل</div><div style="font-weight:700;font-size:14px">${customerName}</div></div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px"><div style="color:#6b7280;font-size:11px;margin-bottom:2px">الهاتف</div><div style="font-weight:700;font-size:14px">${customerPhone || "—"}</div></div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px"><div style="color:#6b7280;font-size:11px;margin-bottom:2px">الجهاز</div><div style="font-weight:700;font-size:14px">${deviceType} ${deviceModel}</div></div>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px"><div style="color:#6b7280;font-size:11px;margin-bottom:2px">اللون</div><div style="font-weight:700;font-size:14px">${deviceColor || "—"}</div></div>
      </div>
      <div style="margin-bottom:12px"><strong>المتعلقات:</strong> ${accessories || "—"}</div>
      <div style="margin-bottom:12px"><strong>وصف المشكلة:</strong> ${complaint}</div>
      ${parts.length > 0 ? `
        <h3 style="margin:12px 0 6px">قطع الغيار</h3>
        <table style="width:100%;border-collapse:collapse;margin:12px 0">
          <thead><tr style="background:#f1f5f9"><th style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px;font-weight:700">#</th><th style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px;font-weight:700">القطعة</th><th style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px;font-weight:700">الكمية</th><th style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px;font-weight:700">السعر</th><th style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px;font-weight:700">الإجمالي</th></tr></thead>
          <tbody>${partsHtml}
            <tr style="background:#f0fdf4;font-weight:700"><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px" colSpan={4}>إجمالي القطع</td><td style="border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:12px">${money(totalParts)}</td></tr>
          </tbody>
        </table>` : ""}
      <div style="margin-top:12px;text-align:left;font-size:14px">
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span>قطع الغيار:</span><span>${money(totalParts)}</span></div>
        <div style="display:flex;justify-content:space-between;margin:4px 0"><span>أجرا الصيانة:</span><span>${money(laborCost)}</span></div>
        ${deposit > 0 ? `<div style="display:flex;justify-content:space-between;margin:4px 0;color:#0f8a5f"><span>عربون:</span><span>-${money(deposit)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;margin:4px 0;border-top:2px solid #0f172a;padding-top:6px;font-size:16px;color:#0f8a5f"><span>المتبقي:</span><span>${money(remaining)}</span></div>
        ${deposit > 0 ? `<div style="display:flex;justify-content:space-between;margin:4px 0;color:#6b7280;font-size:11px"><span>الإجمالي الكلي:</span><span>${money(grandTotal)}</span></div>` : ""}
      </div>
      ${assignedEmployee > 0 ? `<div style="margin-top:12px"><strong>الموظف:</strong> ${employees.find(e => e.id === assignedEmployee)?.name}</div>` : ""}
      ${warrantyDays > 0 ? `<div style="margin-top:6px"><strong>مدة الضمان:</strong> ${warrantyDays} يوم</div>` : ""}
      <div style="margin-top:24px;border-top:1px dashed #d1d5db;padding-top:10px;color:#6b7280;font-size:11px;text-align:center">شكراً لثقتكم بنا — صيانة تبارك</div>
    </div>`);
  };

  // ---- Print Barcode ----
  const [storeName, setStoreName] = useState("");
  useEffect(() => { api.getSettings().then((s) => setStoreName(s.store_name || "")).catch(() => {}); }, []);

  const printBarcode = () => {
    if (!created) return;
    printMaintenanceBarcode({
      barcodeValue: created.orderNo,
      orderNo: created.orderNo,
      customerName,
      customerPhone,
      deviceType,
      deviceModel,
      complaint,
      total: remaining,
      date: new Date().toLocaleDateString("ar-EG"),
      storeName,
    });
  };

  if (loading) {
    return (
      <div className="page nso2-page">
        <div className="page-head"><h1>أمر صيانة جديد</h1></div>
        <p style={{ textAlign: "center", padding: 40 }}>جارٍ التحميل...</p>
      </div>
    );
  }

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
        <div className="nso2-form">

          {/* بيانات العميل */}
          <div className="nso2-section">
            <div className="nso2-section-head nso2-head-customer">
              <span className="nso2-section-icon">👤</span>
              <span className="nso2-section-title">بيانات العميل</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field" style={{ flex: 2 }}>
                  <label>العميل *</label>
                  <div className="nso2-customer-select">
                    <select value={customerId} onChange={(e) => onSelectCustomer(e.target.value)}>
                      <option value="">— اختر عميل —</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.customer_type === "wholesale" ? "(جملة)" : c.customer_type === "merchant" ? "(تاجر)" : ""}
                        </option>
                      ))}
                      <option value="__new__">+ عميل جديد</option>
                    </select>
                  </div>
                </div>
                <div className="nso2-field" style={{ flex: 1 }}>
                  <label>الهاتف</label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="05xxxxxxxx" />
                </div>
              </div>
              {showNewCustomer && (
                <div className="nso2-inline-form">
                  <div className="nso2-row">
                    <div className="nso2-field" style={{ flex: 2 }}>
                      <label>اسم العميل *</label>
                      <input autoFocus value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="الاسم الكامل" />
                    </div>
                    <div className="nso2-field" style={{ flex: 1 }}>
                      <label>الجوال</label>
                      <input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="05xxxxxxxx" />
                    </div>
                    <div className="nso2-field" style={{ flex: 1 }}>
                      <label>النوع</label>
                      <select value={newCustType} onChange={(e) => setNewCustType(e.target.value)}>
                        <option value="regular">جاري</option>
                        <option value="wholesale">جملة</option>
                        <option value="merchant">تاجر</option>
                      </select>
                    </div>
                    <button type="button" className="btn primary sm" onClick={addNewCustomer} style={{ alignSelf: "flex-end", height: 38 }}>حفظ</button>
                    <button type="button" className="btn sm" onClick={() => setShowNewCustomer(false)} style={{ alignSelf: "flex-end", height: 38 }}>إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* بيانات الجهاز */}
          <div className="nso2-section">
            <div className="nso2-section-head nso2-head-device">
              <span className="nso2-section-icon">📱</span>
              <span className="nso2-section-title">بيانات الجهاز</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field" style={{ flex: 1 }}>
                  <label>نوع الجهاز *</label>
                  <div className="nso2-customer-select">
                    <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                      <option value="">— اختر النوع —</option>
                      {deviceTypes.map((dt) => (
                        <option key={dt.id} value={dt.name}>{dt.name}</option>
                      ))}
                    </select>
                    <button type="button" className="btn sm nso2-add-btn" onClick={() => setShowNewDeviceType(!showNewDeviceType)} title="إضافة نوع جديد">+</button>
                  </div>
                </div>
                <div className="nso2-field" style={{ flex: 1 }}>
                  <label>الموديل</label>
                  <input value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} placeholder="iPhone 15, Galaxy S24..." />
                </div>
              </div>
              {showNewDeviceType && (
                <div className="nso2-inline-form">
                  <div className="nso2-row">
                    <div className="nso2-field" style={{ flex: 2 }}>
                      <label>اسم النوع الجديد *</label>
                      <input autoFocus value={newDeviceTypeName} onChange={(e) => setNewDeviceTypeName(e.target.value)} placeholder="مثال: كونسول ألعاب" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addNewDeviceType())} />
                    </div>
                    <button type="button" className="btn primary sm" onClick={addNewDeviceType} style={{ alignSelf: "flex-end", height: 38 }}>إضافة</button>
                    <button type="button" className="btn sm" onClick={() => { setShowNewDeviceType(false); setNewDeviceTypeName(""); }} style={{ alignSelf: "flex-end", height: 38 }}>إلغاء</button>
                  </div>
                </div>
              )}
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
            <div className="nso2-section-head nso2-head-problem">
              <span className="nso2-section-icon">⚠️</span>
              <span className="nso2-section-title">وصف المشكلة</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-field">
                <textarea value={complaint} onChange={(e) => setComplaint(e.target.value)} rows={3} placeholder="وصف المشكلة كما يذكرها العميل..." />
              </div>
            </div>
          </div>

          {/* قطع الغيار */}
          <div className="nso2-section">
            <div className="nso2-section-head nso2-head-parts">
              <span className="nso2-section-icon">🔩</span>
              <span className="nso2-section-title">قطع الغيار</span>
              {parts.length > 0 && <span className="nso2-parts-count">{parts.length}</span>}
            </div>
            <div className="nso2-section-body">
              <div className="nso2-part-search">
                <input value={partSearch} onChange={(e) => onPartSearch(e.target.value)} placeholder="🔍 ابحث عن صنف في المخزون..." />
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
              <div className="nso2-new-prod-toggle">
                <button type="button" className="btn sm" onClick={() => setShowNewProduct(!showNewProduct)}>
                  {showNewProduct ? "✕ إلغاء" : "+ صنف جديد"}
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
              {parts.length > 0 && (
                <div className="nso2-parts-table">
                  <table className="table">
                    <thead>
                      <tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر البيع</th><th>الإجمالي</th><th></th></tr>
                    </thead>
                    <tbody>
                      {parts.map((p, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td className="strong">{p.name}</td>
                          <td><input type="number" min={1} value={p.qty} onChange={(e) => updatePartQty(i, Number(e.target.value))} className="nso2-inline-input" /></td>
                          <td><input type="number" min={0} step="0.01" value={p.sell_price} onChange={(e) => updatePartPrice(i, Number(e.target.value))} className="nso2-inline-input" /></td>
                          <td className="strong">{money(p.sell_price * p.qty)}</td>
                          <td><button type="button" className="btn danger sm" onClick={() => removePart(i)}>حذف</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* الموظف + الأجر + الضمان */}
          <div className="nso2-section">
            <div className="nso2-section-head nso2-head-tech">
              <span className="nso2-section-icon">👷</span>
              <span className="nso2-section-title">الفني والأجر</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field">
                  <label>الموظف القائم بالصيانة</label>
                  <select value={assignedEmployee} onChange={(e) => setAssignedEmployee(Number(e.target.value))}>
                    <option value={0}>— اختر موظف —</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="nso2-field" style={{ maxWidth: 150 }}>
                  <label>أجرة الصيانة</label>
                  <input type="number" min={0} step="0.01" value={laborCost || ""} onChange={(e) => setLaborCost(Number(e.target.value))} placeholder="0" />
                </div>
                <div className="nso2-field" style={{ maxWidth: 130 }}>
                  <label>الضمان (يوم)</label>
                  <input type="number" min={0} value={warrantyDays || ""} onChange={(e) => setWarrantyDays(Number(e.target.value))} placeholder="اختياري" />
                </div>
              </div>
            </div>
          </div>

          {/* العربون */}
          <div className="nso2-section">
            <div className="nso2-section-head" style={{ background: "linear-gradient(135deg, #fff7ed, #ffedd5)", borderBottomColor: "#fed7aa" }}>
              <span className="nso2-section-icon">💰</span>
              <span className="nso2-section-title">العربون</span>
            </div>
            <div className="nso2-section-body">
              <div className="nso2-row">
                <div className="nso2-field" style={{ maxWidth: 180 }}>
                  <label>مبلغ العربون</label>
                  <input type="number" min={0} step="0.01" value={deposit || ""} onChange={(e) => setDeposit(Number(e.target.value))} placeholder="0" />
                </div>
                <div className="nso2-field" style={{ maxWidth: 160 }}>
                  <label>طريقة الدفع</label>
                  <select value={depositMethod} onChange={(e) => setDepositMethod(e.target.value)}>
                    <option value="cash">نقدي</option>
                    <option value="card">بطاقة</option>
                    <option value="transfer">تحويل</option>
                    <option value="electronic">إلكتروني</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: 10, color: "#92400e", margin: 0 }}>سيتم تسجيل العربون كدفعة مقدمة في الصندوق</p>
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
              {deposit > 0 && (
                <div className="nso2-summary-row" style={{ color: "#0f8a5f" }}>
                  <span>عربون</span>
                  <strong>-{money(deposit)}</strong>
                </div>
              )}
              <div className="nso2-summary-divider" />
              <div className="nso2-summary-row nso2-total">
                <span>المتبقي</span>
                <strong>{money(remaining)}</strong>
              </div>
              {deposit > 0 && (
                <div className="nso2-summary-row">
                  <span>الإجمالي الكلي</span>
                  <strong style={{ color: "#64748b", fontSize: 12 }}>{money(grandTotal)}</strong>
                </div>
              )}
            </div>
            {customerName && <div className="nso2-badge nso2-badge-green"><span>👤</span> {customerName}</div>}
            {deviceType && <div className="nso2-badge nso2-badge-blue"><span>📱</span> {deviceType}{deviceModel ? ` - ${deviceModel}` : ""}</div>}
            {assignedEmployee > 0 && <div className="nso2-badge nso2-badge-purple"><span>👷</span> {employees.find(e => e.id === assignedEmployee)?.name}</div>}
            {deposit > 0 && <div className="nso2-badge" style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}><span>💰</span> عربون: {money(deposit)}</div>}
          </div>
          <div className="nso2-actions">
            <button type="submit" className="btn primary nso2-submit" disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "💾 حفظ أمر الصيانة"}
            </button>
            <button type="button" className="btn" onClick={() => onDone(0)} disabled={saving}>إلغاء</button>
          </div>
        </div>
      </form>
    </div>
  );
}
