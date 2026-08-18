import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  money,
  today,
  useToast,
} from "../components/ui";
import type { Expense } from "../types";

const CATEGORIES = [
  "إيجار",
  "رواتب",
  "كهرباء",
  "مياه",
  "انترنت",
  "صيانة",
  "فواتير حكومية",
  "أخرى",
];

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(today());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("أخرى");

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setExpenses(await api.listExpenses(search || undefined));
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      notify("المبلغ يجب أن يكون أكبر من صفر", "error");
      return;
    }
    try {
      await api.createExpense({
        date,
        description: description.trim(),
        amount,
        category,
      });
      notify("تم تسجيل المصروف");
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (x: Expense) => {
    if (!confirmDialog(`هل تريد حذف المصروف «${x.description}»؟`)) return;
    try {
      await api.deleteExpense(x.id);
      notify("تم حذف المصروف");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>المصروفات</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث في المصروفات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary" onClick={() => {
            setDate(today());
            setDescription("");
            setAmount(0);
            setCategory("أخرى");
            setShowForm(true);
          }}>
            + مصروف جديد
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>إجمالي المصروفات المعروضة: <b>{money(total)}</b></span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الوصف</th>
              <th>التصنيف</th>
              <th>المبلغ</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="empty">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  لا توجد مصروفات مسجلة.
                </td>
              </tr>
            )}
            {expenses.map((x) => (
              <tr key={x.id}>
                <td>{fmtDate(x.date)}</td>
                <td className="strong">{x.description}</td>
                <td>{x.category ?? "—"}</td>
                <td className="strong text-red">{money(x.amount)}</td>
                <td className="actions">
                  <button className="btn sm danger" onClick={() => remove(x)}>
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
          title="تسجيل مصروف جديد"
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="form-grid">
            <Field label="التاريخ">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="التصنيف">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الوصف *">
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="مثال: إيجار المحل"
              />
            </Field>
            <Field label="المبلغ *">
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ المصروف
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
    </div>
  );
}
