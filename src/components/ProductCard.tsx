import { useState } from "react";
import { api } from "../api";
import { Field, Modal, qty, useToast } from "./ui";
import type { Category, Product, Warehouse } from "../types";

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
    warehouse: product.warehouse_id != null ? String(product.warehouse_id) : "",
    unit: product.unit ?? "",
    cost_price: product.cost_price,
    sell_price: product.sell_price,
    min_quantity: product.min_quantity,
  });
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  const save = async () => {
    if (!form.name.trim()) {
      notify("أدخل اسم الصنف", "error");
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
      const updated = await api.updateProduct(product.id, {
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        category_id: categoryId,
        warehouse_id: form.warehouse ? Number(form.warehouse) : null,
        unit: form.unit.trim() || null,
        cost_price: form.cost_price,
        sell_price: form.sell_price,
        quantity: product.quantity,
        min_quantity: form.min_quantity,
      });
      notify(`تم تحديث الصنف "${updated.name}"`);
      onSaved?.(updated);
      onClose();
    } catch (err) {
      notify(String(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`🏷️ بيانات الصنف: ${product.name}`}
      onClose={onClose}
      width="460px"
    >
      <div className="modal-grid">
        <Field label="اسم الصنف *">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
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
            value={form.cost_price}
            onChange={(e) =>
              setForm((f) => ({ ...f, cost_price: Number(e.target.value) }))
            }
          />
        </Field>
        <Field label="سعر البيع">
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.sell_price}
            onChange={(e) =>
              setForm((f) => ({ ...f, sell_price: Number(e.target.value) }))
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
              setForm((f) => ({ ...f, min_quantity: Number(e.target.value) }))
            }
          />
        </Field>
        <Field label="الكمية الحالية">
          <input value={qty(product.quantity)} disabled />
        </Field>
      </div>
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
