import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Modal, confirmDialog, fmtDate, qty, signed, useToast } from "../components/ui";
import { t } from "../i18n";
import type { StockCount } from "../types";

export function StockCounts({ onBack, onEditCount }: { onBack: () => void; onEditCount: (id: number) => void }) {
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<StockCount | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "applied">("all");
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try { setCounts(await api.listStockCounts()); } catch (e) { notify(String(e), "error"); } finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const drafts = counts.filter((c) => c.status === "draft");
  const applied = counts.filter((c) => c.status === "applied");
  const draftSurplus = drafts.reduce((s, c) => s + c.total_surplus, 0);
  const draftDeficit = drafts.reduce((s, c) => s + c.total_deficit, 0);
  const draftNet = draftSurplus - draftDeficit;

  const filtered = useMemo(() => {
    let list = counts;
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => String(c.id).includes(q) || c.date.includes(q) || (c.notes ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [counts, search, statusFilter]);

  const openView = async (c: StockCount) => {
    try { setView(await api.getStockCount(c.id)); } catch (e) { notify(String(e), "error"); }
  };

  const apply = async (c: StockCount) => {
    if (!confirmDialog(`${t("settleConfirm")} ${c.id}؟\nسيتم ضبط أرصدة المنتجات لتطابق الكميات العدّية بالنظام.`)) return;
    setBusyId(c.id);
    try { await api.applyStockCount(c.id); notify(t("settleSuccess")); await load(); } catch (e) { notify(String(e), "error"); } finally { setBusyId(null); }
  };

  const del = async (c: StockCount) => {
    if (!confirmDialog(`${t("confirmDeleteCount")} ${c.id}؟`)) return;
    setBusyId(c.id);
    try { await api.deleteStockCount(c.id); notify(t("countDeleted")); await load(); } catch (e) { notify(String(e), "error"); } finally { setBusyId(null); }
  };

  const statusConfig = (s: string) => s === "draft"
    ? { label: t("draftStatus"), cls: "scr-st-draft", dot: "scr-dot-draft" }
    : { label: t("appliedLabel"), cls: "scr-st-applied", dot: "scr-dot-applied" };

  const netColor = (c: StockCount) => {
    const v = c.total_surplus - c.total_deficit;
    return v > 0 ? "scr-val-pos" : v < 0 ? "scr-val-neg" : "scr-val-zero";
  };

  return (
    <div className="scr-page">
      <header className="scr-hdr">
        <div className="scr-hdr-l">
          <button className="scr-hdr-back" onClick={onBack}>→</button>
          <div>
            <h1 className="scr-hdr-title">{t("stockCountsTitle")}</h1>
            <p className="scr-hdr-sub">{counts.length} فاتورة جرد — {drafts.length} مسودة معلقة — {applied.length} مرحلة</p>
          </div>
        </div>
        <button className="scr-hdr-btn" onClick={load} disabled={loading}>{loading ? "⏳" : "🔄"} تحديث</button>
      </header>

      <div className="scr-kpis">
        <div className="scr-kpi blue">
          <div className="scr-kpi-bg">📦</div>
          <div className="scr-kpi-n">{counts.length}</div>
          <div className="scr-kpi-l">{t("invoiceCount")}</div>
        </div>
        <div className="scr-kpi amber">
          <div className="scr-kpi-bg">⏳</div>
          <div className="scr-kpi-n">{drafts.length}</div>
          <div className="scr-kpi-l">{t("pendingDrafts")}</div>
        </div>
        <div className="scr-kpi green">
          <div className="scr-kpi-bg">📈</div>
          <div className="scr-kpi-n">{signed(draftSurplus)}</div>
          <div className="scr-kpi-l">{t("draftSurplus")}</div>
        </div>
        <div className="scr-kpi red">
          <div className="scr-kpi-bg">📉</div>
          <div className="scr-kpi-n">{signed(-draftDeficit)}</div>
          <div className="scr-kpi-l">{t("draftDeficit")}</div>
        </div>
        <div className={`scr-kpi ${draftNet > 0 ? "green" : draftNet < 0 ? "red" : "gray"}`}>
          <div className="scr-kpi-bg">⚖️</div>
          <div className="scr-kpi-n">{signed(draftNet)}</div>
          <div className="scr-kpi-l">{t("draftNet")}</div>
        </div>
      </div>

      <div className="scr-toolbar2">
        <div className="scr-search2">
          <span>🔍</span>
          <input placeholder="بحث برقم الفاتورة أو التاريخ..." value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")}>✕</button>}
        </div>
        <div className="scr-tabs2">
          {[
            { k: "all", l: "الكل", n: counts.length, c: "tab-all" },
            { k: "draft", l: "مسودة", n: drafts.length, c: "tab-draft" },
            { k: "applied", l: "مرحلة", n: applied.length, c: "tab-applied" },
          ].map((tab) => (
            <button key={tab.k} className={`scr-tab2 ${tab.c} ${statusFilter === tab.k ? "active" : ""}`} onClick={() => setStatusFilter(tab.k as never)}>
              <span className="scr-tab2-dot" />
              {tab.l} <span className="scr-tab2-n">{tab.n}</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="scr-loading">
          <div className="scr-loading-spinner" />
          <p>جاري تحميل سجلات الجرد...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="scr-empty-box">
          <div className="scr-empty-emoji">{search || statusFilter !== "all" ? "🔍" : "📭"}</div>
          <h3>{search || statusFilter !== "all" ? "لا توجد نتائج مطابقة" : t("noStockCounts")}</h3>
          <p>{search || statusFilter !== "all" ? "جرّب تغيير معايير البحث أو الفلتر" : "لم تُنشأ أي فاتورة جرد بعد. ابدأ بإنشاء فاتورة من صفحة المخزون."}</p>
          {(search || statusFilter !== "all") && <button className="scr-reset-btn" onClick={() => { setSearch(""); setStatusFilter("all"); }}>مسح الفلترة</button>}
        </div>
      ) : (
        <div className="scr-cards">
          {filtered.map((c) => {
            const isDraft = c.status === "draft";
            const net = c.total_surplus - c.total_deficit;
            const st = statusConfig(c.status);
            return (
              <div key={c.id} className={`scr-card ${isDraft ? "card-draft" : "card-applied"}`}>
                <div className="scr-card-top">
                  <div className="scr-card-id">#{c.id}</div>
                  <div className={`scr-card-status ${st.cls}`}><span className={st.dot} />{st.label}</div>
                </div>
                <div className="scr-card-date">📅 {fmtDate(c.date)}</div>
                <div className="scr-card-items">{c.items_count} صنف مُجرّد</div>
                <div className="scr-card-vals">
                  <div className="scr-card-val">
                    <span className="scr-card-val-l">زيادة</span>
                    <span className="scr-val-pos">{signed(c.total_surplus)}</span>
                  </div>
                  <div className="scr-card-val">
                    <span className="scr-card-val-l">عجز</span>
                    <span className="scr-val-neg">{signed(-c.total_deficit)}</span>
                  </div>
                  <div className="scr-card-val">
                    <span className="scr-card-val-l">صافي</span>
                    <span className={netColor(c)}>{signed(net)}</span>
                  </div>
                </div>
                {c.notes && <div className="scr-card-notes">📝 {c.notes}</div>}
                <div className="scr-card-actions">
                  <button className="scr-cbtn scr-cbtn-view" onClick={() => openView(c)}>👁️ تفاصيل</button>
                  {isDraft && (
                    <>
                      <button className="scr-cbtn scr-cbtn-edit" onClick={() => onEditCount(c.id)}>✏️ تعديل</button>
                      <button className="scr-cbtn scr-cbtn-apply" disabled={busyId === c.id} onClick={() => apply(c)}>{busyId === c.id ? "⏳" : "✅"} ترحيل</button>
                      <button className="scr-cbtn scr-cbtn-del" disabled={busyId === c.id} onClick={() => del(c)}>🗑️</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view && (() => {
        const vNet = view.total_surplus - view.total_deficit;
        const vPosCount = view.items.filter((i) => i.difference > 0).length;
        const vNegCount = view.items.filter((i) => i.difference < 0).length;
        const vZeroCount = view.items.filter((i) => i.difference === 0).length;
        const vIsDraft = view.status === "draft";
        return (
        <Modal title="" onClose={() => setView(null)}>
          <div className="dvm">
            {/* Header */}
            <div className={`dvm-header ${vNet > 0 ? "dvm-h-pos" : vNet < 0 ? "dvm-h-neg" : "dvm-h-zero"}`}>
              <div className="dvm-h-top">
                <div>
                  <h2 className="dvm-h-title">فاتورة جرد #{view.id}</h2>
                  <div className="dvm-h-date">📅 {fmtDate(view.date)}{view.notes && <span className="dvm-h-note"> • {view.notes}</span>}</div>
                </div>
                <div className={`dvm-h-badge ${vIsDraft ? "dvm-badge-draft" : "dvm-badge-applied"}`}>
                  <span className={`dvm-h-dot ${vIsDraft ? "dot-amber" : "dot-green"}`} />
                  {vIsDraft ? t("draftStatus") : t("appliedLabel")}
                </div>
              </div>
              <div className="dvm-h-net">
                <span className="dvm-h-net-label">صافي الفرق</span>
                <span className={`dvm-h-net-val ${vNet > 0 ? "val-pos" : vNet < 0 ? "val-neg" : "val-zero"}`}>{signed(vNet)}</span>
              </div>
            </div>

            {/* Summary cards */}
            <div className="dvm-summary">
              <div className="dvm-sum-card dvm-sum-total">
                <div className="dvm-sum-icon">📦</div>
                <div className="dvm-sum-body">
                  <div className="dvm-sum-n">{view.items.length}</div>
                  <div className="dvm-sum-l">إجمالي الأصناف</div>
                </div>
              </div>
              <div className="dvm-sum-card dvm-sum-green">
                <div className="dvm-sum-icon">📈</div>
                <div className="dvm-sum-body">
                  <div className="dvm-sum-n">{vPosCount}</div>
                  <div className="dvm-sum-l">زيادة ({signed(view.total_surplus)})</div>
                </div>
              </div>
              <div className="dvm-sum-card dvm-sum-red">
                <div className="dvm-sum-icon">📉</div>
                <div className="dvm-sum-body">
                  <div className="dvm-sum-n">{vNegCount}</div>
                  <div className="dvm-sum-l">عجز ({signed(-view.total_deficit)})</div>
                </div>
              </div>
              <div className="dvm-sum-card dvm-sum-gray">
                <div className="dvm-sum-icon">✓</div>
                <div className="dvm-sum-body">
                  <div className="dvm-sum-n">{vZeroCount}</div>
                  <div className="dvm-sum-l">مطابق</div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="dvm-progress">
              <div className="dvm-progress-bar">
                {view.items.length > 0 && (
                  <>
                    <div className="dvm-pb-pos" style={{ width: `${(vPosCount / view.items.length) * 100}%` }} />
                    <div className="dvm-pb-neg" style={{ width: `${(vNegCount / view.items.length) * 100}%` }} />
                    <div className="dvm-pb-zero" style={{ width: `${(vZeroCount / view.items.length) * 100}%` }} />
                  </>
                )}
              </div>
              <div className="dvm-progress-labels">
                <span className="dvm-pl"><span className="dvm-pl-dot pos" /> زيادة {vPosCount}</span>
                <span className="dvm-pl"><span className="dvm-pl-dot neg" /> عجز {vNegCount}</span>
                <span className="dvm-pl"><span className="dvm-pl-dot zero" /> مطابق {vZeroCount}</span>
              </div>
            </div>

            {/* Table */}
            <div className="dvm-table-wrap">
              <table className="dvm-tbl">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    <th>المنتج</th>
                    <th style={{ width: 100 }}>النظام</th>
                    <th style={{ width: 100 }}>فعلي</th>
                    <th style={{ width: 110 }}>الفرق</th>
                  </tr>
                </thead>
                <tbody>
                  {view.items.map((it, idx) => {
                    const isPos = it.difference > 0;
                    const isNeg = it.difference < 0;
                    return (
                      <tr key={it.product_id} className={`dvm-row ${isPos ? "dvm-row-pos" : isNeg ? "dvm-row-neg" : "dvm-row-zero"}`}>
                        <td><span className="dvm-idx">{idx + 1}</span></td>
                        <td>
                          <div className="dvm-prod-name">{it.product_name}</div>
                          {it.barcode && <div className="dvm-prod-code">{it.barcode}</div>}
                        </td>
                        <td className="dvm-qty">{qty(it.system_qty)}</td>
                        <td className="dvm-qty dvm-qty-counted">{qty(it.counted_qty)}</td>
                        <td>
                          <span className={`dvm-diff ${isPos ? "dvm-d-pos" : isNeg ? "dvm-d-neg" : "dvm-d-zero"}`}>
                            {isPos ? "+" : isNeg ? "" : ""}{signed(it.difference)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}
