import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Field,
  Modal,
  confirmDialog,
  money,
  qty,
  useToast,
} from "../components/ui";
import { t } from "../i18n";
import { ProductMovements } from "../components/ProductMovements";
import type { Category, NewProduct, Product } from "../types";

const emptyForm: NewProduct = {
  name: "",
  barcode: "",
  category_id: null,
  unit: "قطعة",
  cost_price: 0,
  sell_price: 0,
  quantity: 0,
  min_quantity: 0,
};

export function Inventory({
  onOpenCount,
  onOpenCounts,
  onOpenFullCount,
  onNavigate,
}: {
  onOpenCount?: () => void;
  onOpenCounts?: () => void;
  onOpenFullCount?: () => void;
  onNavigate?: (page: string) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<NewProduct>(emptyForm);

  const [showCategory, setShowCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, c] = await Promise.all([
        api.listProducts(search || undefined),
        api.listCategories(),
      ]);
      setProducts(p);
      setCategories(c);
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
    setEditing(null);
    let bc = "";
    try {
      bc = await api.nextBarcode();
    } catch {
      bc = "";
    }
    setForm({ ...emptyForm, barcode: bc });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      barcode: p.barcode ?? "",
      category_id: p.category_id,
      unit: p.unit ?? "",
      cost_price: p.cost_price,
      sell_price: p.sell_price,
      quantity: p.quantity,
      min_quantity: p.min_quantity,
    });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updateProduct(editing.id, form);
        notify(t("productUpdated"));
      } else {
        await api.createProduct(form);
        notify(t("productAdded"));
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (p: Product) => {
    if (!confirmDialog(t("confirmDeleteProduct").replace("{name}", p.name))) return;
    try {
      await api.deleteProduct(p.id);
      notify(t("productDeleted"));
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const printBarcode = async (p: Product) => {
    let ps: any = { barcodePrinter: "", barcodeWidth: 50, barcodeHeight: 25, barcodeFontSize: 10, barcodeShowName: true, barcodeShowPrice: true, barcodeShowBarcode: true, barcodeShowStoreName: true };
    try { const raw = localStorage.getItem("tabarak_print_settings"); if (raw) ps = { ...ps, ...JSON.parse(raw) }; } catch {}
    let storeName = "";
    try { const settings = await api.getSettings(); storeName = settings.store_name || ""; } catch {}
    const showStore = ps.barcodeShowStoreName !== false && storeName;
    const barcodeValue = p.barcode || String(p.id);
    const storeLineH = showStore ? 10 : 0;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        @page{size:${ps.barcodeWidth}mm ${ps.barcodeHeight + storeLineH + (ps.barcodeShowName ? 12 : 0) + (ps.barcodeShowPrice ? 8 : 0)}mm;margin:0}
        body{margin:0;padding:4px;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center}
        .box{display:flex;flex-direction:column;align-items:center;gap:2px}
        .store{font-size:${ps.barcodeFontSize + 1}px;font-weight:600;color:#333}
        .name{font-size:${ps.barcodeFontSize + 2}px;font-weight:700}
        .code{font-size:9px;color:#666;letter-spacing:1px}
        .price{font-size:${ps.barcodeFontSize}px;font-weight:700;color:#0f8a5f}
      </style></head><body>
      <div class="box">
        ${showStore ? `<div class="store">${storeName}</div>` : ""}
        ${ps.barcodeShowName ? `<div class="name">${p.name}</div>` : ""}
        <svg id="bc"></svg>
        ${ps.barcodeShowBarcode ? `<div class="code">${barcodeValue}</div>` : ""}
        ${ps.barcodeShowPrice ? `<div class="price">${p.sell_price.toFixed(2)} ج.م</div>` : ""}
      </div>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js"><\/script>
      <script>
        try {
          JsBarcode("#bc", "${barcodeValue}", {
            format: "CODE128",
            width: ${Math.max(1, Math.floor(ps.barcodeWidth / 30))},
            height: ${Math.min(ps.barcodeHeight * 2, 60)},
            displayValue: false,
            margin: 0
          });
          setTimeout(function(){
            var pf = window.print;
            ${ps.barcodePrinter ? `window.print = function(){
              var iframe = document.createElement("iframe");
              iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
              document.body.appendChild(iframe);
              var idoc = iframe.contentDocument || iframe.contentWindow.document;
              idoc.open();
              idoc.write(document.documentElement.outerHTML);
              idoc.close();
              setTimeout(function(){ iframe.contentWindow.print(); }, 200);
            };` : ""}
            window.print();
            window.print = pf;
          }, 400);
        } catch(e) { alert("${t("barcodeError")}" + e.message); }
      <\/script>
    </body></html>`);
    doc.close();
    setTimeout(() => document.body.removeChild(frame), 3000);
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) return;
    try {
      const c = await api.createCategory(newCategory.trim());
      setForm((f) => ({ ...f, category_id: c.id }));
      setNewCategory("");
      setShowCategory(false);
      setCategories(await api.listCategories());
      notify(t("categoryAdded"));
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const totalValue = products.reduce(
    (s, p) => s + p.quantity * p.cost_price,
    0,
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("inventoryTitle")}</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder={t("searchNameOrBarcode")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn" onClick={onOpenCount}>
            📋 {t("temporaryInventoryCount")}
          </button>
          <button className="btn" onClick={onOpenCounts}>
            🔎 {t("stockCounts")}
          </button>
          <button className="btn accent" onClick={onOpenFullCount}>
            📊 {t("fullInventoryCount")}
          </button>
          <button className="btn primary" onClick={openNew}>
            + {t("newProduct")}
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>{t("productCount")} <b>{products.length}</b></span>
        <span>{t("inventoryValueCost")} <b>{money(totalValue)}</b></span>
      </div>

      <div className="table-wrap">
        <table className="table inv-table">
          <thead>
            <tr>
              <th>{t("name")}</th>
              <th>{t("category")}</th>
              <th>{t("barcode")}</th>
              <th>{t("unit")}</th>
              <th>{t("costPrice")}</th>
              <th>{t("sellPrice")}</th>
              <th>{t("quantity")}</th>
              <th>{t("minQuantity")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="empty">{t("loading")}</td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  {t("noProductsAddFirst")}
                </td>
              </tr>
            )}
            {products.map((p) => {
              const low = p.quantity <= p.min_quantity;
              return (
                <tr
                  key={p.id}
                  className={low ? "row-low" : ""}
                  title={t("doubleClickHint")}
                  onDoubleClick={() => openEdit(p)}
                >
                  <td className="strong">{p.name}</td>
                  <td>{p.category_name ?? "—"}</td>
                  <td>{p.barcode ?? "—"}</td>
                  <td>{p.unit ?? "—"}</td>
                  <td>{money(p.cost_price)}</td>
                  <td className="strong">{money(p.sell_price)}</td>
                  <td className={low ? "text-warn strong" : "strong"}>
                    {qty(p.quantity)} {low && "⚠️"}
                  </td>
                  <td>{qty(p.min_quantity)}</td>
                  <td className="actions">
                    <button className="btn sm" onClick={() => openEdit(p)}>
                      {t("edit")}
                    </button>
                    <button className="btn sm" onClick={() => setMovementProduct(p)}>
                      📊 {t("productMovement")}
                    </button>
                    <button className="btn sm" onClick={() => printBarcode(p)}>
                      🏷️ {t("printBarcode")}
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => remove(p)}
                    >
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? t("editProduct") : t("addNewProduct")}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form-grid">
            <Field label={t("productName") + " *"}>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label={t("barcodeAuto")}>
              <input
                value={form.barcode ?? ""}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </Field>
            <Field label={t("category")}>
              <div className="select-row">
                <select
                  value={form.category_id ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      category_id: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                >
                  <option value="">{t("noCategory")}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => setShowCategory(true)}
                >
                  +
                </button>
              </div>
            </Field>
            <Field label={t("unit")}>
              <select
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="قطعة">{t("unitPiece")}</option>
                <option value="كرتونة">{t("unitCarton")}</option>
                <option value="كيلو">{t("unitKilo")}</option>
                <option value="لتر">{t("unitLiter")}</option>
                <option value="علبة">{t("unitBox")}</option>
                <option value="شنطة">{t("unitBag")}</option>
              </select>
            </Field>
            <Field label={t("costPrice") + " *"}>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.cost_price}
                onChange={(e) =>
                  setForm({ ...form, cost_price: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t("sellPrice") + " *"}>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={form.sell_price}
                onChange={(e) =>
                  setForm({ ...form, sell_price: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t("openingQuantity")}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: Number(e.target.value) })
                }
              />
            </Field>
            <Field label={t("minQuantity")}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.min_quantity}
                onChange={(e) =>
                  setForm({ ...form, min_quantity: Number(e.target.value) })
                }
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {editing ? t("saveChanges") : t("add")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showCategory && (
        <Modal
          title={t("addNewCategory")}
          onClose={() => setShowCategory(false)}
        >
          <form onSubmit={addCategory} className="form-grid">
            <Field label={t("categoryNameLabel") + " *"}>
              <input
                required
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                {t("add")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowCategory(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {movementProduct && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setMovementProduct(null)}
          onViewInvoice={(m) => {
            setMovementProduct(null);
            if (m.type === "sale" || m.type === "sale_return") {
              onNavigate?.("sales");
            } else if (m.type === "purchase" || m.type === "purchase_return") {
              onNavigate?.("purchases");
            } else if (m.type === "maintenance") {
              onNavigate?.("maintenance");
            }
          }}
        />
      )}
    </div>
  );
}
