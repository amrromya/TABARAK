import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PrintPurchaseReturn } from "../components/PrintPurchaseReturn";
import { ProductMovements } from "../components/ProductMovements";
import { ProductPicker } from "../components/ProductPicker";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  money,
  qty,
  today,
  useToast,
} from "../components/ui";
import type {
  Employee,
  Product,
  ProductMovement,
  Purchase,
  PurchaseReturn,
  Settings,
  Supplier,
} from "../types";

interface Line {
  product_id: number;
  quantity: number;
  cost_price: number;
}

export function Purchases({
  onNewPurchase,
}: {
  onNewPurchase?: () => void;
}) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSuppliers, setShowSuppliers] = useState(false);

  const [date, setDate] = useState(today());
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [additional, setAdditional] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [settings, setSettings] = useState<Settings | null>(null);

  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [selCost, setSelCost] = useState(0);

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(
    null,
  );
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(
    null,
  );
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returningPurchase, setReturningPurchase] = useState<Purchase | null>(
    null,
  );
  const [isIndependentReturn, setIsIndependentReturn] = useState(false);
  const [printPurchase, setPrintPurchase] = useState<Purchase | null>(null);
  const [printReturn, setPrintReturn] = useState<PurchaseReturn | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [purchasesData, emps] = await Promise.all([
        api.listPurchases(search || undefined),
        api.listEmployees(),
      ]);
      setPurchases(purchasesData);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = async () => {
    try {
      const [p, s, emps] = await Promise.all([
        api.listProducts(),
        api.listSuppliers(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setSuppliers(s);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setSupplierId("");
    setNotes("");
    setDiscount(0);
    setAdditional(0);
    setLines([]);
    setSelProduct("");
    setSelQty(1);
    setSelCost(0);
    setEmployeeId("1");
    setEditingPurchase(null);
    setShowForm(true);
  };

  const openEdit = async (p: Purchase) => {
    try {
      const [prods, supps, emps] = await Promise.all([
        api.listProducts(),
        api.listSuppliers(),
        api.listEmployees(),
      ]);
      setProducts(prods);
      setSuppliers(supps);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    const full = await api.getPurchase(p.id);
    setDate(full.date);
    setSupplierId(full.supplier_id ? String(full.supplier_id) : "");
    setNotes(full.notes ?? "");
    setDiscount(full.discount);
    setAdditional(full.additional);
    setLines(
      full.items.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        cost_price: it.cost_price,
      })),
    );
    setEmployeeId(full.employee_id != null ? String(full.employee_id) : "");
    setEditingPurchase(full);
    setShowForm(true);
  };

  const openReturn = async (p: Purchase) => {
    try {
      const [prods, supps, emps] = await Promise.all([
        api.listProducts(),
        api.listSuppliers(),
        api.listEmployees(),
      ]);
      setProducts(prods);
      setSuppliers(supps);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    const full = await api.getPurchase(p.id);
    setDate(today());
    setSupplierId(full.supplier_id ? String(full.supplier_id) : "");
    setNotes("");
    setDiscount(0);
    setAdditional(0);
    setLines(
      full.items.map((it) => ({
        product_id: it.product_id,
        quantity: 0,
        cost_price: it.cost_price,
      })),
    );
    setEmployeeId(full.employee_id != null ? String(full.employee_id) : "");
    setSelProduct("");
    setSelQty(1);
    setSelCost(0);
    setReturningPurchase(full);
    setIsIndependentReturn(false);
    setShowReturnForm(true);
  };

  const openNewReturn = async () => {
    try {
      const [prods, supps, emps] = await Promise.all([
        api.listProducts(),
        api.listSuppliers(),
        api.listEmployees(),
      ]);
      setProducts(prods);
      setSuppliers(supps);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setSupplierId("");
    setNotes("");
    setDiscount(0);
    setAdditional(0);
    setLines([]);
    setEmployeeId("1");
    setSelProduct("");
    setSelQty(1);
    setSelCost(0);
    setReturningPurchase(null);
    setIsIndependentReturn(true);
    setShowReturnForm(true);
  };

  const onSelectProduct = (p: Product) => {
    setSelProduct(String(p.id));
    setSelCost(p.cost_price);
    setSelQty(1);
  };

  const handleViewMovement = async (movement: ProductMovement) => {
    try {
      if (movement.type === "purchase") {
        const purchase = await api.getPurchase(movement.related_id);
        setPrintPurchase(purchase);
      } else if (movement.type === "purchase_return") {
        const ret = await api.getPurchaseReturn(movement.related_id);
        setPrintReturn(ret);
      } else {
        notify("عرض الفاتورة غير متاح من هنا", "error");
      }
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const addLine = () => {
    if (!selProduct) {
      notify("اختر المنتج أولاً", "error");
      return;
    }
    const pid = Number(selProduct);
    if (selQty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر", "error");
      return;
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === pid);
      if (existing) {
        return ls.map((l) =>
          l.product_id === pid
            ? { ...l, quantity: l.quantity + selQty, cost_price: selCost }
            : l,
        );
      }
      return [...ls, { product_id: pid, quantity: selQty, cost_price: selCost }];
    });
    setSelProduct("");
    setSelQty(1);
    setSelCost(0);
  };

  const removeLine = (pid: number) =>
    setLines((ls) => ls.filter((l) => l.product_id !== pid));

  const total =
    lines.reduce((s, l) => s + l.quantity * l.cost_price, 0) -
    discount +
    additional;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPurchase) {
        await api.updatePurchase(editingPurchase.id, {
          date,
          supplier_id: supplierId ? Number(supplierId) : null,
          notes: notes || null,
          discount: discount || null,
          additional: additional || null,
          employee_id: employeeId ? Number(employeeId) : null,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            cost_price: l.cost_price,
          })),
        });
        notify(`تم تعديل المشتريات رقم ${editingPurchase.id}`);
      } else {
        const p = await api.createPurchase({
          date,
          supplier_id: supplierId ? Number(supplierId) : null,
          notes: notes || null,
          discount: discount || null,
          additional: additional || null,
          employee_id: employeeId ? Number(employeeId) : null,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            cost_price: l.cost_price,
          })),
        });
        notify(`تم تسجيل المشتريات رقم ${p.id}`);
      }
      setShowForm(false);
      setEditingPurchase(null);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeLines = lines.filter((l) => l.quantity > 0);
    if (activeLines.length === 0) {
      notify("أضف كمية واحدة على الأقل لمردود المشتريات", "error");
      return;
    }
    try {
      const ret = await api.createPurchaseReturn({
        purchase_id: returningPurchase!.id,
        date,
        discount: discount || null,
        additional: additional || null,
        warehouse_id: returningPurchase!.warehouse_id,
        notes: notes || null,
        employee_id: employeeId ? Number(employeeId) : null,
        items: activeLines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          cost_price: l.cost_price,
        })),
      });
      notify(`تم تسجيل مردود المشتريات ${ret.invoice_no}`);
      setShowReturnForm(false);
      setReturningPurchase(null);
      setIsIndependentReturn(false);
      load();
      setSettings(await api.getSettings());
      setPrintReturn(ret);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (p: Purchase) => {
    if (!confirmDialog(`هل تريد حذف المشتريات رقم ${p.id}؟ ستنقص الكميات من المخزون.`))
      return;
    try {
      await api.deletePurchase(p.id);
      notify("تم حذف المشتريات");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierName.trim()) return;
    try {
      const s = await api.createSupplier({
        name: newSupplierName.trim(),
        phone: newSupplierPhone || null,
        notes: null,
      });
      setSupplierId(String(s.id));
      setNewSupplierName("");
      setNewSupplierPhone("");
      setSuppliers(await api.listSuppliers());
      notify("تمت إضافة المورد");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const removeSupplier = async (s: Supplier) => {
    if (!confirmDialog(`هل تريد حذف المورد «${s.name}»؟`)) return;
    try {
      await api.deleteSupplier(s.id);
      setSuppliers(await api.listSuppliers());
      notify("تم حذف المورد");
    } catch (err) {
      notify(String(err), "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>المشتريات والموردون</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث باسم المورد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn" onClick={() => setShowSuppliers(true)}>
            الموردون
          </button>
          <button className="btn" onClick={openNewReturn}>
            + مردود مشتريات
          </button>
          <button className="btn primary" onClick={() => onNewPurchase ? onNewPurchase() : openNew()}>
            + مشتريات جديدة
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>رقم</th>
              <th>التاريخ</th>
              <th>المورد</th>
              <th>الموظف</th>
              <th>الإجمالي</th>
              <th>ملاحظات</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="empty">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && purchases.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  لا توجد مشتريات بعد.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id}>
                <td className="strong">P-{p.id}</td>
                <td>{fmtDate(p.date)}</td>
                <td>{p.supplier_name ?? "—"}</td>
                <td>{p.employee_name ?? "—"}</td>
                <td className="strong">{money(p.total)}</td>
                <td>{p.notes ?? "—"}</td>
                <td className="actions">
                  <button
                    className="btn sm"
                    onClick={() => setViewingPurchase(p)}
                    title="عرض الفاتورة"
                  >
                    عرض
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => openEdit(p)}
                    title="تعديل الفاتورة"
                  >
                    تعديل
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => openReturn(p)}
                    title="مردود مشتريات"
                  >
                    مردود
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={() => remove(p)}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editingPurchase ? "تعديل مشتريات" : "تسجيل مشتريات جديدة"}
          onClose={() => {
            setShowForm(false);
            setEditingPurchase(null);
          }}
          width="720px"
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="التاريخ">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="المورد">
                <div className="select-row">
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                  >
                    <option value="">بدون مورد</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setNewSupplierName("");
                      setNewSupplierPhone("");
                      setShowSuppliers(true);
                    }}
                  >
                    + مورد
                  </button>
                </div>
              </Field>
              <Field label="ملاحظات">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
              <Field label="خصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <Field label="إضافي">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={additional}
                  onChange={(e) => setAdditional(Number(e.target.value))}
                />
              </Field>
              <Field label="الموظف (اختياري)">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="line-adder">
              <ProductPicker
                products={products}
                onSelect={onSelectProduct}
                onViewMovements={(p) => {
                  setMovementProduct(p);
                  setShowMovements(true);
                }}
                placeholder="اختر المنتج..."
                getPrice={(p) => p.cost_price}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selQty}
                onChange={(e) => setSelQty(Number(e.target.value))}
                title="الكمية"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selCost}
                onChange={(e) => setSelCost(Number(e.target.value))}
                title="سعر الشراء"
              />
              <button type="button" className="btn primary" onClick={addLine}>
                + إضافة
              </button>
            </div>

            {lines.length > 0 && (
              <div className="cart">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>سعر الشراء</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product_id}>
                        <td>
                          {products.find((p) => p.id === l.product_id)?.name ??
                            l.product_id}
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.cost_price)}</td>
                        <td>{money(l.quantity * l.cost_price)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => removeLine(l.product_id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="totals">
              <div className="total-line">
                <span>المجموع الفرعي:</span>
                <b>{money(lines.reduce((s, l) => s + l.quantity * l.cost_price, 0))}</b>
              </div>
              {discount > 0 && (
                <div className="total-line">
                  <span>الخصم:</span>
                  <b className="text-red">-{money(discount)}</b>
                </div>
              )}
              {additional > 0 && (
                <div className="total-line">
                  <span>إضافي:</span>
                  <b className="text-green">+{money(additional)}</b>
                </div>
              )}
              <div className="total-line final">
                <span>الإجمالي:</span>
                <b>{money(total)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editingPurchase ? "حفظ التعديلات" : "حفظ المشتريات"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowForm(false);
                  setEditingPurchase(null);
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showReturnForm && (
        <Modal
          title={isIndependentReturn ? "مردود مشتريات جديد" : `مردود مشتريات P-${returningPurchase?.id}`}
          onClose={() => {
            setShowReturnForm(false);
            setReturningPurchase(null);
            setIsIndependentReturn(false);
          }}
          width="720px"
        >
          <form onSubmit={saveReturn}>
            <div className="form-grid">
              <Field label="التاريخ">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="المورد">
                {isIndependentReturn ? (
                  <div className="select-row">
                    <select
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                    >
                      <option value="">بدون مورد</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => {
                        setNewSupplierName("");
                        setNewSupplierPhone("");
                        setShowSuppliers(true);
                      }}
                    >
                      + مورد
                    </button>
                  </div>
                ) : (
                  <input
                    value={suppliers.find((s) => s.id === Number(supplierId))?.name ?? ""}
                    readOnly
                  />
                )}
              </Field>
              <Field label="خصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <Field label="إضافي">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={additional}
                  onChange={(e) => setAdditional(Number(e.target.value))}
                />
              </Field>
              <Field label="الموظف (اختياري)">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
              {isIndependentReturn && (
                <Field label="ملاحظات">
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </Field>
              )}
            </div>

            <div className="line-adder">
              <ProductPicker
                products={products}
                onSelect={onSelectProduct}
                onViewMovements={(p) => {
                  setMovementProduct(p);
                  setShowMovements(true);
                }}
                placeholder="اختر المنتج..."
                getPrice={(p) => p.cost_price}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selQty}
                onChange={(e) => setSelQty(Number(e.target.value))}
                title="الكمية المرتجعة"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selCost}
                onChange={(e) => setSelCost(Number(e.target.value))}
                title="سعر الشراء"
              />
              <button type="button" className="btn primary" onClick={addLine}>
                + إضافة
              </button>
            </div>

            {lines.length > 0 && (
              <div className="cart">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية المرتجعة</th>
                      <th>سعر الشراء</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product_id}>
                        <td>
                          {products.find((p) => p.id === l.product_id)?.name ??
                            l.product_id}
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.cost_price)}</td>
                        <td>{money(l.quantity * l.cost_price)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => removeLine(l.product_id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="totals">
              <div className="total-line">
                <span>المجموع الفرعي:</span>
                <b>{money(lines.reduce((s, l) => s + l.quantity * l.cost_price, 0))}</b>
              </div>
              {discount > 0 && (
                <div className="total-line">
                  <span>الخصم:</span>
                  <b className="text-red">-{money(discount)}</b>
                </div>
              )}
              {additional > 0 && (
                <div className="total-line">
                  <span>إضافي:</span>
                  <b className="text-green">+{money(additional)}</b>
                </div>
              )}
              <div className="total-line final">
                <span>الإجمالي:</span>
                <b>{money(lines.reduce((s, l) => s + l.quantity * l.cost_price, 0) - discount + additional)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ مردود المشتريات
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setShowReturnForm(false);
                  setReturningPurchase(null);
                  setIsIndependentReturn(false);
                }}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showSuppliers && (
        <Modal
          title="إدارة الموردين"
          onClose={() => setShowSuppliers(false)}
          width="520px"
        >
          <form onSubmit={addSupplier} className="form-grid">
            <Field label="اسم المورد *">
              <input
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                value={newSupplierPhone}
                onChange={(e) => setNewSupplierPhone(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                إضافة المورد
              </button>
            </div>
          </form>
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="strong">{s.name}</td>
                  <td>{s.phone ?? "—"}</td>
                  <td>
                    <button
                      className="btn sm danger"
                      onClick={() => removeSupplier(s)}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {viewingPurchase && (
        <Modal
          title={`فاتورة مشتريات P-${viewingPurchase.id}`}
          onClose={() => setViewingPurchase(null)}
          fullScreen
        >
          <div className="purchase-view">
            <div className="purchase-view-head">
              <div className="purchase-view-row">
                <span className="label">التاريخ:</span>
                <span>{fmtDate(viewingPurchase.date)}</span>
              </div>
              <div className="purchase-view-row">
                <span className="label">المورد:</span>
                <span>{viewingPurchase.supplier_name ?? "—"}</span>
              </div>
              <div className="purchase-view-row">
                <span className="label">المستودع:</span>
                <span>{viewingPurchase.warehouse_name ?? "—"}</span>
              </div>
              <div className="purchase-view-row">
                <span className="label">الموظف:</span>
                <span>{viewingPurchase.employee_name ?? "—"}</span>
              </div>
              <div className="purchase-view-row">
                <span className="label">ملاحظات:</span>
                <span>{viewingPurchase.notes ?? "—"}</span>
              </div>
            </div>

            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الصنف</th>
                  <th>الكمية</th>
                  <th>سعر الشراء</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {viewingPurchase.items.map((it, i) => (
                  <tr key={i}>
                    <td className="text-center">{i + 1}</td>
                    <td className="strong">{it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.cost_price)}</td>
                    <td>{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="strong">
                    الخصم
                  </td>
                  <td>{money(viewingPurchase.discount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="strong">
                    إضافي
                  </td>
                  <td>{money(viewingPurchase.additional)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="strong">
                    الإجمالي
                  </td>
                  <td className="strong text-red">
                    {money(viewingPurchase.total)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="form-actions">
              <button
                className="btn primary"
                onClick={() => {
                  setViewingPurchase(null);
                  openEdit(viewingPurchase);
                }}
              >
                تعديل
              </button>
              <button
                className="btn"
                onClick={() => setViewingPurchase(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}

      {printPurchase && (
        <Modal title={`فاتورة مشتريات P-${printPurchase.id}`} onClose={() => setPrintPurchase(null)} fullScreen>
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(printPurchase.date)}</b></div>
              <div><span>المورد:</span> <b>{printPurchase.supplier_name ?? "—"}</b></div>
              <div><span>الإجمالي:</span> <b>{money(printPurchase.total)}</b></div>
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {printPurchase.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.cost_price)}</td>
                    <td>{money(it.quantity * it.cost_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-totals">
              <div><span>المجموع الفرعي:</span> <b>{money(printPurchase.items.reduce((s, it) => s + it.quantity * it.cost_price, 0))}</b></div>
              {printPurchase.discount > 0 && <div><span>الخصم:</span> <b>{money(printPurchase.discount)}</b></div>}
              {printPurchase.additional > 0 && <div><span>إضافي:</span> <b>{money(printPurchase.additional)}</b></div>}
              <div className="inv-net"><span>الصافي:</span> <b>{money(printPurchase.total)}</b></div>
            </div>
          </div>
        </Modal>
      )}

      {printReturn && settings && (
        <PrintPurchaseReturn
          purchaseReturn={printReturn}
          settings={settings}
          onClose={() => setPrintReturn(null)}
        />
      )}

      {showMovements && movementProduct && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setShowMovements(false)}
          onViewInvoice={handleViewMovement}
        />
      )}
    </div>
  );
}
