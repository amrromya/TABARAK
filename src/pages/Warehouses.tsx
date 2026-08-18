import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Field, Modal, money, qty, useToast } from "../components/ui";
import type { Warehouse, WarehouseStats } from "../types";

interface Row {
  warehouse: Warehouse;
  stats: WarehouseStats | null;
}

export function Warehouses() {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [edit, setEdit] = useState<Warehouse | null>(null);
  const [editName, setEditName] = useState("");
  const notify = useToast();

  const load = useCallback(async () => {
    try {
      const ws = await api.listWarehouses();
      const rws = await Promise.all(
        ws.map(async (w) => ({
          warehouse: w,
          stats: await api.warehouseStats(w.id).catch(() => null),
        })),
      );
      setRows(rws);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) {
      notify("أدخل اسم المستودع", "error");
      return;
    }
    try {
      const w = await api.createWarehouse(name.trim());
      notify(
        w.is_default
          ? `تم إضافة المستودع "${w.name}" كافتراضي`
          : `تم إضافة المستودع "${w.name}"`,
      );
      setName("");
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    if (!editName.trim()) {
      notify("أدخل اسم المستودع", "error");
      return;
    }
    try {
      await api.updateWarehouse(edit.id, editName.trim());
      notify("تم تعديل المستودع");
      setEdit(null);
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const setDefault = async (id: number) => {
    try {
      await api.setDefaultWarehouse(id);
      notify("تم تعيين المستودع الافتراضي");
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (w: Warehouse) => {
    if (
      !window.confirm(
        `حذف المستودع "${w.name}"؟ المنتجات المرتبطة به ستبقى دون مستودع.`,
      )
    )
      return;
    try {
      await api.deleteWarehouse(w.id);
      notify("تم حذف المستودع");
      await load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>المستودعات</h1>
        <span className="date-badge">{rows.length} مستودع</span>
      </div>

      <div className="wh-row">
        <input
          placeholder="اسم المستودع الجديد..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button className="btn primary" onClick={add}>
          + إضافة مستودع
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="table-wrap">
          <p className="empty">
            لا توجد مستودعات بعد — أضف أول مستودع ليكون افتراضيًا.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>المستودع</th>
                <th>الكمية</th>
                <th>قيمة المخزون</th>
                <th>الحالة</th>
                <th style={{ width: 240 }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ warehouse: w, stats }) => (
                <tr key={w.id}>
                  <td className="strong">{w.name}</td>
                  <td>{qty(stats?.quantity ?? 0)}</td>
                  <td>{money(stats?.value ?? 0)}</td>
                  <td>
                    {w.is_default ? (
                      <span className="pay-badge cash">⭐ المستودع الافتراضي</span>
                    ) : (
                      <span className="pay-badge credit">عادي</span>
                    )}
                  </td>
                  <td>
                    <div className="actions">
                      {!w.is_default && (
                        <button
                          className="btn sm"
                          onClick={() => setDefault(w.id)}
                          title="جعله الافتراضي للبيع والشراء"
                        >
                          ⭐ تعيين افتراضي
                        </button>
                      )}
                      <button
                        className="btn sm"
                        onClick={() => {
                          setEdit(w);
                          setEditName(w.name);
                        }}
                      >
                        ✏️ تعديل
                      </button>
                      <button className="btn sm danger" onClick={() => remove(w)}>
                        🗑️ حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="settings-note">
        المستودع الافتراضي يُحدد تلقائيًا كاختيار مبدئي في فواتير البيع والشراء،
        ويمكن تغييره يدويًا في كل فاتورة.
      </p>

      {edit && (
        <Modal title="تعديل المستودع" onClose={() => setEdit(null)} width="400px">
          <Field label="اسم المستودع *">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
              }}
            />
          </Field>
          <div className="modal-actions">
            <button className="btn" onClick={() => setEdit(null)}>
              إلغاء
            </button>
            <button className="btn primary" onClick={saveEdit}>
              💾 حفظ
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
