import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { PrintInvoice } from "../components/PrintInvoice";
import { PrintSaleReturn } from "../components/PrintSaleReturn";
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
import type { Customer, Employee, Product, Sale, SaleReturn, Settings, ProductMovement } from "../types";

interface Line {
  product_id: number;
  quantity: number;
  sell_price: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "شبكة" },
  { value: "credit", label: "آجل" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
  credit: "آجل",
};

export function Sales({
  onViewSale,
  onNewSale,
}: {
  onViewSale?: (id: number) => void;
  onNewSale?: () => void;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [printSale, setPrintSale] = useState<Sale | null>(null);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [printReturn, setPrintReturn] = useState<SaleReturn | null>(null);
  const [viewingReturn, setViewingReturn] = useState<SaleReturn | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);

  const [date, setDate] = useState(today());
  const [customer, setCustomer] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cardSubType, setCardSubType] = useState<"visa" | "wallet">("visa");
  const [walletPhone, setWalletPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [selPrice, setSelPrice] = useState(0);

  const [customerType, setCustomerType] = useState("regular");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSales(await api.listSales(search || undefined));
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
      const [p, c, emps] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCustomers(c);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setCustomer("");
    setCustomerId("");
    setPaymentMethod("cash");
    setDiscount(0);
    setLines([]);
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
    setCustomerType("regular");
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setEmployeeId("1");
    setShowForm(true);
  };

  const onSelectProduct = (p: Product) => {
    setSelProduct(String(p.id));
    setSelPrice(customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price);
    setSelQty(1);
  };


  const addLine = () => {
    if (!selProduct) {
      notify("اختر المنتج أولاً", "error");
      return;
    }
    const pid = Number(selProduct);
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    if (selQty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر", "error");
      return;
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === pid);
      if (existing) {
        return ls.map((l) =>
          l.product_id === pid
            ? { ...l, quantity: l.quantity + selQty, sell_price: selPrice }
            : l,
        );
      }
      return [...ls, { product_id: pid, quantity: selQty, sell_price: selPrice }];
    });
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
  };

  const removeLine = (pid: number) =>
    setLines((ls) => ls.filter((l) => l.product_id !== pid));

  const total = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0);
  const netTotal = Math.max(0, total - discount);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "credit" && !customerId) {
      notify("اختر عميلًا للبيع الآجل", "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify("أدخل رقم الجوال للتحويل", "error");
      return;
    }

    let finalCustomerId = customerId ? Number(customerId) : null;
    let finalCustomerName = customer || null;

    if (showNewCustomer && newCustomerName.trim()) {
      try {
        const nc = await api.createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          customer_type: customerType,
        });
        finalCustomerId = nc.id;
        finalCustomerName = nc.name;
        setCustomers(await api.listCustomers());
      } catch (err) {
        notify("فشل إنشاء العميل: " + String(err), "error");
        return;
      }
    }

    const effectivePayment = paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod;
    const effectiveCustomer = paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : finalCustomerName;
    try {
      const sale = await api.createSale({
        date,
        discount,
        customer_name: effectiveCustomer,
        customer_id: finalCustomerId,
        payment_method: effectivePayment,
        employee_id: employeeId ? Number(employeeId) : null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          sell_price: l.sell_price,
        })),
      });
      notify(`تم تسجيل الفاتورة ${sale.invoice_no}`);
      setShowForm(false);
      load();
      setSettings(await api.getSettings());
      setViewingSale(sale);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "credit" && !customerId) {
      notify("اختر عميلًا لمردود المبيعات الآجل", "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify("أدخل رقم الجوال للتحويل", "error");
      return;
    }
    const effectivePayment = paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod;
    const effectiveCustomer = paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : (customer || null);
    try {
      const ret = await api.createSaleReturn({
        date,
        discount,
        additional: 0,
        warehouse_id: null,
        customer_name: effectiveCustomer,
        customer_id: customerId ? Number(customerId) : null,
        payment_method: effectivePayment,
        notes: null,
        employee_id: employeeId ? Number(employeeId) : null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          sell_price: l.sell_price,
        })),
      });
      notify(`تم تسجيل مردود المبيعات ${ret.invoice_no}`);
      setShowReturnForm(false);
      load();
      setSettings(await api.getSettings());
      setViewingReturn(ret);
    } catch (err) {
      notify(String(err), "error");
    }
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

  const remove = async (s: Sale) => {
    if (
      !confirmDialog(
        `هل تريد حذف الفاتورة ${s.invoice_no}؟ سترجع الكميات للمخزون.`,
      )
    )
      return;
    try {
      await api.deleteSale(s.id);
      notify("تم حذف الفاتورة");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const showPrint = async (s: Sale) => {
    try {
      const full = await api.getSale(s.id);
      setSettings(await api.getSettings());
      setPrintSale(full);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const openReturn = async () => {
    try {
      const [p, c, emps] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCustomers(c);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setCustomer("");
    setCustomerId("");
    setPaymentMethod("cash");
    setDiscount(0);
    setLines([]);
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
    setEmployeeId("1");
    setShowReturnForm(true);
  };

  const availableFor = (pid: number) =>
    products.find((p) => p.id === pid)?.quantity ?? 0;

  const totalToday = sales
    .filter((s) => s.date === today())
    .reduce((sum, s) => sum + s.net_total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>سجل المبيعات</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary" onClick={() => onNewSale ? onNewSale() : openNew()}>
            + فاتورة جديدة
          </button>
          <button className="btn" onClick={openReturn}>
            + مردود مبيعات
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>
          فواتير اليوم: <b>{sales.filter((s) => s.date === today()).length}</b>
        </span>
        <span>
          مبيعات اليوم: <b>{money(totalToday)}</b>
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>الموظف</th>
              <th>الطريقة</th>
              <th>الإجمالي</th>
              <th>الخصم</th>
              <th>الصافي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="empty">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  لا توجد فواتير بعد.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.invoice_no}</td>
                <td>{fmtDate(s.date)}</td>
                <td>{s.customer_name ?? "—"}</td>
                <td>{s.employee_name ?? "—"}</td>
                <td>
                  <span className={`pay-badge ${s.payment_method}`}>
                    {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                  </span>
                </td>
                <td>{money(s.total)}</td>
                <td>{money(s.discount)}</td>
                <td className="strong">{money(s.net_total)}</td>
                <td className="actions">
                  <button
                    className="btn sm"
                    onClick={() => onViewSale?.(s.id)}
                    title="فتح الفاتورة كاملة"
                  >
                    عرض
                  </button>
                  <button className="btn sm outline" onClick={() => showPrint(s)}>
                    🖨️
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => openReturn()}
                    title="مردود مبيعات"
                  >
                    مردود
                  </button>
                  <button className="btn sm danger" onClick={() => remove(s)}>
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
          title="فاتورة بيع جديدة"
          onClose={() => setShowForm(false)}
          width="760px"
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
              <Field label="طريقة الدفع">
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== "card") setCardSubType("visa");
                  }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {paymentMethod === "card" && (
                <Field label="نوع الشبكة">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "visa" ? "primary" : ""}`}
                      onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                    >
                      💳 فيزا
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "wallet" ? "primary" : ""}`}
                      onClick={() => setCardSubType("wallet")}
                    >
                      📱 محفظة إلكترونية
                    </button>
                  </div>
                </Field>
              )}
              {paymentMethod === "card" && cardSubType === "wallet" && (
                <Field label="رقم الجوال للتحويل *">
                  <input
                    type="tel"
                    placeholder="05XXXXXXXX"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </Field>
              )}
              {paymentMethod === "credit" ? (
                <Field label="اختر العميل *">
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.find(
                        (x) => x.id === Number(e.target.value),
                      );
                      setCustomer(c ? c.name : "");
                    }}
                  >
                    <option value="">— اختر العميل —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.balance > 0 ? ` (مدين: ${money(c.balance)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="اسم العميل (اختياري)">
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={customerId}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__new__") {
                            setShowNewCustomer(true);
                            setCustomerId("");
                            setCustomer("");
                          } else {
                            setCustomerId(v);
                            const c = customers.find((x) => x.id === Number(v));
                            setCustomer(c ? c.name : "");
                            if (c) setCustomerType(c.customer_type || "regular");
                            setShowNewCustomer(false);
                          }
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">— اختر عميل —</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.customer_type === "wholesale" ? "(جملة)" : c.customer_type === "merchant" ? "(تاجر)" : ""}
                          </option>
                        ))}
                        <option value="__new__">+ عميل جديد</option>
                      </select>
                    </div>
                  </Field>
                  {showNewCustomer && (
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>عميل جديد</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                          placeholder="اسم العميل *"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          style={{ flex: 1, minWidth: 140 }}
                        />
                        <input
                          placeholder="الجوال (اختياري)"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          style={{ flex: 1, minWidth: 120 }}
                        />
                        <select
                          value={customerType}
                          onChange={(e) => setCustomerType(e.target.value)}
                          style={{ minWidth: 120 }}
                        >
                          <option value="regular">عميل جاري</option>
                          <option value="wholesale">عميل جملة</option>
                          <option value="merchant">تاجر</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
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
                getPrice={(p) => customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price}
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
                value={selPrice === 0 ? "" : selPrice}
                placeholder="0"
                onChange={(e) => setSelPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                title="سعر البيع"
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
                      <th>السعر</th>
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
                          <span className="hint">
                            {" "}
                            (متوفر: {qty(availableFor(l.product_id))})
                          </span>
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.sell_price)}</td>
                        <td>{money(l.quantity * l.sell_price)}</td>
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
              <Field label="الخصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <div className="total-line">
                <span>الإجمالي:</span>
                <b>{money(total)}</b>
              </div>
              <div className="total-line final">
                <span>الصافي:</span>
                <b>{money(netTotal)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ الفاتورة
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showReturnForm && (
        <Modal
          title="مردود مبيعات"
          onClose={() => setShowReturnForm(false)}
          width="760px"
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
              <Field label="طريقة الدفع">
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== "card") setCardSubType("visa");
                  }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {paymentMethod === "card" && (
                <Field label="نوع الشبكة">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "visa" ? "primary" : ""}`}
                      onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                    >
                      💳 فيزا
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "wallet" ? "primary" : ""}`}
                      onClick={() => setCardSubType("wallet")}
                    >
                      📱 محفظة إلكترونية
                    </button>
                  </div>
                </Field>
              )}
              {paymentMethod === "card" && cardSubType === "wallet" && (
                <Field label="رقم الجوال للتحويل *">
                  <input
                    type="tel"
                    placeholder="05XXXXXXXX"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </Field>
              )}
              {paymentMethod === "credit" ? (
                <Field label="اختر العميل *">
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.find(
                        (x) => x.id === Number(e.target.value),
                      );
                      setCustomer(c ? c.name : "");
                    }}
                  >
                    <option value="">— اختر العميل —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.balance > 0 ? ` (مدين: ${money(c.balance)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="اسم العميل (اختياري)">
                  <input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="للمردود النقدي"
                  />
                </Field>
              )}
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
                getPrice={(p) => customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price}
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
                value={selPrice === 0 ? "" : selPrice}
                placeholder="0"
                onChange={(e) => setSelPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                title="سعر البيع"
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
                      <th>السعر</th>
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
                          <span className="hint">
                            {" "}
                            (متوفر: {qty(availableFor(l.product_id))})
                          </span>
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.sell_price)}</td>
                        <td>{money(l.quantity * l.sell_price)}</td>
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
              <Field label="الخصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <div className="total-line">
                <span>الإجمالي:</span>
                <b>{money(total)}</b>
              </div>
              <div className="total-line final">
                <span>الصافي:</span>
                <b>{money(netTotal)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ مردود المبيعات
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowReturnForm(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewingSale && (
        <Modal title={`فاتورة بيع ${viewingSale.invoice_no}`} onClose={() => setViewingSale(null)} width="720px">
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(viewingSale.date)}</b></div>
              <div><span>العميل:</span> <b>{viewingSale.customer_name ?? "—"}</b></div>
              <div><span>طريقة الدفع:</span> <b>{viewingSale.payment_method}</b></div>
              {viewingSale.warehouse_name && <div><span>المستودع:</span> <b>{viewingSale.warehouse_name}</b></div>}
              {viewingSale.employee_name && <div><span>الموظف:</span> <b>{viewingSale.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingSale.items.filter((it) => !(it.sell_price === 0 && !it.item_name)).map((it, i) => (
                  <tr key={i}>
                    <td>{it.item_name || it.product_name}</td>
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
              <div><span>طريقة الدفع:</span> <b>{viewingReturn.payment_method}</b></div>
              {viewingReturn.warehouse_name && <div><span>المستودع:</span> <b>{viewingReturn.warehouse_name}</b></div>}
              {viewingReturn.employee_name && <div><span>الموظف:</span> <b>{viewingReturn.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingReturn.items.filter((it) => !(it.sell_price === 0 && !it.item_name)).map((it, i) => (
                  <tr key={i}>
                    <td>{it.item_name || it.product_name}</td>
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

      {showMovements && movementProduct && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setShowMovements(false)}
          onViewInvoice={handleViewMovement}
        />
      )}

      {printSale && settings && (() => {
        let logo = ""; let warranty = "";
        try { const raw = localStorage.getItem("tabarak_print_settings"); if (raw) { const ps = JSON.parse(raw); if (ps.invoiceLogo) logo = ps.invoiceLogo; if (ps.warrantyText) warranty = ps.warrantyText; } } catch {}
        return (
          <PrintInvoice
            sale={printSale}
            settings={settings}
            invoiceLogo={logo}
            warrantyText={warranty}
            onClose={() => setPrintSale(null)}
          />
        );
      })()}

      {printReturn && settings && (
        <PrintSaleReturn
          saleReturn={printReturn}
          settings={settings}
          onClose={() => setPrintReturn(null)}
        />
      )}
    </div>
  );
}


