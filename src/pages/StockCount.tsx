import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { confirmDialog, fmtDate, qty, signed, today, useToast } from "../components/ui";
import { t } from "../i18n";
import type { Product, Warehouse } from "../types";

interface StockCountLine {
  product_id: number;
  name: string;
  barcode: string | null;
  unit: string | null;
  system_qty: number;
  counted_qty: number;
  category_name: string | null;
  cost_price: number;
}

type DiffStatus = "match" | "surplus" | "deficit";

const round2 = (n: number) => Math.round(n * 100) / 100;

const getDiffStatus = (diff: number): DiffStatus =>
  diff > 0 ? "surplus" : diff < 0 ? "deficit" : "match";

const statusClass: Record<DiffStatus, string> = {
  match: "sc-status-match",
  surplus: "sc-status-surplus",
  deficit: "sc-status-deficit",
};

const statusLabel: Record<DiffStatus, string> = {
  match: t("matchStatus"),
  surplus: t("surplusStatus"),
  deficit: t("deficitStatus"),
};

export function StockCount({ onBack }: { onBack: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [lines, setLines] = useState<StockCountLine[]>([]);
  const [date, setDate] = useState<string>(today());
  const [notes, setNotes] = useState<string>("");
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [filterMode, setFilterMode] = useState<"all" | DiffStatus>("all");

  const searchRef = useRef<HTMLInputElement>(null);
  const notify = useToast();
  const loadCountRef = useRef<(id: number) => void>(() => {});

  const loadData = useCallback(async () => {
    try {
      const [fetchedProducts, fetchedWarehouses] = await Promise.all([
        api.listProducts(),
        api.listWarehouses(),
      ]);
      setProducts(fetchedProducts);
      setWarehouses(fetchedWarehouses);
      setIsReady(true);
    } catch (error) {
      notify(String(error), "error");
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!warehouseId) {
      const defaultWarehouse = warehouses.find((w) => w.is_default);
      if (defaultWarehouse) {
        setWarehouseId(String(defaultWarehouse.id));
      }
    }
  }, [warehouses, warehouseId]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) =>
        warehouseId
          ? !p.warehouse_id || String(p.warehouse_id) === warehouseId
          : true,
      )
      .filter((p) => {
        if (!search.trim()) return true;
        const query = search.trim().toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          (p.barcode ?? "").includes(search.trim())
        );
      })
      .slice(0, 25);
  }, [products, warehouseId, search]);

  const filteredLines = useMemo(() => {
    if (filterMode === "all") return lines;
    return lines.filter((l) => {
      const diff = round2(l.counted_qty - l.system_qty);
      return getDiffStatus(diff) === filterMode;
    });
  }, [lines, filterMode]);

  const addProduct = useCallback(
    (product: Product) => {
      setLines((prevLines) => {
        const existing = prevLines.find((l) => l.product_id === product.id);
        if (existing) {
          return prevLines.map((l) =>
            l.product_id === product.id
              ? { ...l, counted_qty: l.counted_qty + 1 }
              : l,
          );
        }
        return [
          ...prevLines,
          {
            product_id: product.id,
            name: product.name,
            barcode: product.barcode,
            unit: product.unit ?? null,
            system_qty: product.quantity,
            counted_qty: product.quantity,
            category_name: product.category_name,
            cost_price: product.cost_price,
          },
        ];
      });
      setSearch("");
      setShowDropdown(false);
      setTimeout(() => searchRef.current?.focus(), 50);
    },
    [],
  );

  const updateCountedQty = useCallback((productId: number, value: number) => {
    const safeValue = Number.isFinite(value) && value >= 0 ? value : 0;
    setLines((prevLines) =>
      prevLines.map((l) =>
        l.product_id === productId ? { ...l, counted_qty: safeValue } : l,
      ),
    );
  }, []);

  const matchSystemQty = useCallback((productId: number) => {
    setLines((prevLines) =>
      prevLines.map((l) =>
        l.product_id === productId
          ? { ...l, counted_qty: l.system_qty }
          : l,
      ),
    );
  }, []);

  const matchAllSystem = useCallback(() => {
    if (lines.length === 0) return;
    setLines((prevLines) =>
      prevLines.map((l) => ({ ...l, counted_qty: l.system_qty })),
    );
    notify(t("quantitiesMatched"));
  }, [lines.length, notify]);

  const removeLine = useCallback((productId: number) => {
    setLines((prevLines) => prevLines.filter((l) => l.product_id !== productId));
  }, []);

  const clearAllLines = useCallback(() => {
    if (lines.length === 0) return;
    if (!confirmDialog(t("clearAllItemsConfirm"))) return;
    setLines([]);
    notify(t("allItemsCleared"));
  }, [lines.length, notify]);

  const totals = useMemo(() => {
    const totalDifference = round2(
      lines.reduce((sum, l) => sum + (l.counted_qty - l.system_qty), 0),
    );
    const totalSurplus = round2(
      lines
        .filter((l) => l.counted_qty > l.system_qty)
        .reduce((sum, l) => sum + (l.counted_qty - l.system_qty), 0),
    );
    const totalDeficit = round2(
      Math.abs(
        lines
          .filter((l) => l.counted_qty < l.system_qty)
          .reduce((sum, l) => sum + (l.counted_qty - l.system_qty), 0),
      ),
    );
    const matchedCount = lines.filter(
      (l) => l.counted_qty === l.system_qty,
    ).length;
    const surplusCount = lines.filter(
      (l) => l.counted_qty > l.system_qty,
    ).length;
    const deficitCount = lines.filter(
      (l) => l.counted_qty < l.system_qty,
    ).length;
    const surplusValue = round2(
      lines
        .filter((l) => l.counted_qty > l.system_qty)
        .reduce(
          (sum, l) => sum + (l.counted_qty - l.system_qty) * l.cost_price,
          0,
        ),
    );
    const deficitValue = round2(
      lines
        .filter((l) => l.counted_qty < l.system_qty)
        .reduce(
          (sum, l) =>
            sum + Math.abs(l.counted_qty - l.system_qty) * l.cost_price,
          0,
        ),
    );
    const totalBefore = round2(
      lines.reduce((sum, l) => sum + l.system_qty * l.cost_price, 0),
    );
    const totalAfter = round2(
      totalBefore + surplusValue - deficitValue,
    );
    return {
      totalDifference,
      totalSurplus,
      totalDeficit,
      matchedCount,
      surplusCount,
      deficitCount,
      surplusValue,
      deficitValue,
      totalBefore,
      totalAfter,
    };
  }, [lines]);

  const loadCount = useCallback(
    async (id: number) => {
      try {
        const count = await api.getStockCount(id);
        setCurrentId(count.id);
        setDate(count.date);
        setNotes(count.notes ?? "");
        setLines(
          count.items.map((item) => ({
            product_id: item.product_id,
            name: item.product_name,
            barcode: item.barcode,
            unit: item.unit,
            system_qty: item.system_qty,
            counted_qty: item.counted_qty,
            category_name: null,
            cost_price: 0,
          })),
        );
        setSearch("");
        notify(t("countLoaded", { id }), "success");
      } catch (error) {
        notify(String(error), "error");
      }
    },
    [notify],
  );

  useEffect(() => {
    loadCountRef.current = loadCount;
  });

  useEffect(() => {
    if (!isReady) return;
    const pending = localStorage.getItem("tabarak_open_count");
    if (pending) {
      localStorage.removeItem("tabarak_open_count");
      const id = Number(pending);
      if (id) loadCountRef.current(id);
    }
  }, [isReady]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "tabarak_open_count" && e.newValue) {
        localStorage.removeItem("tabarak_open_count");
        const id = Number(e.newValue);
        if (id) loadCountRef.current(id);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const newCount = useCallback(() => {
    if (
      lines.length > 0 &&
      !confirmDialog(t("loseUnsavedItems"))
    ) {
      return;
    }
    setCurrentId(null);
    setLines([]);
    setDate(today());
    setNotes("");
    setFilterMode("all");
    searchRef.current?.focus();
    notify(t("newCountInvoice"));
  }, [lines.length, notify]);

  const save = useCallback(async () => {
    if (lines.length === 0) {
      notify(t("addAtLeastOneItem"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        date,
        notes: notes.trim() || null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          counted_qty: l.counted_qty,
        })),
      };
      const saved =
        currentId != null
          ? await api.updateStockCount(currentId, payload)
          : await api.createStockCount(payload);
      setCurrentId(saved.id);
      notify(
        currentId != null
          ? `✅ ${t("countInvoiceUpdated")}`
          : `✅ ${t("countInvoiceSaved")}`,
      );
    } catch (error) {
      notify(String(error), "error");
    } finally {
      setIsSaving(false);
    }
  }, [lines, date, notes, currentId, notify]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const byBarcode = products.find(
        (p) => p.barcode === search.trim(),
      );
      if (byBarcode) {
        addProduct(byBarcode);
        return;
      }
      if (filteredProducts.length > 0) {
        addProduct(filteredProducts[0]);
      }
    }
  };

  return (
    <div className="sc-page">
      <header className="sc-header">
        <div className="sc-header-left">
          <button className="sc-back-btn" onClick={onBack} title={t("backBtn")}>
            <span className="sc-back-icon">→</span>
            <span className="sc-back-text">{t("backBtn")}</span>
          </button>
          <div className="sc-header-info">
            <div className="sc-header-title-row">
              <h1 className="sc-title">
                <span className="sc-title-icon">📋</span>
                {t("tempStockCountTitle")}
              </h1>
              <span
                className={`sc-status-badge ${
                  currentId != null ? "sc-badge-existing" : "sc-badge-draft"
                }`}
              >
                {currentId != null ? t("countNumber", { id: currentId }) : t("newDraft")}
              </span>
            </div>
            <div className="sc-header-sub">
              <span className="sc-header-date">
                📅 {fmtDate(date)}
              </span>
              {lines.length > 0 && (
                <span className="sc-header-count">
                  📦 {lines.length} {t("itemsUnit")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="sc-header-actions">
          <button
            className="sc-btn sc-btn-secondary"
            onClick={newCount}
            title={t("newCountInvoice")}
            disabled={isSaving}
          >
            <span>📄</span>
            <span>{t("newBtn")}</span>
          </button>
          <button
            className="sc-btn sc-btn-primary"
            onClick={save}
            disabled={isSaving || lines.length === 0}
          >
            {isSaving ? (
              <>
                <span className="sc-spinner"></span>
                <span>{t("savingLabel")}</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>
                  {currentId == null ? t("saveInvoice") : t("saveChanges")}
                </span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="sc-body">
        <main className="sc-main">
          <section className="sc-toolbar-card">
            <div className="sc-toolbar-main">
              <div className="sc-search-wrapper">
                <span className="sc-search-icon">🔍</span>
                <input
                  ref={searchRef}
                  className="sc-search-input"
                  placeholder={t("searchProductPlaceholder")}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  onKeyDown={handleSearchKeyDown}
                />
                {search && (
                  <button
                    type="button"
                    className="sc-search-clear"
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                    tabIndex={-1}
                    title={t("clearSearch")}
                  >
                    ✕
                  </button>
                )}
                {showDropdown && (
                  <div className="sc-dropdown">
                    {filteredProducts.length === 0 ? (
                      <div className="sc-dropdown-empty">
                        <div className="sc-empty-icon">🔍</div>
                        <p>{t("noMatchingResults")}</p>
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const isInList = lines.some(
                          (l) => l.product_id === p.id,
                        );
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`sc-dropdown-item ${
                              isInList ? "sc-item-added" : ""
                            }`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addProduct(p);
                            }}
                          >
                            <div className="sc-item-info">
                              <div className="sc-item-name">
                                {p.name}
                                {isInList && (
                                  <span className="sc-item-badge">{t("addedLabel")}</span>
                                )}
                              </div>
                              <div className="sc-item-meta">
                                <span>
                                  🏷️ {p.barcode ?? t("noBarcode")}
                                </span>
                                <span>
                                   📦 {qty(p.quantity)} {p.unit ?? t("unitPiece")}
                                </span>
                                {p.category_name && (
                                  <span>📂 {p.category_name}</span>
                                )}
                              </div>
                            </div>
                            <div className="sc-item-price">
                              {p.warehouse_name ?? t("noWarehouse")}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              <div className="sc-toolbar-right">
                <select
                  className="sc-warehouse-select"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  title={t("filterByWarehouse")}
                >
                  <option value="">🌐 {t("allWarehouses")}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      🏬 {w.name}
                      {w.is_default ? ` (${t("defaultLabel")})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="sc-filter-bar">
                <div className="sc-filter-tabs">
                  {([
                    { key: "all", label: t("filterAll"), count: lines.length },
                    {
                      key: "match",
                      label: t("filterMatch"),
                      count: totals.matchedCount,
                    },
                    {
                      key: "surplus",
                      label: t("filterSurplus"),
                      count: totals.surplusCount,
                    },
                    {
                      key: "deficit",
                      label: t("filterDeficit"),
                      count: totals.deficitCount,
                    },
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`sc-filter-tab ${
                        filterMode === tab.key ? "sc-tab-active" : ""
                      } sc-tab-${tab.key}`}
                      onClick={() => setFilterMode(tab.key)}
                    >
                      <span>{tab.label}</span>
                      <span className="sc-tab-count">{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="sc-filter-actions">
                  <button
                    type="button"
                    className="sc-btn sc-btn-sm sc-btn-outline"
                    onClick={matchAllSystem}
                    title={t("matchAllTooltip")}
                  >
                    ⚡ {t("matchAll")}
                  </button>
                  <button
                    type="button"
                    className="sc-btn sc-btn-sm sc-btn-danger-outline"
                    onClick={clearAllLines}
                    title={t("clearAllTooltip")}
                  >
                    🗑️ {t("clearAll")}
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="sc-table-card">
            {lines.length === 0 ? (
              <div className="sc-empty-state">
                <div className="sc-empty-illustration">
                  <div className="sc-empty-box">📦</div>
                </div>
                <h3 className="sc-empty-title">{t("startCounting")}</h3>
                <p className="sc-empty-text">
                  {t("useSearchToAddItems")}
                </p>
                <div className="sc-empty-hints">
                  <div className="sc-hint-item">
                    <span className="sc-hint-icon">💡</span>
                    <span>
                      {t("hint1")}
                    </span>
                  </div>
                  <div className="sc-hint-item">
                    <span className="sc-hint-icon">💡</span>
                    <span>
                      {t("hint2")}
                    </span>
                  </div>
                  <div className="sc-hint-item">
                    <span className="sc-hint-icon">💡</span>
                    <span>
                      {t("hint3")}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sc-table-wrapper">
                <table className="sc-table">
                  <thead>
                    <tr>
                      <th className="sc-col-idx">#</th>
                      <th className="sc-col-product">{t("productLabel")}</th>
                      <th className="sc-col-system">{t("systemQty")}</th>
                      <th className="sc-col-counted">{t("actualQty")}</th>
                      <th className="sc-col-diff">{t("diffLabel")}</th>
                      <th className="sc-col-status">{t("statusLabel")}</th>
                      <th className="sc-col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLines.map((line, index) => {
                      const diff = round2(line.counted_qty - line.system_qty);
                      const status = getDiffStatus(diff);
                      return (
                        <tr
                          key={line.product_id}
                          className={`sc-row sc-row-${status}`}
                        >
                          <td className="sc-col-idx">{index + 1}</td>
                          <td className="sc-col-product">
                            <div className="sc-product-cell">
                              <div className="sc-product-name">
                                {line.name}
                              </div>
                              <div className="sc-product-meta">
                                <span>
                                  🏷️ {line.barcode?.trim() || "—"}
                                </span>
                                <span>
                                  📂 {line.category_name ?? t("uncategorized")}
                                </span>
                                <span>
                                   📏 {line.unit ?? t("unitPiece")}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="sc-col-system">
                            <div className="sc-system-qty">
                               <span className="sc-qty-label">{t("balanceLabel")}</span>
                              <span className="sc-qty-value sc-mono">
                                {qty(line.system_qty)}
                              </span>
                            </div>
                          </td>
                          <td className="sc-col-counted">
                            <div className="sc-qty-controls">
                              <button
                                type="button"
                                className="sc-qty-btn sc-qty-dec"
                                onClick={() =>
                                  updateCountedQty(
                                    line.product_id,
                                    Math.max(0, line.counted_qty - 1),
                                  )
                                }
                                tabIndex={-1}
                                title={t("decreaseQty")}
                              >
                                −
                              </button>
                              <input
                                type="number"
                                className="sc-qty-input"
                                min={0}
                                step="0.01"
                                value={line.counted_qty}
                                onChange={(e) =>
                                  updateCountedQty(
                                    line.product_id,
                                    Number(e.target.value),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="sc-qty-btn sc-qty-inc"
                                onClick={() =>
                                  updateCountedQty(
                                    line.product_id,
                                    line.counted_qty + 1,
                                  )
                                }
                                tabIndex={-1}
                                title={t("increaseQty")}
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className="sc-match-btn"
                                onClick={() => matchSystemQty(line.product_id)}
                                tabIndex={-1}
                                title={t("matchSystemQty")}
                              >
                                =
                              </button>
                            </div>
                          </td>
                          <td className="sc-col-diff">
                            <span
                              className={`sc-diff-badge ${statusClass[status]}`}
                            >
                              {signed(diff)}
                              {diff !== 0 && line.cost_price > 0 && (
                                <span className="sc-diff-value">
                                   ({qty(Math.abs(diff) * line.cost_price)} {t("currencyUnit")})
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="sc-col-status">
                            <span
                              className={`sc-status-pill ${statusClass[status]}`}
                            >
                              {statusLabel[status]}
                            </span>
                          </td>
                          <td className="sc-col-actions">
                            <button
                              type="button"
                              className="sc-action-btn sc-action-delete"
                              onClick={() => removeLine(line.product_id)}
                              title={t("deleteItemFromCount")}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredLines.length !== lines.length && (
                  <div className="sc-table-footer-note">
                    عرض {filteredLines.length} من أصل {lines.length} {t("itemsUnit")} —{" "}
                    <button
                      className="sc-link-btn"
                      onClick={() => setFilterMode("all")}
                    >
                      {t("showAll")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="sc-sidebar">
          <div className="sc-sidebar-section">
            <h3 className="sc-section-title">
               <span>📊</span> {t("countSummary")}
            </h3>

            <div className="sc-summary-grid">
              <div className="sc-summary-card sc-summary-total">
                <div className="sc-summary-icon">📦</div>
                <div className="sc-summary-content">
                  <div className="sc-summary-number">{lines.length}</div>
                  <div className="sc-summary-label">{t("totalItems")}</div>
                </div>
              </div>

              <div className="sc-summary-card sc-summary-match">
                <div className="sc-summary-icon">✓</div>
                <div className="sc-summary-content">
                  <div className="sc-summary-number">
                    {totals.matchedCount}
                  </div>
                  <div className="sc-summary-label">{t("matchStatus")}</div>
                </div>
                <div className="sc-summary-progress sc-progress-match">
                  <div
                    style={{
                      width:
                        lines.length > 0
                          ? `${(totals.matchedCount / lines.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="sc-summary-card sc-summary-surplus">
                <div className="sc-summary-icon">📈</div>
                <div className="sc-summary-content">
                  <div className="sc-summary-number">
                    {totals.surplusCount}
                  </div>
                  <div className="sc-summary-label">{t("surplusStatus")}</div>
                </div>
                <div className="sc-summary-progress sc-progress-surplus">
                  <div
                    style={{
                      width:
                        lines.length > 0
                          ? `${(totals.surplusCount / lines.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>

              <div className="sc-summary-card sc-summary-deficit">
                <div className="sc-summary-icon">📉</div>
                <div className="sc-summary-content">
                  <div className="sc-summary-number">
                    {totals.deficitCount}
                  </div>
                  <div className="sc-summary-label">{t("deficitStatus")}</div>
                </div>
                <div className="sc-summary-progress sc-progress-deficit">
                  <div
                    style={{
                      width:
                        lines.length > 0
                          ? `${(totals.deficitCount / lines.length) * 100}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="sc-sidebar-section">
            <h3 className="sc-section-title">
               <span>💰</span> {t("qtyValueSummary")}
            </h3>

            <div className="sc-amounts-list">
              <div className="sc-amount-row sc-amount-surplus">
                <div className="sc-amount-label">
                  <span className="sc-amount-dot sc-dot-surplus"></span>
                  {t("totalSurplusQty")}
                </div>
                <div className="sc-amount-value">
                  <b>{signed(totals.totalSurplus)}</b>
                </div>
              </div>

              <div className="sc-amount-row sc-amount-deficit">
                <div className="sc-amount-label">
                  <span className="sc-amount-dot sc-dot-deficit"></span>
                  {t("totalDeficitQty")}
                </div>
                <div className="sc-amount-value">
                  <b>{signed(-totals.totalDeficit)}</b>
                </div>
              </div>

              {totals.surplusValue > 0 && (
                <div className="sc-amount-row sc-amount-muted">
                  <div className="sc-amount-label">
                    <span className="sc-amount-dot sc-dot-surplus"></span>
                    {t("surplusValueEstimate")}
                  </div>
                  <div className="sc-amount-value">
                    <b>{qty(totals.surplusValue)} {t("currencyUnit")}</b>
                  </div>
                </div>
              )}

              {totals.deficitValue > 0 && (
                <div className="sc-amount-row sc-amount-muted">
                  <div className="sc-amount-label">
                    <span className="sc-amount-dot sc-dot-deficit"></span>
                    {t("deficitValueEstimate")}
                  </div>
                  <div className="sc-amount-value">
                    <b>{qty(totals.deficitValue)} {t("currencyUnit")}</b>
                  </div>
                </div>
              )}

              <div
                className={`sc-amount-row sc-amount-net ${
                  totals.totalDifference > 0
                    ? "sc-amount-surplus"
                    : totals.totalDifference < 0
                      ? "sc-amount-deficit"
                      : ""
                }`}
              >
                <div className="sc-amount-label">
                  <span
                    className={`sc-amount-dot ${
                      totals.totalDifference > 0
                        ? "sc-dot-surplus"
                        : totals.totalDifference < 0
                          ? "sc-dot-deficit"
                          : "sc-dot-match"
                    }`}
                  ></span>
                  {t("netTotalDiff")}
                </div>
                <div className="sc-amount-value">
                  <b>{signed(totals.totalDifference)}</b>
                </div>
              </div>
            </div>
          </div>

          <div className="sc-sidebar-section">
            <h3 className="sc-section-title">
               <span>📝</span> {t("invoiceData")}
            </h3>

            <div className="sc-form-group">
              <label className="sc-form-label">
                 <span>📅</span> {t("countDate")}
              </label>
              <input
                type="date"
                className="sc-form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="sc-form-group">
              <label className="sc-form-label">
                 <span>📄</span> {t("notesLabel")}
              </label>
              <textarea
                className="sc-form-textarea"
                rows={3}
                 placeholder={t("notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="sc-sidebar-footer">
            <button
              type="button"
              className="sc-btn sc-btn-primary sc-btn-block"
              onClick={save}
              disabled={isSaving || lines.length === 0}
            >
              {isSaving ? (
                <>
                  <span className="sc-spinner"></span>
                  <span>{t("savingLabel")}</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>
                    {currentId == null
                      ? t("saveAsDraft")
                      : t("saveChanges")}
                  </span>
                </>
              )}
            </button>

            <div className="sc-info-box">
              <div className="sc-info-icon">ℹ️</div>
              <div className="sc-info-text">
                 {t("draftInfoText")}
              </div>
            </div>
          </div>
        </aside>
      </div>


    </div>
  );
}
