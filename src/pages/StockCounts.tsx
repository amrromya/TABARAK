import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Modal,
  confirmDialog,
  fmtDate,
  qty,
  signed,
  useToast,
} from "../components/ui";
import type { StockCount } from "../types";

export function StockCounts({
  onBack,
  onEditCount,
}: {
  onBack: () => void;
  onEditCount: (id: number) => void;
}) {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<StockCount | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCounts(await api.listStockCounts());
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const drafts = counts.filter((c) => c.status === "draft");
  const draftSurplus = drafts.reduce((s, c) => s + c.total_surplus, 0);
  const draftDeficit = drafts.reduce((s, c) => s + c.total_deficit, 0);
  const draftNet = drafts.reduce((s, c) => s + c.total_difference, 0);

  const openView = async (c: StockCount) => {
    try {
      setView(await api.getStockCount(c.id));
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const apply = async (c: StockCount) => {
    if (
      !confirmDialog(
        `تسوية الجرد رقم ${c.id}؟\nسيتم ضبط أرصدة المنتجات لتطابق الكميات العدّية بالنظام.`,
      )
    ) {
      return;
    }
    setBusyId(c.id);
    try {
      await api.applyStockCount(c.id);
      notify("تمت التسوية واعتماد الفروق في النظام");
      await load();
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  const del = async (c: StockCount) => {
    if (!confirmDialog(`حذف فاتورة الجرد رقم ${c.id}؟`)) return;
    setBusyId(c.id);
    try {
      await api.deleteStockCount(c.id);
      notify("تم حذف الفاتورة");
      await load();
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="pos">
      <header className="pos-head">
        <button className="btn" onClick={onBack}>
          → رجوع
        </button>
        <div className="pos-title">
          <h1>سجل فواتير الجرد</h1>
          <span>تسوية الفروق واعتمادها بالنظام</span>
        </div>
        <div className="pos-head-actions">
          <button className="btn pos-nav-btn" onClick={load} disabled={loading}>
            🔄
          </button>
        </div>
      </header>

      <div className="pos-body counts-body">
        <div className="toolbar-info">
          <span>
            عدد الفواتير: <b>{counts.length}</b>
          </span>
          <span>
            معلّقة (مسودة): <b>{drafts.length}</b>
          </span>
          <span>
            زيادة المسودة:{" "}
            <b
              className={`count-diff ${draftSurplus > 0 ? "pos" : ""}`}
              title={signed(draftSurplus)}
            >
              {signed(draftSurplus)}
            </b>
          </span>
          <span>
            عجز المسودة:{" "}
            <b
              className={`count-diff ${draftDeficit > 0 ? "neg" : ""}`}
              title={signed(-draftDeficit)}
            >
              {signed(-draftDeficit)}
            </b>
          </span>
          <span>
            صافي جرد المسودة:{" "}
            <b
              className={`count-diff ${
                draftNet > 0 ? "pos" : draftNet < 0 ? "neg" : ""
              }`}
              title={signed(draftNet)}
            >
              {signed(draftNet)}
            </b>
          </span>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>الأصناف</th>
                <th>صافي الفرق</th>
                <th>الحالة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="hint center">
                    جارٍ التحميل...
                  </td>
                </tr>
              ) : counts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hint center">
                    لا توجد فواتير جرد بعد
                  </td>
                </tr>
              ) : (
                counts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{fmtDate(c.date)}</td>
                    <td>{c.items_count}</td>
                    <td>
                      <span
                        className={`count-diff ${
                          c.total_difference > 0
                            ? "pos"
                            : c.total_difference < 0
                              ? "neg"
                              : ""
                        }`}
                        title={signed(c.total_difference)}
                      >
                        {signed(c.total_difference)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pay-badge ${
                          c.status === "applied" ? "credit" : "cash"
                        }`}
                      >
                        {c.status === "applied" ? "مطبّقة" : "مسودة"}
                      </span>
                    </td>
                    <td className="actions">
                      <button className="btn sm" onClick={() => openView(c)}>
                        عرض
                      </button>
                      {c.status === "draft" && (
                        <>
                          <button
                            className="btn sm"
                            onClick={() => onEditCount(c.id)}
                          >
                            تعديل
                          </button>
                          <button
                            className="btn sm primary"
                            disabled={busyId === c.id}
                            onClick={() => apply(c)}
                          >
                            تسوية
                          </button>
                          <button
                            className="btn sm danger"
                            disabled={busyId === c.id}
                            onClick={() => del(c)}
                          >
                            حذف
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {view && (
        <Modal
          title={`فاتورة الجرد رقم ${view.id} - ${fmtDate(view.date)}`}
          onClose={() => setView(null)}
        >
          <div className="toolbar-info">
            <span>
              صافي الفرق:{" "}
              <b
                className={`count-diff ${
                  view.total_difference > 0
                    ? "pos"
                    : view.total_difference < 0
                      ? "neg"
                      : ""
                }`}
                title={signed(view.total_difference)}
              >
                {signed(view.total_difference)}
              </b>
            </span>
            <span
              className={`pay-badge ${
                view.status === "applied" ? "credit" : "cash"
              }`}
            >
              {view.status === "applied" ? "مطبّقة" : "مسودة"}
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th>الرصيد بالنظام</th>
                  <th>الكمية الفعلية</th>
                  <th>الفرق</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((it) => (
                  <tr key={it.product_id}>
                    <td>{it.product_name}</td>
                    <td>{qty(it.system_qty)}</td>
                    <td>{qty(it.counted_qty)}</td>
                    <td>
                      <span
                        className={`count-diff ${
                          it.difference > 0
                            ? "pos"
                            : it.difference < 0
                              ? "neg"
                              : ""
                        }`}
                        title={signed(it.difference)}
                      >
                        {signed(it.difference)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
