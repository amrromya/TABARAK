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
}: {
  onOpenCount?: () => void;
  onOpenCounts?: () => void;
  onOpenFullCount?: () => void;
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
        notify("تم تعديل المنتج");
      } else {
        await api.createProduct(form);
        notify("تمت إضافة المنتج");
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (p: Product) => {
    if (!confirmDialog(`هل تريد حذف المنتج «${p.name}»؟`)) return;
    try {
      await api.deleteProduct(p.id);
      notify("تم حذف المنتج");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
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
      notify("تمت إضافة التصنيف");
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
        <h1>المخزون والمنتجات</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث بالاسم أو الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn" onClick={onOpenCount}>
            📋 فاتورة جرد مؤقت
          </button>
          <button className="btn" onClick={onOpenCounts}>
            🔎 سجل الجرد
          </button>
          <button className="btn accent" onClick={onOpenFullCount}>
            📊 جرد كلي
          </button>
          <button className="btn primary" onClick={openNew}>
            + منتج جديد
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>عدد المنتجات: <b>{products.length}</b></span>
        <span>قيمة المخزون (سعر الشراء): <b>{money(totalValue)}</b></span>
      </div>

      <div className="table-wrap">
        <table className="table inv-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>التصنيف</th>
              <th>الباركود</th>
              <th>الوحدة</th>
              <th>سعر الشراء</th>
              <th>سعر البيع</th>
              <th>الكمية</th>
              <th>حد الطلب</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="empty">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  لا توجد منتجات. أضف أول منتج الآن.
                </td>
              </tr>
            )}
            {products.map((p) => {
              const low = p.quantity <= p.min_quantity;
              return (
                <tr
                  key={p.id}
                  className={low ? "row-low" : ""}
                  title="انقر مرتين لفتح كرت المنتج"
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
                      تعديل
                    </button>
                    <button
                      className="btn sm danger"
                      onClick={() => remove(p)}
                    >
                      حذف
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
          title={editing ? "تعديل منتج" : "إضافة منتج جديد"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form-grid">
            <Field label="اسم المنتج *">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="الباركود (تلقائي — يمكن تعديله)">
              <input
                value={form.barcode ?? ""}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </Field>
            <Field label="التصنيف">
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
                  <option value="">بدون تصنيف</option>
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
            <Field label="الوحدة">
              <select
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                <option value="قطعة">قطعة</option>
                <option value="كرتونة">كرتونة</option>
                <option value="كيلو">كيلو</option>
                <option value="لتر">لتر</option>
                <option value="علبة">علبة</option>
                <option value="شنطة">شنطة</option>
              </select>
            </Field>
            <Field label="سعر الشراء *">
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
            <Field label="سعر البيع *">
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
            <Field label="الكمية الافتتاحية">
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
            <Field label="حد الطلب الأدنى">
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
                {editing ? "حفظ التعديلات" : "إضافة"}
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

      {showCategory && (
        <Modal
          title="إضافة تصنيف جديد"
          onClose={() => setShowCategory(false)}
        >
          <form onSubmit={addCategory} className="form-grid">
            <Field label="اسم التصنيف *">
              <input
                required
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                إضافة
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowCategory(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
