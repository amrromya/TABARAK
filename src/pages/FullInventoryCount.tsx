import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { confirmDialog, money, qty, signed, today, useToast } from "../components/ui";
import type { Product, StockCount } from "../types";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface FullCountLine {
  product_id: number;
  code: string;
  name: string;
  system_qty: number;
  counted_qty: number;
  cost_price: number;
  counted: boolean;
}

type FilterMode = "all" | "uncounted_with_movement" | "uncounted_no_movement";

export function FullInventoryCount({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<"list" | "count">("list");
  const [counts, setCounts] = useState<StockCount[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<FullCountLine[]>([]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const notify = useToast();

  const loadCounts = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([api.listStockCounts(), api.listProducts()]);
      setCounts(c);
      setProducts(p);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const retrieveCount = useCallback(async (countId: number) => {
    try {
      const count = await api.getStockCount(countId);
      const allLines: FullCountLine[] = products.map((p) => {
        const item = count.items.find((i) => i.product_id === p.id);
        return {
          product_id: p.id,
          code: p.barcode ?? String(p.id),
          name: p.name,
          system_qty: p.quantity,
          counted_qty: item ? item.counted_qty : 0,
          cost_price: p.cost_price,
          counted: !!item,
        };
      });
      setLines(allLines);
      setView("count");
      setSearch("");
      setFilterMode("all");
    } catch (e) {
      notify(String(e), "error");
    }
  }, [products, notify]);

  const filteredLines = useMemo(() => {
    let result = lines;
    if (filterMode === "uncounted_with_movement") {
      result = result.filter((l) => !l.counted && l.system_qty > 0);
    } else if (filterMode === "uncounted_no_movement") {
      result = result.filter((l) => !l.counted && l.system_qty === 0);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(q) || l.code.includes(search.trim()),
      );
    }
    return result;
  }, [lines, search, filterMode]);

  const countedCount = useMemo(() => lines.filter((l) => l.counted).length, [lines]);
  const uncountedCount = useMemo(() => lines.filter((l) => !l.counted).length, [lines]);
  const uncountedWithMovement = useMemo(() => lines.filter((l) => !l.counted && l.system_qty > 0).length, [lines]);
  const uncountedNoMovement = useMemo(() => lines.filter((l) => !l.counted && l.system_qty === 0).length, [lines]);

  const totals = useMemo(() => {
    const totalBefore = round2(lines.reduce((s, l) => s + l.system_qty * l.cost_price, 0));
    const surplusValue = round2(
      lines.filter((l) => l.counted_qty > l.system_qty)
        .reduce((s, l) => s + (l.counted_qty - l.system_qty) * l.cost_price, 0),
    );
    const deficitValue = round2(
      lines.filter((l) => l.counted_qty < l.system_qty)
        .reduce((s, l) => s + Math.abs(l.counted_qty - l.system_qty) * l.cost_price, 0),
    );
    const totalAfter = round2(totalBefore + surplusValue - deficitValue);
    const totalDifference = round2(
      lines.reduce((s, l) => s + (l.counted_qty - l.system_qty), 0),
    );
    return { totalBefore, surplusValue, deficitValue, totalAfter, totalDifference };
  }, [lines]);

  const saveFullCount = useCallback(async () => {
    if (lines.length === 0) return;
    if (!confirmDialog("حفظ الجرد والتسوية بالكامل في قاعدة البيانات؟")) return;
    setSaving(true);
    try {
      const items = lines.map((l) => ({ product_id: l.product_id, counted_qty: l.counted_qty }));
      const count = await api.createStockCount({
        date: today(),
        notes: `جرد كلي - ${countedCount} صنف مُجرّد / ${uncountedCount} صنف غير مُجرّد`,
        items,
      });
      await api.applyStockCount(count.id);
      notify("تم حفظ الجرد والتسوية بنجاح", "success");
      onBack();
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setSaving(false);
    }
  }, [lines, countedCount, uncountedCount, notify, onBack]);

  const diffClass = (diff: number) => diff > 0 ? "frc-surplus" : diff < 0 ? "frc-deficit" : "frc-match";

  return (
    <div className="frc-page">
      <header className="frc-header">
        <div className="frc-header-left">
          <button className="sc-back-btn" onClick={onBack} title="رجوع">
            <span className="sc-back-icon">→</span>
            <span className="sc-back-text">رجوع</span>
          </button>
          <h1 className="frc-title">
            <span>📊</span> جرد كلي
          </h1>
        </div>
      </header>

      <div className="frc-body">
        {view === "list" ? (
          <div className="frc-list-view">
            <div className="frc-list-header">
              <h3>فواتير الجرد المؤقت</h3>
              <span className="frc-list-count">{counts.length} فاتورة</span>
            </div>
            {loading ? (
              <div className="frc-loading">جارٍ التحميل...</div>
            ) : counts.length === 0 ? (
              <div className="frc-empty">لا توجد فواتير جرد مؤقت بعد</div>
            ) : (
              <div className="frc-counts-list">
                {counts.map((c) => (
                  <div key={c.id} className="frc-count-row">
                    <div className="frc-count-info">
                      <span className="frc-count-id">#{c.id}</span>
                      <span className="frc-count-date">{c.date}</span>
                      <span className="frc-count-items">{c.items_count} صنف مُجرّد</span>
                      <span className={`frc-count-status frc-status-${c.status}`}>
                        {c.status === "draft" ? "مسودة" : "مطبّقة"}
                      </span>
                    </div>
                    <button className="btn primary sm" onClick={() => retrieveCount(c.id)}>
                      📋 استحضار بيانات الجرد
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="frc-count-view">
            <div className="frc-toolbar">
              <button className="btn sm" onClick={() => setView("list")}>← الرجوع للقائمة</button>
              <input
                className="search"
                placeholder="بحث بالاسم أو الكود..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <div className="frc-filter-tabs">
                <button
                  className={`frc-filter-tab ${filterMode === "all" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("all")}
                >
                  الكل ({lines.length})
                </button>
                <button
                  className={`frc-filter-tab ${filterMode === "uncounted_with_movement" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("uncounted_with_movement")}
                >
                  لم يُجرّد له حركة ({uncountedWithMovement})
                </button>
                <button
                  className={`frc-filter-tab ${filterMode === "uncounted_no_movement" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("uncounted_no_movement")}
                >
                  لم يُجرّد بدون حركة ({uncountedNoMovement})
                </button>
              </div>
              <div className="frc-stats">
                <span className="frc-stat frc-stat-counted">✓ مُجرّد: {countedCount}</span>
                <span className="frc-stat frc-stat-uncounted">✗ غير مُجرّد: {uncountedCount}</span>
              </div>
              <button className="btn sm" onClick={() => window.print()}>
                🖨️ طباعة
              </button>
              <button className="btn primary sm" onClick={saveFullCount} disabled={saving}>
                {saving ? "جارٍ الحفظ..." : "💾 حفظ الجرد والتسوية"}
              </button>
            </div>
            <div className="frc-table-wrap">
              <table className="table frc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>كود الصنف</th>
                    <th>اسم الصنف</th>
                    <th>الجرد بالحاسب</th>
                    <th>الجرد الفعلي</th>
                    <th>التسوية</th>
                    <th>سعر الشراء</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((l, i) => {
                    const diff = round2(l.counted_qty - l.system_qty);
                    return (
                      <tr key={l.product_id} className={!l.counted ? "frc-row-uncounted" : ""}>
                        <td>{i + 1}</td>
                        <td>{l.code}</td>
                        <td className="strong">
                          {l.name}
                          {!l.counted && <span className="frc-uncounted-badge">لم يُجرّد</span>}
                        </td>
                        <td>{qty(l.system_qty)}</td>
                        <td className="strong">
                          {l.counted ? (
                            qty(l.counted_qty)
                          ) : (
                            <span className="frc-uncounted-value">-{qty(l.system_qty)}</span>
                          )}
                        </td>
                        <td className={diffClass(diff)}>{signed(diff)}</td>
                        <td>{money(l.cost_price)}</td>
                      </tr>
                    );
                  })}
                  {filteredLines.length === 0 && (
                    <tr><td colSpan={7} className="empty">لا توجد نتائج</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="frc-bottom-bar">
              <div className="frc-bottom-item">
                <span className="frc-bottom-label">قيمة الجرد قبل التسوية</span>
                <span className="frc-bottom-value">{money(totals.totalBefore)} ج.م</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item frc-bottom-surplus">
                <span className="frc-bottom-label">قيمة التسوية بالزيادة</span>
                <span className="frc-bottom-value">+{money(totals.surplusValue)} ج.م</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item frc-bottom-deficit">
                <span className="frc-bottom-label">قيمة التسوية بالنقص</span>
                <span className="frc-bottom-value">-{money(totals.deficitValue)} ج.م</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className={`frc-bottom-item frc-bottom-net ${totals.totalDifference > 0 ? "frc-bottom-surplus" : totals.totalDifference < 0 ? "frc-bottom-deficit" : ""}`}>
                <span className="frc-bottom-label">صافي قيمة التسوية</span>
                <span className="frc-bottom-value">{signed(totals.surplusValue - totals.deficitValue)} ج.م</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item">
                <span className="frc-bottom-label">قيمة الجرد بعد التسوية</span>
                <span className="frc-bottom-value frc-bottom-final">{money(totals.totalAfter)} ج.م</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
