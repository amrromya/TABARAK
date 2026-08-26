import { useEffect, useState } from "react";
import { api } from "../api";
import { Field, Modal, qty, useToast } from "./ui";
import { t } from "../i18n";
import type {
  Category,
  NewProductComponent,
  Product,
  ProductComponent,
  Warehouse,
} from "../types";

export function ProductCard({
  product,
  categories,
  warehouses = [],
  onClose,
  onSaved,
}: {
  product: Product;
  categories: Category[];
  warehouses?: Warehouse[];
  onClose: () => void;
  onSaved?: (p: Product) => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    barcode: product.barcode ?? "",
    category: product.category_name ?? "",
    warehouse:
      product.warehouse_id != null ? String(product.warehouse_id) : "",
    unit: product.unit ?? "",
    cost_price: product.cost_price,
    sell_price: product.sell_price,
    min_quantity: product.min_quantity,
  });
  const [saving, setSaving] = useState(false);
  const [isComposite, setIsComposite] = useState(false);
  const [components, setComponents] = useState<ProductComponent[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [compProductId, setCompProductId] = useState("");
  const [compQty, setCompQty] = useState(1);
  const notify = useToast();

  useEffect(() => {
    api
      .getProductComponents(product.id)
      .then((cs) => {
        if (cs.length > 0) {
          setIsComposite(true);
          setComponents(cs);
        }
      })
      .catch(() => {});
    api.listProducts().then(setAllProducts).catch(() => {});
  }, [product.id]);

  const addComponent = () => {
    const pid = Number(compProductId);
    if (!pid) return;
    if (compQty <= 0) {
      notify(t("requiredComponents"), "error");
      return;
    }
    if (components.some((c) => c.component_product_id === pid)) {
      notify("المكون موجود بالفعل", "error");
      return;
    }
    const p = allProducts.find((x) => x.id === pid);
    if (!p) return;
    setComponents((prev) => [
      ...prev,
      {
        id: 0,
        composite_product_id: product.id,
        component_product_id: pid,
        component_name: p.name,
        component_unit: p.unit,
        component_quantity: p.quantity,
        quantity_per_unit: compQty,
      },
    ]);
    setCompProductId("");
    setCompQty(1);
  };

  const removeComponent = (componentProductId: number) => {
    setComponents((prev) =>
      prev.filter((c) => c.component_product_id !== componentProductId),
    );
  };

  const save = async () => {
    if (!form.name.trim()) {
      notify("أدخل اسم الصنف", "error");
      return;
    }
    if (isComposite && components.length === 0) {
      notify(t("requiredComponents"), "error");
      return;
    }
    setSaving(true);
    try {
      let categoryId: number | null = product.category_id;
      const catName = form.category.trim();
      if (catName) {
        const existing = categories.find(
          (c) => c.name.toLowerCase() === catName.toLowerCase(),
        );
        if (existing) {
          categoryId = existing.id;
        } else {
          const nc = await api.createCategory(catName);
          categoryId = nc.id;
        }
      } else {
        categoryId = null;
      }
      const computedCost = isComposite
        ? components.reduce(
            (sum, c) =>
              sum +
              c.quantity_per_unit *
                (allProducts.find((p) => p.id === c.component_product_id)
                  ?.cost_price ?? 0),
            0,
          )
        : form.cost_price;
      const updated = await api.updateProduct(product.id, {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        category_id: categoryId,
        warehouse_id: form.warehouse ? Number(form.warehouse) : null,
        unit: form.unit.trim() || null,
        cost_price: computedCost,
        sell_price: form.sell_price,
        quantity: product.quantity,
        min_quantity: form.min_quantity,
      });
      if (isComposite) {
        const input: NewProductComponent[] = components.map((c) => ({
          component_product_id: c.component_product_id,
          quantity_per_unit: c.quantity_per_unit,
        }));
        await api.saveProductComponents(product.id, input);
      } else {
        await api.saveProductComponents(product.id, []);
      }
      notify(`تم تحديث الصنف "${updated.name}"`);
      onSaved?.(updated);
      onClose();
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const availableProducts = allProducts.filter(
    (p) =>
      p.id !== product.id &&
      !components.some((c) => c.component_product_id === p.id),
  );

  return (
    <Modal
      title={`🏷️ بيانات الصنف: ${product.name}`}
      onClose={onClose}
      width="520px"
    >
      <div className="modal-grid">
        <Field label="اسم الصنف *">
          <input
            autoFocus
            value={form.name}
            onChange={(e) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
          />
        </Field>
        <Field label="الباركود">
          <input
            value={form.barcode}
            onChange={(e) =>
              setForm((f) => ({ ...f, barcode: e.target.value }))
            }
          />
        </Field>
        <Field label="التصنيف (اكتب اسمًا جديدًا أو اختر)">
          <input
            list="product-card-categories"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          />
          <datalist id="product-card-categories">
            {categories.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </Field>
        <Field label="الوحدة">
          <input
            value={form.unit}
            placeholder="قطعة، كجم، علبة..."
            onChange={(e) =>
              setForm((f) => ({ ...f, unit: e.target.value }))
            }
          />
        </Field>
        <Field label="المستودع">
          <select
            value={form.warehouse}
            onChange={(e) =>
              setForm((f) => ({ ...f, warehouse: e.target.value }))
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
            value={isComposite
              ? components.reduce(
                  (s, c) =>
                    s +
                    c.quantity_per_unit *
                      (allProducts.find(
                        (p) => p.id === c.component_product_id,
                      )?.cost_price ?? 0),
                  0,
                ).toFixed(2)
              : form.cost_price}
            disabled={isComposite}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                cost_price: Number(e.target.value),
              }))
            }
          />
          {isComposite && (
            <small style={{ color: "#888", fontSize: 11 }}>
              {t("compositeProductDesc")}
            </small>
          )}
        </Field>
        <Field label="سعر البيع">
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.sell_price}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                sell_price: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="حد التنبيه">
          <input
            type="number"
            min={0}
            step="1"
            value={form.min_quantity}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                min_quantity: Number(e.target.value),
              }))
            }
          />
        </Field>
        <Field label="الكمية الحالية">
          <input value={qty(product.quantity)} disabled />
        </Field>
      </div>

      {/* Composite Product Toggle */}
      <div style={{ margin: "12px 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          id="is-composite"
          checked={isComposite}
          onChange={(e) => {
            setIsComposite(e.target.checked);
            if (!e.target.checked) setComponents([]);
          }}
          style={{ width: 18, height: 18 }}
        />
        <label htmlFor="is-composite" style={{ fontWeight: 600, cursor: "pointer" }}>
          {t("compositeProduct")}
        </label>
      </div>
      {isComposite && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginTop: 4,
            background: "#fafafa",
          }}
        >
          <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>
            {t("components")}
          </div>
          {components.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                marginBottom: 8,
              }}
            >
              <thead>
                <tr style={{ borderBottom: "1px solid #ddd" }}>
                  <th style={{ textAlign: "right", padding: "4px 0" }}>
                    {t("componentName")}
                  </th>
                  <th style={{ textAlign: "center", padding: "4px 0", width: 80 }}>
                    {t("quantityPerUnit")}
                  </th>
                  <th style={{ textAlign: "center", padding: "4px 0", width: 70 }}>
                    {t("componentStock")}
                  </th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => (
                  <tr
                    key={c.component_product_id}
                    style={{ borderBottom: "1px solid #eee" }}
                  >
                    <td style={{ padding: "4px 0" }}>
                      {c.component_name}
                      {c.component_unit ? ` (${c.component_unit})` : ""}
                    </td>
                    <td style={{ textAlign: "center", padding: "4px 0" }}>
                      {c.quantity_per_unit}
                    </td>
                    <td style={{ textAlign: "center", padding: "4px 0" }}>
                      {qty(c.component_quantity)}
                    </td>
                    <td>
                      <button
                        className="btn sm"
                        onClick={() =>
                          removeComponent(c.component_product_id)
                        }
                        style={{ padding: "2px 6px", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {components.length === 0 && (
            <div style={{ color: "#999", fontSize: 13, marginBottom: 8 }}>
              {t("noComponents")}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                {t("selectComponent")}
              </label>
              <select
                value={compProductId}
                onChange={(e) => setCompProductId(e.target.value)}
                style={{ width: "100%", padding: "4px 6px", fontSize: 13 }}
              >
                <option value="">— {t("selectComponent")} —</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unit ?? "-"}) — {t("componentStock")}:{" "}
                    {qty(p.quantity)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 80 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>
                {t("quantityPerUnit")}
              </label>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={compQty}
                onChange={(e) => setCompQty(Number(e.target.value))}
                style={{ width: "100%", padding: "4px 6px", fontSize: 13 }}
              />
            </div>
            <button
              className="btn sm"
              onClick={addComponent}
              style={{ marginBottom: 0, height: 30 }}
            >
              + {t("addComponent")}
            </button>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#888" }}>
            ℹ️ {t("componentsInfo")}
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn" onClick={onClose}>
          إلغاء
        </button>
        <button
          className="btn primary"
          onClick={save}
          disabled={saving}
        >
          💾 حفظ التعديلات
        </button>
      </div>
    </Modal>
  );
}
