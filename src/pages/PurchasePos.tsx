import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { ProductCard } from "../components/ProductCard";
import { InvoiceBar, type DiscountType } from "../components/InvoiceBar";
import { PrintBarcode } from "../components/PrintBarcode";
import { PrintPurchaseReturn } from "../components/PrintPurchaseReturn";
import { ProductMovements } from "../components/ProductMovements";
import { Field, Modal, fmtDate, money, qty, today, useToast } from "../components/ui";
import type {
  Category,
  Employee,
  Product,
  ProductMovement,
  Purchase,
  PurchaseReturn,
  Settings,
  Supplier,
  Warehouse,
  WarehouseStats,
} from "../types";

interface Line {
  product_id: number;
  name: string;
  quantity: number;
  cost_price: number;
}

const parseNameQty = (s: string) => {
  const m = s.trim().match(/^(.*?)\s+([\d.,]+)$/);
  if (m) {
    return { name: m[1].trim(), quantity: Number(m[2].replace(",", ".")) || 1 };
  }
  return { name: s.trim(), quantity: 1 };
};

export function PurchasePos({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit">("cash");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [additional, setAdditional] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStats | null>(
    null,
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<Purchase[]>([]);
  const [showBarcode, setShowBarcode] = useState(false);

  const [showMovements, setShowMovements] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const [printPurchase, setPrintPurchase] = useState<Purchase | null>(null);
  const [printReturn, setPrintReturn] = useState<PurchaseReturn | null>(null);

  const [newModal, setNewModal] = useState<{
    name: string;
    quantity: number;
  } | null>(null);
  const [np, setNp] = useState({
    name: "",
    barcode: "",
    category: "",
    unit: "",
    cost_price: 0,
    sell_price: 0,
    quantity: 1,
    min_quantity: 0,
    warehouse: "",
  });

  const [showSupplier, setShowSupplier] = useState(false);
  const [supForm, setSupForm] = useState({ name: "", phone: "", notes: "" });

  const searchRef = useRef<HTMLInputElement>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const [p, c, s, sup, h, wh, emps] = await Promise.all([
        api.listProducts(),
        api.listCategories(),
        api.getSettings(),
        api.listSuppliers(),
        api.listPurchases(),
        api.listWarehouses(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCategories(c);
      setSettings(s);
      setSuppliers(sup);
      setHistory(h);
      setWarehouses(wh);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!warehouseId) {
      setWarehouseStats(null);
      return;
    }
    let alive = true;
    api
      .warehouseStats(Number(warehouseId))
      .then((st) => {
        if (alive) setWarehouseStats(st);
      })
      .catch(() => {
        if (alive) setWarehouseStats(null);
      });
    return () => {
      alive = false;
    };
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) {
      const def = warehouses.find((w) => w.is_default);
      if (def) setWarehouseId(String(def.id));
    }
  }, [warehouses, warehouseId]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addWarehouse = async (name: string) => {
    try {
      const w = await api.createWarehouse(name);
      setWarehouses((ws) => [...ws, w]);
      setWarehouseId(String(w.id));
      notify(`تم إضافة المستودع "${w.name}"`);
    } catch (err) {
      notify(String(err), "error");
      throw err;
    }
  };

  const loadPurchase = async (id: number) => {
    try {
      const p = await api.getPurchase(id);
      setCurrentId(p.id);
      setLines(
        p.items.map((it) => ({
          product_id: it.product_id,
          name: it.product_name,
          quantity: it.quantity,
          cost_price: it.cost_price,
        })),
      );
      setSupplierId(p.supplier_id ? String(p.supplier_id) : "");
      setNotes(p.notes ?? "");
      setDate(p.date);
      setPaymentMethod(p.supplier_id ? "credit" : "cash");
      setDiscount(p.discount || 0);
      setDiscountType("amount");
      setAdditional(p.additional || 0);
      setWarehouseId(p.warehouse_id != null ? String(p.warehouse_id) : "");
      setEmployeeId(p.employee_id != null ? String(p.employee_id) : "");
      setSearch("");
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const historyIdx = history.findIndex((h) => h.id === currentId);
  const hasPrev = historyIdx >= 0 && historyIdx + 1 < history.length;
  const hasNext = historyIdx > 0;

  const filtered = products
    .filter(
      (p) =>
        !search.trim() ||
        p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        (p.barcode ?? "").includes(search.trim()),
    )
    .slice(0, 20);

  const addProduct = (p: Product, quantity: number) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === p.id);
      if (existing) {
        return ls.map((l) =>
          l.product_id === p.id
            ? { ...l, quantity: l.quantity + quantity }
            : l,
        );
      }
      return [
        ...ls,
        {
          product_id: p.id,
          name: p.name,
          quantity,
          cost_price: p.cost_price,
        },
      ];
    });
    setSearch("");
    setShowList(false);
    searchRef.current?.focus();
  };

  const handleViewMovement = async (movement: ProductMovement) => {
    try {
      if (movement.type === "purchase") {
        const purchase = await api.getPurchase(movement.related_id);
        setSettings(await api.getSettings());
        setPrintPurchase(purchase);
        setShowMovements(false);
      } else if (movement.type === "purchase_return") {
        const ret = await api.getPurchaseReturn(movement.related_id);
        setSettings(await api.getSettings());
        setPrintReturn(ret);
        setShowMovements(false);
      } else {
        notify("عرض الفاتورة غير متاح من هنا", "error");
      }
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const openNewProduct = async (name: string, quantity: number) => {
    let bc = "";
    try {
      bc = await api.nextBarcode();
    } catch {
      bc = "";
    }
    setNp({
      name,
      barcode: bc,
      category: "",
      unit: "",
      cost_price: 0,
      sell_price: 0,
      quantity,
      min_quantity: 0,
      warehouse: warehouseId,
    });
    setNewModal({ name, quantity });
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const s = search.trim();
      const byBarcode = products.find((p) => p.barcode === s);
      const found =
        byBarcode || products.find((p) => p.name.toLowerCase() === s.toLowerCase());
      if (found) {
        addProduct(found, 1);
        return;
      }
      if (filtered.length === 1 && filtered[0].name.toLowerCase() === s.toLowerCase()) {
        addProduct(filtered[0], 1);
        return;
      }
      if (!s) return;
      const { name, quantity } = parseNameQty(s);
      const exact = products.find(
        (p) => p.name.toLowerCase() === name.toLowerCase(),
      );
      if (exact) {
        addProduct(exact, quantity);
      } else {
        openNewProduct(name, quantity);
      }
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  };

  const saveNewProduct = async () => {
    if (!np.name.trim()) {
      notify("أدخل اسم الصنف", "error");
      return;
    }
    try {
      let categoryId: number | null = null;
      const catName = np.category.trim();
      if (catName) {
        const existing = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase(),
        );
        if (existing) {
          categoryId = existing.id;
        } else {
          const nc = await api.createCategory(catName);
          setCategories((cs) => [...cs, nc]);
          categoryId = nc.id;
        }
      }
      const created = await api.createProduct({
        name: np.name.trim(),
        barcode: np.barcode.trim() || null,
        category_id: categoryId,
        warehouse_id: np.warehouse ? Number(np.warehouse) : null,
        unit: np.unit.trim() || null,
        cost_price: np.cost_price,
        sell_price: np.sell_price,
        quantity: 0,
        min_quantity: np.min_quantity,
      });
      setProducts((ps) => [...ps, created]);
      setLines((ls) => [
        ...ls,
        {
          product_id: created.id,
          name: created.name,
          quantity: np.quantity || 1,
          cost_price: np.cost_price || created.cost_price,
        },
      ]);
      notify(`تم إنشاء الصنف "${created.name}" وإضافته للفاتورة`);
      setNewModal(null);
      searchRef.current?.focus();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveSupplier = async () => {
    if (!supForm.name.trim()) {
      notify("أدخل اسم المورد", "error");
      return;
    }
    try {
      const s = await api.createSupplier({
        name: supForm.name.trim(),
        phone: supForm.phone.trim() || null,
        notes: supForm.notes.trim() || null,
      });
      setSuppliers((ss) => [...ss, s]);
      setSupplierId(String(s.id));
      setShowSupplier(false);
      setSupForm({ name: "", phone: "", notes: "" });
      notify(`تم إضافة المورد "${s.name}"`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const updateLine = (pid: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.product_id === pid ? { ...l, ...patch } : l)));
  };

  const removeLine = (pid: number) =>
    setLines((ls) => ls.filter((l) => l.product_id !== pid));

  const total = lines.reduce((s, l) => s + l.quantity * l.cost_price, 0);
  const discountAmount =
    discountType === "percent" ? (total * (discount || 0)) / 100 : discount;
  const netTotal = Math.max(0, total - discountAmount + (additional || 0));

  const buildInput = () => ({
    date,
    supplier_id:
      paymentMethod === "credit" && supplierId ? Number(supplierId) : null,
    notes: notes.trim() || null,
    discount: discountAmount,
    additional: additional || null,
    warehouse_id: warehouseId ? Number(warehouseId) : null,
    employee_id: employeeId ? Number(employeeId) : null,
    items: lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      cost_price: l.cost_price,
    })),
  });

  const afterSave = async () => {
    setSearch("");
    await load();
  };

  const save = async () => {
    if (lines.length === 0) {
      notify("أضف صنف واحد على الأقل للفاتورة", "error");
      return;
    }
    if (paymentMethod === "credit" && !supplierId) {
      notify("اختر موردًا للفاتورة الآجلة", "error");
      return;
    }
    try {
      const isNew = currentId == null;
      const saved = isNew
        ? await api.createPurchase(buildInput())
        : await api.updatePurchase(currentId, buildInput());
      setCurrentId(saved.id);
      setLines(
        saved.items.map((it) => ({
          product_id: it.product_id,
          name: it.product_name,
          quantity: it.quantity,
          cost_price: it.cost_price,
        })),
      );
      notify(
        isNew
          ? paymentMethod === "cash"
            ? "تم تسجيل فاتورة الشراء (مورد نقدي)"
            : "تم تسجيل فاتورة الشراء الآجلة"
          : "تم حفظ التعديلات",
      );
      await afterSave();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const deleteCurrent = async () => {
    if (currentId == null) return;
    if (!window.confirm("هل تريد حذف فاتورة الشراء هذه؟")) return;
    try {
      await api.deletePurchase(currentId);
      notify("تم حذف الفاتورة");
      setCurrentId(null);
      setLines([]);
      setNotes("");
      setSupplierId("");
      setPaymentMethod("cash");
      setDiscount(0);
      setAdditional(0);
      setEmployeeId("");
      await afterSave();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const newInvoice = () => {
    setCurrentId(null);
    setLines([]);
    setNotes("");
    setSupplierId("");
    setPaymentMethod("cash");
    setDiscount(0);
    setAdditional(0);
    setEmployeeId("1");
    setDate(today());
    setSearch("");
    searchRef.current?.focus();
  };

  const goPrev = () => {
    if (!hasPrev) return;
    const target = history[historyIdx + 1];
    if (target) loadPurchase(target.id);
  };

  const goNext = () => {
    if (!hasNext) return;
    const target = history[historyIdx - 1];
    if (target) loadPurchase(target.id);
  };

  return (
    <div className="pos">
      <header className="pos-head">
        <button className="btn" onClick={onBack}>
          → رجوع
        </button>
        <div className="pos-title">
          <h1>فاتورة مشتريات</h1>
          <span>
            {currentId != null
              ? `فاتورة رقم ${currentId}`
              : settings?.store_name || "تبارك"}
          </span>
        </div>
        <div className="pos-head-actions">
          <button
            className="btn pos-nav-btn"
            onClick={goPrev}
            disabled={!hasPrev}
            title="الفاتورة السابقة"
          >
            ‹
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={goNext}
            disabled={!hasNext}
            title="الفاتورة التالية"
          >
            ›
          </button>
          <button className="btn pos-nav-btn" onClick={newInvoice} title="فاتورة جديدة">
            📄 جديدة
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={() => setShowBarcode(true)}
            title="طباعة باركود الأصناف"
            disabled={lines.length === 0}
          >
            🏷️ باركود
          </button>
          {currentId != null && (
            <button className="btn pos-nav-btn" onClick={save} title="حفظ التعديلات">
              ✏️ تعديل
            </button>
          )}
          {currentId != null && (
            <button
              className="btn pos-nav-btn danger"
              onClick={deleteCurrent}
              title="حذف الفاتورة"
            >
              🗑️ حذف
            </button>
          )}
          <button className="btn primary pos-save" onClick={save}>
            {currentId == null ? "💾 حفظ الفاتورة" : "💾 حفظ التعديلات"}
          </button>
        </div>
      </header>

      <div className="pos-body">
        <div className="pos-main">
          <div className="pos-search-wrap">
            <input
              ref={searchRef}
              className="pos-search"
              placeholder="🔍 اكتب اسم الصنف أو الباركود... (لو غير مسجل اضغط Enter لفتح كارت صنف جديد)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              onKeyDown={onSearchKey}
            />
            {showList && (
              <div className="pos-dropdown">
                {filtered.length === 0 && (
                  <div className="pos-dropdown-empty">
                    لا يوجد صنف مسجل بهذا الاسم — اضغط Enter لإنشائه كصنف جديد
                  </div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="pos-item"
                    onClick={() => addProduct(p, 1)}
                  >
                    <div className="pos-item-main">
                      <span className="pos-item-name">{p.name}</span>
                      <span className="pos-item-barcode">{p.barcode ?? ""}</span>
                    </div>
                    <div className="pos-item-prices">
                      <span className="pos-item-sell">
                        بيع: {money(p.sell_price)}
                      </span>
                      <span className="pos-item-cost">
                        شراء: {money(p.cost_price)}
                      </span>
                    </div>
                    <span
                      className={`pos-item-stock ${
                        p.quantity <= p.min_quantity ? "warn" : ""
                      }`}
                    >
                      {qty(p.quantity)}
                    </span>
                    <button
                      type="button"
                      className="btn sm pos-movement-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMovementProduct(p);
                        setShowMovements(true);
                      }}
                      title="حركة الصنف"
                    >
                      حركة صنف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pos-cart-wrap">
            {lines.length === 0 ? (
              <div className="pos-empty">
                <div>🚚</div>
                <p>ابدأ بكتابة اسم الصنف أو الباركود لإضافة أصناف للفاتورة</p>
              </div>
            ) : (
              <table className="table pos-cart">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th style={{ width: 100 }}>الكمية</th>
                    <th style={{ width: 130 }}>سعر الشراء</th>
                    <th style={{ width: 120 }}>الإجمالي</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr
                      key={l.product_id}
                      className="pos-line-row"
                      title="اضغط مرتين لفتح كرت الصنف"
                      onDoubleClick={() => {
                        const p = products.find((x) => x.id === l.product_id);
                        if (p) setEditProduct(p);
                      }}
                    >
                      <td>
                        <div className="pos-line-name">{l.name}</div>
                      </td>
                      <td>
                        <div className="qty-control">
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() =>
                              updateLine(l.product_id, {
                                quantity: Math.max(0.01, l.quantity - 1),
                              })
                            }
                          >
                            −
                          </button>
                          <input
                            className="qty-input"
                            type="number"
                            min={0}
                            step="0.01"
                            value={l.quantity}
                            onChange={(e) =>
                              updateLine(l.product_id, {
                                quantity: Number(e.target.value),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() =>
                              updateLine(l.product_id, {
                                quantity: l.quantity + 1,
                              })
                            }
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          className="price-input"
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.cost_price}
                          onChange={(e) =>
                            updateLine(l.product_id, {
                              cost_price: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="strong">{money(l.quantity * l.cost_price)}</td>
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
            )}
          </div>
        </div>

        <aside className="pos-panel">
          <div className="pos-panel-total">
            <span>إجمالي الفاتورة</span>
            <b>{money(netTotal)}</b>
          </div>

          <div className="pos-panel-field">
            <label>طريقة الدفع</label>
            <div className="pay-btns two">
              <button
                type="button"
                className={`pay-btn ${paymentMethod === "cash" ? "active" : ""}`}
                onClick={() => {
                  setPaymentMethod("cash");
                  setSupplierId("");
                }}
              >
                💵 نقدي
              </button>
              <button
                type="button"
                className={`pay-btn ${paymentMethod === "credit" ? "active" : ""}`}
                onClick={() => setPaymentMethod("credit")}
              >
                📒 آجل
              </button>
            </div>
          </div>

          {paymentMethod === "cash" ? (
            <div className="pos-panel-ok">الفاتورة لمورد نقدي (بدون مورد)</div>
          ) : (
            <div className="pos-panel-field">
              <label>المورد * (فاتورة آجلة)</label>
              <div className="pos-select-row">
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="">— اختر المورد —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowSupplier(true)}
                >
                  + جديد
                </button>
              </div>
            </div>
          )}

          <div className="pos-panel-field">
            <label>التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="pos-panel-field">
            <label>الموظف (اختياري)</label>
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
          </div>

          <div className="pos-panel-field">
            <label>ملاحظات</label>
            <textarea
              className="pos-notes"
              rows={3}
              placeholder="ملاحظات على الفاتورة..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button className="btn primary pos-panel-save" onClick={save}>
            {currentId == null ? "💾 حفظ الفاتورة" : "💾 حفظ التعديلات"}
          </button>
          <button className="btn pos-panel-clear" onClick={newInvoice}>
            📄 فاتورة جديدة
          </button>
        </aside>
      </div>

      <InvoiceBar
        lines={lines.map((l) => ({ quantity: l.quantity, price: l.cost_price }))}
        discount={discount}
        setDiscount={setDiscount}
        discountType={discountType}
        setDiscountType={setDiscountType}
        additional={additional}
        setAdditional={setAdditional}
        warehouses={warehouses}
        warehouseId={warehouseId}
        setWarehouseId={setWarehouseId}
        warehouseStats={warehouseStats}
        onAddWarehouse={addWarehouse}
      />

      {newModal && (
        <Modal
          title="🏷️ صنف جديد"
          onClose={() => setNewModal(null)}
          width="460px"
        >
          <div className="modal-grid">
            <Field label="اسم الصنف *">
              <input
                autoFocus
                value={np.name}
                onChange={(e) => setNp((s) => ({ ...s, name: e.target.value }))}
              />
            </Field>
            <Field label="الباركود (تلقائي — يمكن تعديله)">
              <input
                value={np.barcode}
                onChange={(e) =>
                  setNp((s) => ({ ...s, barcode: e.target.value }))
                }
              />
            </Field>
            <Field label="التصنيف (اكتب اسمًا جديدًا أو اختر)">
              <input
                list="pos-category-list"
                value={np.category}
                placeholder="مثال: حلويات، بقالة..."
                onChange={(e) =>
                  setNp((s) => ({ ...s, category: e.target.value }))
                }
              />
              <datalist id="pos-category-list">
                {categories.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </Field>
            <Field label="الوحدة">
              <input
                value={np.unit}
                placeholder="قطعة، كجم، علبة..."
                onChange={(e) =>
                  setNp((s) => ({ ...s, unit: e.target.value }))
                }
              />
            </Field>
            <Field label="المستودع">
              <select
                value={np.warehouse}
                onChange={(e) =>
                  setNp((s) => ({ ...s, warehouse: e.target.value }))
                }
              >
                <option value="">— بدون مستودع —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="سعر الشراء">
              <input
                type="number"
                min={0}
                step="0.01"
                value={np.cost_price}
                onChange={(e) =>
                  setNp((s) => ({ ...s, cost_price: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="سعر البيع">
              <input
                type="number"
                min={0}
                step="0.01"
                value={np.sell_price}
                onChange={(e) =>
                  setNp((s) => ({ ...s, sell_price: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="كمية الفاتورة">
              <input
                type="number"
                min={0}
                step="0.01"
                value={np.quantity}
                onChange={(e) =>
                  setNp((s) => ({ ...s, quantity: Number(e.target.value) }))
                }
              />
            </Field>
            <Field label="حد التنبيه">
              <input
                type="number"
                min={0}
                step="1"
                value={np.min_quantity}
                onChange={(e) =>
                  setNp((s) => ({ ...s, min_quantity: Number(e.target.value) }))
                }
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn primary" onClick={saveNewProduct}>
              💾 حفظ الصنف وإضافته للفاتورة
            </button>
          </div>
        </Modal>
      )}

      {showSupplier && (
        <Modal
          title="🚚 مورد جديد"
          onClose={() => setShowSupplier(false)}
          width="420px"
        >
          <div className="modal-grid">
            <Field label="اسم المورد *">
              <input
                autoFocus
                value={supForm.name}
                onChange={(e) =>
                  setSupForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </Field>
            <Field label="الهاتف">
              <input
                value={supForm.phone}
                onChange={(e) =>
                  setSupForm((s) => ({ ...s, phone: e.target.value }))
                }
              />
            </Field>
            <Field label="ملاحظات">
              <input
                value={supForm.notes}
                onChange={(e) =>
                  setSupForm((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowSupplier(false)}>
              إلغاء
            </button>
            <button className="btn primary" onClick={saveSupplier}>
              💾 حفظ المورد
            </button>
          </div>
        </Modal>
      )}

      {editProduct && (
        <ProductCard
          product={editProduct}
          categories={categories}
          warehouses={warehouses}
          onClose={() => setEditProduct(null)}
          onSaved={(p) => {
            setProducts((ps) => ps.map((x) => (x.id === p.id ? p : x)));
            setCategories((cs) => {
              if (p.category_name) {
                const exists = cs.find(
                  (c) => c.name.toLowerCase() === (p.category_name ?? "").toLowerCase(),
                );
                return exists
                  ? cs
                  : [...cs, { id: -Date.now(), name: p.category_name! }];
              }
              return cs;
            });
            setLines((ls) =>
              ls.map((l) =>
                l.product_id === p.id
                  ? { ...l, name: p.name, cost_price: p.cost_price }
                  : l,
              ),
            );
          }}
        />
      )}

      {showBarcode && (
        <PrintBarcode
          cards={lines.map((l) => {
            const p = products.find((x) => x.id === l.product_id);
            return {
              name: l.name,
              barcode: p?.barcode ?? "",
              price: p?.sell_price,
            };
          })}
          storeName={settings?.store_name || "تبارك"}
          onClose={() => setShowBarcode(false)}
        />
      )}

      {printPurchase && (
        <Modal title={`فاتورة مشتريات P-${printPurchase.id}`} onClose={() => setPrintPurchase(null)} width="720px">
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

      {showMovements && movementProduct && settings && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setShowMovements(false)}
          onViewInvoice={handleViewMovement}
        />
      )}
    </div>
  );
}
