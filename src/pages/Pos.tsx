import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { PrintInvoice } from "../components/PrintInvoice";
import { PrintSaleReturn } from "../components/PrintSaleReturn";
import { ProductCard } from "../components/ProductCard";
import { InvoiceBar, type DiscountType } from "../components/InvoiceBar";
import { ProductMovements } from "../components/ProductMovements";
import { Field, Modal, fmtDate, money, qty, today, useToast } from "../components/ui";
import type {
  Category,
  Customer,
  Employee,
  Product,
  ProductMovement,
  Sale,
  SaleReturn,
  Settings,
  Warehouse,
  WarehouseStats,
} from "../types";

interface Line {
  product_id: number;
  name: string;
  quantity: number;
  sell_price: number;
  available: number;
  cost_price: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "شبكة" },
  { value: "credit", label: "آجل" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  credit: "آجل",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

export function Pos({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);

  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cardSubType, setCardSubType] = useState<"visa" | "wallet">("visa");
  const [walletPhone, setWalletPhone] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [cashCustomer, setCashCustomer] = useState("");
  const [date, setDate] = useState(today());
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<DiscountType>("amount");
  const [additional, setAdditional] = useState(0);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStats | null>(
    null,
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<string>("");

  const [currentId, setCurrentId] = useState<number | null>(null);
  const [history, setHistory] = useState<Sale[]>([]);
  const [ready, setReady] = useState(false);

  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [printReturn, setPrintReturn] = useState<SaleReturn | null>(null);
  const [viewingReturn, setViewingReturn] = useState<SaleReturn | null>(null);

  const [showMovements, setShowMovements] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const [showCustomer, setShowCustomer] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", phone: "", notes: "" });

  const searchRef = useRef<HTMLInputElement>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const [p, c, s, cats, wh, h, emps] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.getSettings(),
        api.listCategories(),
        api.listWarehouses(),
        api.listSales(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCustomers(c);
      setSettings(s);
      setCategories(cats);
      setWarehouses(wh);
      setEmployees(emps);
      setHistory(h);
      setReady(true);
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

  const loadSale = async (id: number) => {
    try {
      const s = await api.getSale(id);
      setCurrentId(s.id);
      setLines(
        s.items.map((it) => {
          const prod = products.find((p) => p.id === it.product_id);
          return {
            product_id: it.product_id,
            name: it.product_name,
            quantity: it.quantity,
            sell_price: it.sell_price,
            available: prod ? prod.quantity : it.quantity,
            cost_price: prod ? prod.cost_price : 0,
          };
        }),
      );
      setPaymentMethod(s.payment_method);
      setCustomerId(s.customer_id != null ? String(s.customer_id) : "");
      setCashCustomer(
        s.customer_id == null ? (s.customer_name ?? "") : "",
      );
      setDate(s.date);
      setDiscount(s.discount || 0);
      setDiscountType("amount");
      setAdditional(s.additional || 0);
      setWarehouseId(s.warehouse_id != null ? String(s.warehouse_id) : "");
      setEmployeeId(s.employee_id != null ? String(s.employee_id) : "");
      setSearch("");
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const loadSaleRef = useRef<(id: number) => void>(() => {});
  useEffect(() => {
    loadSaleRef.current = loadSale;
  });

  useEffect(() => {
    if (!ready) return;
    const pending = localStorage.getItem("tabarak_open_sale");
    if (pending) {
      localStorage.removeItem("tabarak_open_sale");
      const id = Number(pending);
      if (id) loadSaleRef.current(id);
    }
  }, [ready]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "tabarak_open_sale" && e.newValue) {
        localStorage.removeItem("tabarak_open_sale");
        const id = Number(e.newValue);
        if (id) loadSaleRef.current(id);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

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

  const addProduct = (p: Product) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === p.id);
      if (existing) {
        return ls.map((l) =>
          l.product_id === p.id
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...ls,
        {
          product_id: p.id,
          name: p.name,
          quantity: 1,
          sell_price: p.sell_price,
          available: p.quantity,
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
      if (movement.type === "sale") {
        const sale = await api.getSale(movement.related_id);
        setSettings(await api.getSettings());
        setViewingSale(sale);
      } else if (movement.type === "sale_return") {
        const ret = await api.getSaleReturn(movement.related_id);
        setSettings(await api.getSettings());
        setViewingReturn(ret);
      } else {
        notify("عرض الفاتورة غير متاح من هنا", "error");
      }
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const byBarcode = products.find((p) => p.barcode === search.trim());
      if (byBarcode) {
        addProduct(byBarcode);
        return;
      }
      if (filtered.length > 0) {
        addProduct(filtered[0]);
      }
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  };

  const updateLine = (pid: number, patch: Partial<Line>) => {
    setLines((ls) => ls.map((l) => (l.product_id === pid ? { ...l, ...patch } : l)));
  };

  const removeLine = (pid: number) =>
    setLines((ls) => ls.filter((l) => l.product_id !== pid));

  const total = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0);
  const discountAmount =
    discountType === "percent" ? (total * (discount || 0)) / 100 : discount;
  const netTotal = Math.max(0, total - discountAmount + (additional || 0));

  const buildInput = () => ({
    date,
    discount: discountAmount,
    additional: additional || null,
    warehouse_id: warehouseId ? Number(warehouseId) : null,
    customer_id: customerId ? Number(customerId) : null,
    customer_name:
      paymentMethod === "credit" ? null : (paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : (cashCustomer.trim() || null)),
    payment_method: paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod,
    employee_id: employeeId ? Number(employeeId) : null,
    items: lines.map((l) => ({
      product_id: l.product_id,
      quantity: l.quantity,
      sell_price: l.sell_price,
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
    if (paymentMethod === "credit" && !customerId) {
      notify("اختر عميلًا للبيع الآجل", "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify("أدخل رقم الجوال للتحويل", "error");
      return;
    }
    try {
      const isNew = currentId == null;
      const saved = isNew
        ? await api.createSale(buildInput())
        : await api.updateSale(currentId, buildInput());
      setCurrentId(saved.id);
      setLines(
        saved.items.map((it) => ({
          product_id: it.product_id,
          name: it.product_name,
          quantity: it.quantity,
          sell_price: it.sell_price,
          available: it.quantity,
          cost_price: 0,
        })),
      );
      setPaymentMethod(saved.payment_method);
      setCustomerId(saved.customer_id != null ? String(saved.customer_id) : "");
      setCashCustomer(
        saved.customer_id == null ? (saved.customer_name ?? "") : "",
      );
      setDate(saved.date);
      setDiscount(saved.discount || 0);
      setDiscountType("amount");
      setAdditional(saved.additional || 0);
      setWarehouseId(
        saved.warehouse_id != null ? String(saved.warehouse_id) : "",
      );
      setEmployeeId(
        saved.employee_id != null ? String(saved.employee_id) : "",
      );
      notify(
        isNew
          ? `تم تسجيل الفاتورة ${saved.invoice_no}`
          : `تم حفظ التعديلات على الفاتورة ${saved.invoice_no}`,
      );
      await afterSave();
      setPrintSale(saved);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const deleteCurrent = async () => {
    if (currentId == null) return;
    if (!window.confirm("هل تريد حذف فاتورة المبيعات هذه؟")) return;
    try {
      await api.deleteSale(currentId);
      notify("تم حذف الفاتورة");
      setCurrentId(null);
      setLines([]);
      setPaymentMethod("cash");
      setCustomerId("");
      setCashCustomer("");
      setDiscount(0);
      setAdditional(0);
      setEmployeeId("");
      await afterSave();
      searchRef.current?.focus();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const newInvoice = () => {
    setCurrentId(null);
    setLines([]);
    setPaymentMethod("cash");
    setCustomerId("");
    setCashCustomer("");
    setDiscount(0);
    setDiscountType("amount");
    setAdditional(0);
    setEmployeeId("1");
    setDate(today());
    setSearch("");
    searchRef.current?.focus();
  };

  const goPrev = () => {
    if (!hasPrev) return;
    const target = history[historyIdx + 1];
    if (target) loadSale(target.id);
  };

  const goNext = () => {
    if (!hasNext) return;
    const target = history[historyIdx - 1];
    if (target) loadSale(target.id);
  };

  const printCurrent = async () => {
    if (currentId != null) {
      try {
        const s = await api.getSale(currentId);
        setPrintSale(s);
      } catch (e) {
        notify(String(e), "error");
      }
      return;
    }
    if (lines.length === 0) {
      notify("لا توجد أصناف لطباعتها", "error");
      return;
    }
    const wh = warehouses.find((w) => w.id === Number(warehouseId));
    const emp = employees.find((e) => e.id === Number(employeeId));
    const custName =
      paymentMethod === "credit"
        ? customers.find((c) => c.id === Number(customerId))?.name ?? null
        : (paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : (cashCustomer.trim() || null));
    const draft: Sale = {
      id: 0,
      invoice_no: "مسودة",
      date,
      total,
      discount: discountAmount,
      additional: additional || 0,
      net_total: netTotal,
      warehouse_id: warehouseId ? Number(warehouseId) : null,
      warehouse_name: wh?.name ?? null,
      customer_name: custName,
      customer_id: customerId ? Number(customerId) : null,
      payment_method: paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod,
      employee_id: employeeId ? Number(employeeId) : null,
      employee_name: emp?.name ?? null,
      items: lines.map((l) => ({
        product_id: l.product_id,
        product_name: l.name,
        quantity: l.quantity,
        sell_price: l.sell_price,
        total: l.quantity * l.sell_price,
      })),
    };
    setPrintSale(draft);
  };

  const saveCustomer = async () => {
    if (!custForm.name.trim()) {
      notify("أدخل اسم العميل", "error");
      return;
    }
    try {
      const c = await api.createCustomer({
        name: custForm.name.trim(),
        phone: custForm.phone.trim() || null,
        notes: custForm.notes.trim() || null,
      });
      setCustomers((cs) => [...cs, c]);
      setCustomerId(String(c.id));
      setShowCustomer(false);
      setCustForm({ name: "", phone: "", notes: "" });
      notify(`تم إضافة العميل "${c.name}"`);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const paid = paymentMethod === "cash" || paymentMethod === "card";
  const remaining = netTotal;

  return (
    <div className="pos">
      <header className="pos-head">
        <button className="btn" onClick={onBack}>
          → رجوع
        </button>
        <div className="pos-title">
          <h1>فاتورة مبيعات</h1>
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
          <button
            className="btn pos-nav-btn"
            onClick={newInvoice}
            title="فاتورة جديدة"
          >
            📄 جديدة
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={printCurrent}
            title="طباعة الفاتورة"
          >
            🖨️
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
              placeholder="🔍 اكتب اسم الصنف أو الباركود ثم Enter..."
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
                  <div className="pos-dropdown-empty">لا توجد نتائج مطابقة</div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="pos-item"
                    onClick={() => addProduct(p)}
                  >
                    <div className="pos-item-main">
                      <span className="pos-item-name">{p.name}</span>
                      <span className="pos-item-barcode">{p.barcode ?? ""}</span>
                    </div>
                    <div className="pos-item-prices">
                      <span className="pos-item-sell">
                        {money(p.sell_price)}
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
                <div>🛒</div>
                <p>ابدأ بكتابة اسم الصنف أو الباركود لإضافة أصناف للفاتورة</p>
              </div>
            ) : (
              <table className="table pos-cart">
                <thead>
                  <tr>
                    <th>الصنف</th>
                    <th style={{ width: 100 }}>الكمية</th>
                    <th style={{ width: 130 }}>السعر</th>
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
                        const p = products.find(
                          (x) => x.id === l.product_id,
                        );
                        if (p) setEditProduct(p);
                      }}
                    >
                      <td>
                        <div className="pos-line-name">{l.name}</div>
                        <div className="hint">
                          متوفر: {qty(l.available)} · شراء: {money(l.cost_price)}
                        </div>
                        {l.quantity > l.available && (
                          <div className="pos-qty-warn">⚠️ الكمية أكبر من المتوفر</div>
                        )}
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
                          value={l.sell_price}
                          onChange={(e) =>
                            updateLine(l.product_id, {
                              sell_price: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="strong">{money(l.quantity * l.sell_price)}</td>
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
            <span>الإجمالي</span>
            <b>{money(total)}</b>
          </div>

          <div className="pos-panel-net">
            <span>الصافي</span>
            <b>{money(netTotal)}</b>
          </div>

          <div className="pos-panel-field">
            <label>طريقة الدفع</label>
            <div className="pay-btns">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  className={`pay-btn ${paymentMethod === m.value ? "active" : ""}`}
                  onClick={() => {
                    setPaymentMethod(m.value);
                    if (m.value !== "card") setCardSubType("visa");
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "card" && (
            <div className="pos-panel-field">
              <label>نوع الشبكة</label>
              <div className="pay-btns two">
                <button
                  className={`pay-btn ${cardSubType === "visa" ? "active" : ""}`}
                  onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                >
                  💳 فيزا
                </button>
                <button
                  className={`pay-btn ${cardSubType === "wallet" ? "active" : ""}`}
                  onClick={() => setCardSubType("wallet")}
                >
                  📱 محفظة إلكترونية
                </button>
              </div>
            </div>
          )}

          {paymentMethod === "card" && cardSubType === "wallet" && (
            <div className="pos-panel-field">
              <label>رقم الجوال للتحويل *</label>
              <input
                type="tel"
                placeholder="05XXXXXXXX"
                value={walletPhone}
                onChange={(e) => setWalletPhone(e.target.value)}
              />
            </div>
          )}

          {paymentMethod === "credit" ? (
            <div className="pos-panel-field">
              <label>العميل * (بيع آجل)</label>
              <div className="pos-select-row">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">— اختر العميل —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 ? ` (مدين: ${money(c.balance)})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowCustomer(true)}
                >
                  + جديد
                </button>
              </div>
            </div>
          ) : (
            <div className="pos-panel-field">
              <label>اسم العميل (اختياري)</label>
              <input
                placeholder="اكتب اسم العميل النقدي (اختياري)"
                value={cashCustomer}
                onChange={(e) => setCashCustomer(e.target.value)}
              />
              <div className="pos-panel-ok" style={{ marginTop: 10 }}>
                {paid
                  ? `المطلوب سداده: ${money(remaining)}`
                  : "الفاتورة ستسجل على حساب العميل"}
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

          <button className="btn primary pos-panel-save" onClick={save}>
            {currentId == null ? "💾 حفظ الفاتورة" : "💾 حفظ التعديلات"}
          </button>
          <button className="btn pos-panel-clear" onClick={newInvoice}>
            📄 فاتورة جديدة
          </button>
        </aside>
      </div>

      <InvoiceBar
        lines={lines.map((l) => ({ quantity: l.quantity, price: l.sell_price }))}
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

      {showCustomer && (
        <Modal
          title="👤 عميل جديد"
          onClose={() => setShowCustomer(false)}
          width="420px"
        >
          <div className="modal-grid">
            <Field label="اسم العميل *">
              <input
                autoFocus
                value={custForm.name}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </Field>
            <Field label="الهاتف">
              <input
                value={custForm.phone}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, phone: e.target.value }))
                }
              />
            </Field>
            <Field label="ملاحظات">
              <input
                value={custForm.notes}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowCustomer(false)}>
              إلغاء
            </button>
            <button className="btn primary" onClick={saveCustomer}>
              💾 حفظ العميل
            </button>
          </div>
        </Modal>
      )}

      {viewingSale && (
        <Modal title={`فاتورة بيع ${viewingSale.invoice_no}`} onClose={() => setViewingSale(null)} width="720px">
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(viewingSale.date)}</b></div>
              <div><span>العميل:</span> <b>{viewingSale.customer_name ?? "—"}</b></div>
              <div><span>طريقة الدفع:</span> <b>{PAYMENT_LABELS[viewingSale.payment_method] ?? viewingSale.payment_method}</b></div>
              {viewingSale.warehouse_name && <div><span>المستودع:</span> <b>{viewingSale.warehouse_name}</b></div>}
              {viewingSale.employee_name && <div><span>الموظف:</span> <b>{viewingSale.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingSale.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.sell_price)}</td>
                    <td>{money(it.quantity * it.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-totals">
              <div><span>الإجمالي:</span> <b>{money(viewingSale.total)}</b></div>
              {viewingSale.discount > 0 && <div><span>الخصم:</span> <b>{money(viewingSale.discount)}</b></div>}
              {viewingSale.additional > 0 && <div><span>إضافي:</span> <b>{money(viewingSale.additional)}</b></div>}
              <div className="inv-net"><span>الصافي:</span> <b>{money(viewingSale.net_total)}</b></div>
            </div>
          </div>
        </Modal>
      )}

      {viewingReturn && (
        <Modal title={`فاتورة مردود مبيعات ${viewingReturn.invoice_no}`} onClose={() => setViewingReturn(null)} width="720px">
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(viewingReturn.date)}</b></div>
              <div><span>العميل:</span> <b>{viewingReturn.customer_name ?? "—"}</b></div>
              <div><span>طريقة الدفع:</span> <b>{PAYMENT_LABELS[viewingReturn.payment_method] ?? viewingReturn.payment_method}</b></div>
              {viewingReturn.warehouse_name && <div><span>المستودع:</span> <b>{viewingReturn.warehouse_name}</b></div>}
              {viewingReturn.employee_name && <div><span>الموظف:</span> <b>{viewingReturn.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingReturn.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.sell_price)}</td>
                    <td>{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-totals">
              <div><span>الإجمالي:</span> <b>{money(viewingReturn.total)}</b></div>
              {viewingReturn.discount > 0 && <div><span>الخصم:</span> <b>{money(viewingReturn.discount)}</b></div>}
              {viewingReturn.additional > 0 && <div><span>إضافي:</span> <b>{money(viewingReturn.additional)}</b></div>}
              <div className="inv-net"><span>الصافي:</span> <b>{money(viewingReturn.total - viewingReturn.discount + viewingReturn.additional)}</b></div>
            </div>
          </div>
        </Modal>
      )}

      {showMovements && movementProduct && settings && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setShowMovements(false)}
          onViewInvoice={handleViewMovement}
        />
      )}

      {printSale && settings && (
        <PrintInvoice
          sale={printSale}
          settings={settings}
          onClose={() => setPrintSale(null)}
        />
      )}

      {printReturn && settings && (
        <PrintSaleReturn
          saleReturn={printReturn}
          settings={settings}
          onClose={() => setPrintReturn(null)}
        />
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
                  ? {
                      ...l,
                      name: p.name,
                      sell_price: p.sell_price,
                      cost_price: p.cost_price,
                      available: p.quantity,
                    }
                  : l,
              ),
            );
          }}
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
