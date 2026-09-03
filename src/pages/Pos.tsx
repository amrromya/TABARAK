import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "../i18n";
import { api } from "../api";
import { PrintInvoice } from "../components/PrintInvoice";
import { PrintThermal } from "../components/PrintThermal";
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
  composite_category_id: number | null;
  composite_category_name: string | null;
  product_type?: string;
  addons: { product_id: number; name: string; sell_price: number; quantity: number }[];
}

const PAYMENT_METHODS = [
  { value: "cash", label: t("cash") },
  { value: "card", label: t("card") },
  { value: "credit", label: t("credit") },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: t("cash"),
  credit: t("credit"),
  card: t("card"),
  card_visa: t("cardVisa"),
  card_wallet: t("cardWallet"),
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
  const [custForm, setCustForm] = useState({ name: "", phone: "", notes: "", customer_type: "regular" });
  const [customerType, setCustomerType] = useState("regular");

  const searchRef = useRef<HTMLInputElement>(null);
  const notify = useToast();
  const [categoryProducts, setCategoryProducts] = useState<Product[]>([]);
  const [activeAddonLine, setActiveAddonLine] = useState<number | null>(null);

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
    // Don't auto-focus — only focus when user clicks the search bar
  }, []);

  const addWarehouse = async (name: string) => {
    try {
      const w = await api.createWarehouse(name);
      setWarehouses((ws) => [...ws, w]);
      setWarehouseId(String(w.id));
      notify(`${t("warehouseAdded")} "${w.name}"`);
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
            composite_category_id: null,
            composite_category_name: null,
            addons: [],
          };
        }),
      );
      setPaymentMethod(s.payment_method);
      setCustomerId(s.customer_id != null ? String(s.customer_id) : "");
      if (s.customer_id) {
        const cust = customers.find((c) => c.id === s.customer_id);
        setCustomerType(cust?.customer_type || "regular");
        setCashCustomer(cust?.name ?? "");
      } else {
        setCustomerType("regular");
        setCashCustomer(s.customer_name ?? "");
      }
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
        (p.barcode ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
        (p.category_name ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
        (p.warehouse_name ?? "").toLowerCase().includes(search.trim().toLowerCase()) ||
        (p.unit ?? "").toLowerCase().includes(search.trim().toLowerCase()),
    )
    .slice(0, 20);

  const addProduct = (p: Product) => {
    const price = customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price;
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
          sell_price: price,
          available: p.quantity,
          cost_price: p.cost_price,
          composite_category_id: p.composite_category_id,
          composite_category_name: p.composite_category_name,
          product_type: p.product_type,
          addons: [],
        },
      ];
    });
    setSearch("");
    setShowList(false);
    searchRef.current?.focus();
  };

  const openAddons = async (lineProductId: number) => {
    const line = lines.find((l) => l.product_id === lineProductId);
    if (!line?.composite_category_id) return;
    setActiveAddonLine(lineProductId);
    try {
      const prods = await api.listProductsByCategory(line.composite_category_id);
      setCategoryProducts(prods.filter((p) => p.id !== lineProductId));
    } catch {
      setCategoryProducts([]);
    }
  };

  const addAddon = (lineProductId: number, addon: Product) => {
    setLines((ls) =>
      ls.map((l) => {
        if (l.product_id !== lineProductId) return l;
        const existing = l.addons.find((a) => a.product_id === addon.id);
        if (existing) {
          return {
            ...l,
            addons: l.addons.map((a) =>
              a.product_id === addon.id ? { ...a, quantity: a.quantity + 1 } : a,
            ),
          };
        }
        return {
          ...l,
          addons: [
            ...l.addons,
            {
              product_id: addon.id,
              name: addon.name,
              sell_price: addon.sell_price,
              quantity: 1,
            },
          ],
        };
      }),
    );
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
        notify(t("viewInvoiceNotAvailable"), "error");
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

  const total = lines.reduce(
    (s, l) =>
      s +
      l.quantity * l.sell_price +
      l.addons.reduce((as2, a) => as2 + a.quantity * a.sell_price, 0),
    0,
  );
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
      paymentMethod === "credit"
        ? (customers.find((c) => c.id === Number(customerId))?.name ?? null)
        : (paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim()
          ? walletPhone.trim()
          : ((customers.find((c) => c.id === Number(customerId))?.name) ?? (cashCustomer.trim() || null))),
    payment_method: paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod,
    employee_id: employeeId ? Number(employeeId) : null,
    items: lines.flatMap((l) => {
      if (l.addons.length > 0) {
        const addonTotal = l.addons.reduce((s, a) => s + a.sell_price * a.quantity, 0);
        const addonNames = l.addons.map((a) => a.name).join(" + ");
        const mergedName = `${l.name} + ${addonNames}`;
        return [
          { product_id: l.product_id, quantity: l.quantity, sell_price: l.sell_price + addonTotal, item_name: mergedName },
          ...l.addons.map((a) => ({
            product_id: a.product_id,
            quantity: a.quantity,
            sell_price: 0,
            item_name: null as string | null,
          })),
        ];
      }
      return [
        { product_id: l.product_id, quantity: l.quantity, sell_price: l.sell_price, item_name: null as string | null },
      ];
    }),
  });

  const afterSave = async () => {
    setSearch("");
    await load();
  };

  const save = async () => {
    if (lines.length === 0) {
      notify(t("addItemError"), "error");
      return;
    }
    if (paymentMethod === "credit" && !customerId) {
      notify(t("chooseCreditCustomer"), "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify(t("enterWalletPhone"), "error");
      return;
    }
    try {
      let effectiveCustomerId = customerId ? Number(customerId) : null;
      const isNew = currentId == null;
      const saved = isNew
        ? await api.createSale({
            ...buildInput(),
            customer_id: effectiveCustomerId,
          })
        : await api.updateSale(currentId, {
            ...buildInput(),
            customer_id: effectiveCustomerId,
          });
      setCurrentId(saved.id);
      setLines(
        saved.items.map((it) => ({
          product_id: it.product_id,
          name: it.product_name,
          quantity: it.quantity,
          sell_price: it.sell_price,
          available: it.quantity,
          cost_price: 0,
          composite_category_id: null,
          composite_category_name: null,
          addons: [],
        })),
      );
      setPaymentMethod(saved.payment_method);
      setCustomerId(saved.customer_id != null ? String(saved.customer_id) : "");
      if (saved.customer_id) {
        const cust = customers.find((c) => c.id === saved.customer_id);
        setCustomerType(cust?.customer_type || "regular");
        setCashCustomer(cust?.name ?? "");
      } else {
        setCustomerType("regular");
        setCashCustomer(saved.customer_name ?? "");
      }
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
          ? `${t("invoiceRegistered")} ${saved.invoice_no}`
          : `${t("invoiceUpdated")} ${saved.invoice_no}`,
      );
      await afterSave();
      setPrintSale(saved);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const deleteCurrent = async () => {
    if (currentId == null) return;
    if (!window.confirm(t("confirmDeleteInvoice"))) return;
    try {
      await api.deleteSale(currentId);
      notify(t("invoiceDeleted"));
      setCurrentId(null);
      setLines([]);
      setPaymentMethod("cash");
      setCustomerId("");
      setCashCustomer("");
      setCustomerType("regular");
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
    setCustomerType("regular");
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
      notify(t("noItemsToPrint"), "error");
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
      invoice_no: t("draft"),
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
      notify(t("enterCustomerName"), "error");
      return;
    }
    try {
      const c = await api.createCustomer({
        name: custForm.name.trim(),
        phone: custForm.phone.trim() || null,
        notes: custForm.notes.trim() || null,
        customer_type: custForm.customer_type || "regular",
      });
      setCustomers((cs) => [...cs, c]);
      setCustomerId(String(c.id));
      setCashCustomer(c.name);
      setCustomerType(c.customer_type || "regular");
      setShowCustomer(false);
      setCustForm({ name: "", phone: "", notes: "", customer_type: "regular" });
      notify(`${t("customerAdded")} "${c.name}"`);
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
          → {t("back")}
        </button>
        <div className="pos-title">
          <h1>{t("saleInvoice")}</h1>
          <span>
            {currentId != null
              ? `${t("invoiceNumber")} ${currentId}`
              : settings?.store_name || t("appTitle")}
          </span>
        </div>
        <div className="pos-head-actions">
          <button
            className="btn pos-nav-btn"
            onClick={goPrev}
            disabled={!hasPrev}
            title={t("previousInvoice")}
          >
            ‹
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={goNext}
            disabled={!hasNext}
            title={t("nextInvoice")}
          >
            ›
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={newInvoice}
            title={t("newInvoice")}
          >
            📄 {t("new")}
          </button>
          <button
            className="btn pos-nav-btn"
            onClick={printCurrent}
            title={t("printInvoice")}
          >
            🖨️
          </button>
          {currentId != null && (
            <button className="btn pos-nav-btn" onClick={save} title={t("saveChanges")}>
              ✏️ {t("edit")}
            </button>
          )}
          {currentId != null && (
            <button
              className="btn pos-nav-btn danger"
              onClick={deleteCurrent}
              title={t("deleteInvoice")}
            >
              🗑️ {t("delete")}
            </button>
          )}
          <button className="btn primary pos-save" onClick={save}>
            {currentId == null ? `💾 ${t("saveInvoice")}` : `💾 ${t("saveChanges")}`}
          </button>
        </div>
      </header>

      <div className="pos-body">
        <div className="pos-main">
          <div className="pos-search-wrap">
            <input
              ref={searchRef}
              className="pos-search"
              placeholder={t("searchPlaceholder")}
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
                  <div className="pos-dropdown-empty">{t("noResults")}</div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="pos-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addProduct(p);
                    }}
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
                        {t("costPriceShort")}: {money(p.cost_price)}
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
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setMovementProduct(p);
                        setShowMovements(true);
                      }}
                      title={t("productMovement")}
                    >
                      {t("productMovement")}
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
                <p>{t("posEmptyHint")}</p>
              </div>
            ) : (
              <table className="table pos-cart">
                <thead>
                  <tr>
                    <th>{t("item")}</th>
                    <th style={{ width: 100 }}>{t("quantity")}</th>
                    <th style={{ width: 130 }}>{t("price")}</th>
                    <th style={{ width: 120 }}>{t("total")}</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr
                      key={l.product_id}
                      className="pos-line-row"
                      title={t("doubleClickHint")}
                      onDoubleClick={() => {
                        const p = products.find(
                          (x) => x.id === l.product_id,
                        );
                        if (p) setEditProduct(p);
                      }}
                    >
                      <td>
                        <div className="pos-line-name">
                          {l.name}
                          {l.composite_category_id && (
                            <span style={{ fontSize: 11, color: "#8b5cf6", marginRight: 6 }}>
                              🔗 {l.composite_category_name}
                            </span>
                          )}
                        </div>
                        <div className="hint">
                          {t("availableLabel")}: {qty(l.available)} · {t("costPriceShort")}: {money(l.cost_price)}
                        </div>
                        {l.addons.length > 0 && (
                          <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>
                            {l.addons.map((a) => (
                              <span key={a.product_id} style={{ marginRight: 8 }}>
                                +{a.name} ×{a.quantity} ({money(a.sell_price)})
                              </span>
                            ))}
                          </div>
                        )}
                        {l.composite_category_id && (
                          <button
                            type="button"
                            className="btn sm"
                            style={{ marginTop: 4, fontSize: 11, padding: "2px 8px" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openAddons(l.product_id);
                            }}
                          >
                            + {t("addOn")}
                          </button>
                        )}
                        {l.product_type !== "service" && l.quantity > l.available && (
                          <div className="pos-qty-warn">⚠️ {t("qtyExceedsAvailable")}</div>
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
                            value={l.sell_price === 0 ? "" : l.sell_price}
                            placeholder="0"
                            onChange={(e) =>
                              updateLine(l.product_id, {
                                sell_price: e.target.value === "" ? 0 : Number(e.target.value),
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
            <span>{t("total")}</span>
            <b>{money(total)}</b>
          </div>

          <div className="pos-panel-net">
            <span>{t("netTotal")}</span>
            <b>{money(netTotal)}</b>
          </div>

          <div className="pos-panel-field">
            <label>{t("paymentMethod")}</label>
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
              <label>{t("cardType")}</label>
              <div className="pay-btns two">
                <button
                  className={`pay-btn ${cardSubType === "visa" ? "active" : ""}`}
                  onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                >
                  💳 {t("visa")}
                </button>
                <button
                  className={`pay-btn ${cardSubType === "wallet" ? "active" : ""}`}
                  onClick={() => setCardSubType("wallet")}
                >
                  📱 {t("eWallet")}
                </button>
              </div>
            </div>
          )}

          {paymentMethod === "card" && cardSubType === "wallet" && (
            <div className="pos-panel-field">
              <label>{t("walletPhoneLabel")} *</label>
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
              <label>{t("customer")} * ({t("credit")})</label>
              <div className="pos-select-row">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">— {t("chooseCustomer")} —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.balance > 0 ? ` (${t("debtor")}: ${money(c.balance)})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowCustomer(true)}
                >
                  + {t("new")}
                </button>
              </div>
            </div>
          ) : (
            <div className="pos-panel-field">
              <label>{t("customer")} ({t("optionalLabel")})</label>
              <div className="pos-select-row">
                <select
                  value={customerId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomerId(v);
                    const c = customers.find((x) => x.id === Number(v));
                    if (c) {
                      setCashCustomer(c.name);
                      setCustomerType(c.customer_type || "regular");
                    } else {
                      setCashCustomer("");
                      setCustomerType("regular");
                    }
                  }}
                >
                  <option value="">— {t("chooseCustomer")} —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.customer_type === "wholesale" ? "(جملة)" : c.customer_type === "merchant" ? "(تاجر)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowCustomer(true)}
                >
                  + {t("new")}
                </button>
              </div>
              <div className="pos-panel-ok" style={{ marginTop: 10 }}>
                {paid
                  ? `${t("amountDue")}: ${money(remaining)}`
                  : t("creditInvoiceNote")}
              </div>
            </div>
          )}

          <div className="pos-panel-field">
            <label>{t("date")}</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="pos-panel-field">
            <label>{t("employee")} ({t("optionalLabel")})</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">— {t("chooseEmployee")} —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <button className="btn primary pos-panel-save" onClick={save}>
            {currentId == null ? `💾 ${t("saveInvoice")}` : `💾 ${t("saveChanges")}`}
          </button>
          <button className="btn pos-panel-clear" onClick={newInvoice}>
            📄 {t("newInvoice")}
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
          title={`👤 ${t("newCustomer")}`}
          onClose={() => setShowCustomer(false)}
          width="420px"
        >
          <div className="modal-grid">
            <Field label={`${t("customerNameLabel")} *`}>
              <input
                autoFocus
                value={custForm.name}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, name: e.target.value }))
                }
              />
            </Field>
            <Field label={t("phone")}>
              <input
                value={custForm.phone}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, phone: e.target.value }))
                }
              />
            </Field>
            <Field label={t("notes")}>
              <input
                value={custForm.notes}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, notes: e.target.value }))
                }
              />
            </Field>
            <Field label="نوع العميل">
              <select
                value={custForm.customer_type}
                onChange={(e) =>
                  setCustForm((s) => ({ ...s, customer_type: e.target.value }))
                }
              >
                <option value="regular">عميل جاري</option>
                <option value="wholesale">جملة</option>
                <option value="merchant">تاجر</option>
              </select>
            </Field>
          </div>
          <div className="modal-actions">
            <button className="btn" onClick={() => setShowCustomer(false)}>
              {t("cancel")}
            </button>
            <button className="btn primary" onClick={saveCustomer}>
              💾 {t("saveCustomer")}
            </button>
          </div>
        </Modal>
      )}

      {viewingSale && (
        <Modal title={`${t("saleInvoiceTitle")} ${viewingSale.invoice_no}`} onClose={() => setViewingSale(null)} width="720px">
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>{t("date")}:</span> <b>{fmtDate(viewingSale.date)}</b></div>
              <div><span>{t("customer")}:</span> <b>{viewingSale.customer_name ?? "—"}</b></div>
              <div><span>{t("paymentMethod")}:</span> <b>{PAYMENT_LABELS[viewingSale.payment_method] ?? viewingSale.payment_method}</b></div>
              {viewingSale.warehouse_name && <div><span>{t("warehouse")}:</span> <b>{viewingSale.warehouse_name}</b></div>}
              {viewingSale.employee_name && <div><span>{t("employee")}:</span> <b>{viewingSale.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>{t("item")}</th><th>{t("quantity")}</th><th>{t("price")}</th><th>{t("total")}</th></tr></thead>
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
              <div><span>{t("total")}:</span> <b>{money(viewingSale.total)}</b></div>
              {viewingSale.discount > 0 && <div><span>{t("discount")}:</span> <b>{money(viewingSale.discount)}</b></div>}
              {viewingSale.additional > 0 && <div><span>{t("additionalShort")}:</span> <b>{money(viewingSale.additional)}</b></div>}
              <div className="inv-net"><span>{t("netTotal")}:</span> <b>{money(viewingSale.net_total)}</b></div>
            </div>
          </div>
        </Modal>
      )}

      {viewingReturn && (
        <Modal title={`${t("returnInvoiceTitle")} ${viewingReturn.invoice_no}`} onClose={() => setViewingReturn(null)} width="720px">
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>{t("date")}:</span> <b>{fmtDate(viewingReturn.date)}</b></div>
              <div><span>{t("customer")}:</span> <b>{viewingReturn.customer_name ?? "—"}</b></div>
              <div><span>{t("paymentMethod")}:</span> <b>{PAYMENT_LABELS[viewingReturn.payment_method] ?? viewingReturn.payment_method}</b></div>
              {viewingReturn.warehouse_name && <div><span>{t("warehouse")}:</span> <b>{viewingReturn.warehouse_name}</b></div>}
              {viewingReturn.employee_name && <div><span>{t("employee")}:</span> <b>{viewingReturn.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>{t("item")}</th><th>{t("quantity")}</th><th>{t("price")}</th><th>{t("total")}</th></tr></thead>
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
              <div><span>{t("total")}:</span> <b>{money(viewingReturn.total)}</b></div>
              {viewingReturn.discount > 0 && <div><span>{t("discount")}:</span> <b>{money(viewingReturn.discount)}</b></div>}
              {viewingReturn.additional > 0 && <div><span>{t("additionalShort")}:</span> <b>{money(viewingReturn.additional)}</b></div>}
              <div className="inv-net"><span>{t("netTotal")}:</span> <b>{money(viewingReturn.total - viewingReturn.discount + viewingReturn.additional)}</b></div>
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

      {printSale && settings && (() => {
        let rp = "A4"; let logo = ""; let warranty = "";
        try { const raw = localStorage.getItem("tabarak_print_settings"); if (raw) { const ps = JSON.parse(raw); if (ps.receiptPrinter) rp = ps.receiptPrinter; if (ps.invoiceLogo) logo = ps.invoiceLogo; if (ps.warrantyText) warranty = ps.warrantyText; } } catch {}
        const isThermal = rp === "58mm" || rp === "80mm";
        return isThermal ? (
          <PrintThermal sale={printSale} settings={settings} printerType={rp as "58mm" | "80mm"} onClose={() => setPrintSale(null)} />
        ) : (
          <PrintInvoice sale={printSale} settings={settings} invoiceLogo={logo} warrantyText={warranty} onClose={() => setPrintSale(null)} />
        );
      })()}

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

      {activeAddonLine != null && (
        <Modal
          title={t("addOns")}
          onClose={() => setActiveAddonLine(null)}
          width="420px"
          closeOnOverlay={false}
        >
          {categoryProducts.length === 0 ? (
            <div style={{ padding: 16, textAlign: "center", color: "#999" }}>
              {t("noAddOns")}
            </div>
          ) : (
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              {categoryProducts.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid #eee",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    addAddon(activeAddonLine, p);
                    setActiveAddonLine(null);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {t("componentStock")}: {qty(p.quantity)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: "#0f8a5f" }}>
                    {money(p.sell_price)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
