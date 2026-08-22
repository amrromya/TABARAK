import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { confirmDialog, money, qty, signed, today, useToast } from "../components/ui";
import { t } from "../i18n";
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
    if (!confirmDialog(t("saveCountConfirm"))) return;
    setSaving(true);
    try {
      const items = lines.map((l) => ({ product_id: l.product_id, counted_qty: l.counted_qty }));
      const count = await api.createStockCount({
        date: today(),
        notes: `جرد كلي - ${countedCount} صنف مُجرّد / ${uncountedCount} صنف غير مُجرّد`,
        items,
      });
      await api.applyStockCount(count.id);
      notify(t("countSavedSuccess"), "success");
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
            <span className="sc-back-text">{t("backBtn")}</span>
          </button>
          <h1 className="frc-title">
            <span>📊</span> {t("fullInventoryCountTitle")}
          </h1>
        </div>
      </header>

      <div className="frc-body">
        {view === "list" ? (
          <div className="frc-list-view">
            <div className="frc-list-header">
              <h3>{t("tempStockCounts")}</h3>
              <span className="frc-list-count">{counts.length} {t("invoiceCountLabel")}</span>
            </div>
            {loading ? (
              <div className="frc-loading">{t("loading")}</div>
            ) : counts.length === 0 ? (
              <div className="frc-empty">{t("noStockCountsYet")}</div>
            ) : (
              <div className="frc-counts-list">
                {counts.map((c) => (
                  <div key={c.id} className="frc-count-row">
                    <div className="frc-count-info">
                      <span className="frc-count-id">#{c.id}</span>
                      <span className="frc-count-date">{c.date}</span>
                      <span className="frc-count-items">{c.items_count} صنف مُجرّد</span>
                      <span className={`frc-count-status frc-status-${c.status}`}>
                        {c.status === "draft" ? t("draftStatusFrc") : t("appliedStatusFrc")}
                      </span>
                    </div>
                      <button className="btn primary sm" onClick={() => retrieveCount(c.id)}>
                        {t("retrieveCountData")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="frc-count-view">
            <div className="frc-toolbar">
              <button className="btn sm" onClick={() => setView("list")}>{t("backToList")}</button>
              <input
                className="search"
                placeholder={t("searchByCodeOrName")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <div className="frc-filter-tabs">
                <button
                  className={`frc-filter-tab ${filterMode === "all" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("all")}
                >
                  {t("filterAllLabel")} ({lines.length})
                </button>
                <button
                  className={`frc-filter-tab ${filterMode === "uncounted_with_movement" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("uncounted_with_movement")}
                >
                  {t("uncountedWithMovement")} ({uncountedWithMovement})
                </button>
                <button
                  className={`frc-filter-tab ${filterMode === "uncounted_no_movement" ? "frc-filter-active" : ""}`}
                  onClick={() => setFilterMode("uncounted_no_movement")}
                >
                  {t("uncountedNoMovement")} ({uncountedNoMovement})
                </button>
              </div>
              <div className="frc-stats">
                <span className="frc-stat frc-stat-counted">{t("countedStat")}: {countedCount}</span>
                <span className="frc-stat frc-stat-uncounted">{t("uncountedStat")}: {uncountedCount}</span>
              </div>
              <button className="btn sm" onClick={() => window.print()}>
                🖨️ {t("print")}
              </button>
              <button className="btn primary sm" onClick={saveFullCount} disabled={saving}>
                {saving ? t("savingLabel") : t("saveAndSettle")}
              </button>
            </div>
            <div className="frc-table-wrap">
              <table className="table frc-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("productCode")}</th>
                    <th>{t("productNameLabel")}</th>
                    <th>{t("computerCount")}</th>
                    <th>{t("actualCount")}</th>
                    <th>{t("settlement")}</th>
                    <th>{t("purchasePriceCol")}</th>
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
                          {!l.counted && <span className="frc-uncounted-badge">{t("uncountedBadge")}</span>}
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
                    <tr><td colSpan={7} className="empty">{t("noResults2")}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="frc-bottom-bar">
              <div className="frc-bottom-item">
                <span className="frc-bottom-label">{t("countValueBefore")}</span>
                <span className="frc-bottom-value">{money(totals.totalBefore)} {t("currencyUnit")}</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item frc-bottom-surplus">
                <span className="frc-bottom-label">{t("surplusSetValue")}</span>
                <span className="frc-bottom-value">+{money(totals.surplusValue)} {t("currencyUnit")}</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item frc-bottom-deficit">
                <span className="frc-bottom-label">{t("deficitSetValue")}</span>
                <span className="frc-bottom-value">-{money(totals.deficitValue)} {t("currencyUnit")}</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className={`frc-bottom-item frc-bottom-net ${totals.totalDifference > 0 ? "frc-bottom-surplus" : totals.totalDifference < 0 ? "frc-bottom-deficit" : ""}`}>
                <span className="frc-bottom-label">{t("netSetValue")}</span>
                <span className="frc-bottom-value">{signed(totals.surplusValue - totals.deficitValue)} {t("currencyUnit")}</span>
              </div>
              <div className="frc-bottom-divider" />
              <div className="frc-bottom-item">
                <span className="frc-bottom-label">{t("countValueAfter")}</span>
                <span className="frc-bottom-value frc-bottom-final">{money(totals.totalAfter)} {t("currencyUnit")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
