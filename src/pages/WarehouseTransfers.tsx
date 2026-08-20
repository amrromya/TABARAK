import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import {
  Field,
  Modal,
  confirmDialog,
  money,
  today,
  useToast,
} from "../components/ui";
import { t } from "../i18n";

interface TransferItem {
  product_id: number;
  name: string;
  quantity: number;
  available: number;
}

export function WarehouseTransfers() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [date, setDate] = useState(today());
  const [fromWarehouseId, setFromWarehouseId] = useState("");
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [transferType, setTransferType] = useState("products");
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [warehouseStatsList, setWarehouseStatsList] = useState<{ id: number; name: string; cashIn: number; cashOut: number; balance: number }[]>([]);

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, w, p] = await Promise.all([
        api.listWarehouseTransfers(search || undefined),
        api.listWarehouses(),
        api.listProducts(),
      ]);
      setTransfers(t);
      setWarehouses(w);
      setProducts(p);

      try {
        const cashBalances = await api.getWarehouseCashBalances();
        setWarehouseStatsList(cashBalances.map((cb) => ({
          id: cb.warehouse_id,
          name: cb.warehouse_name,
          cashIn: cb.cash_in,
          cashOut: cb.cash_out,
          balance: cb.balance,
        })));
      } catch {
        setWarehouseStatsList([]);
      }
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setDate(today());
    setFromWarehouseId("");
    setToWarehouseId("");
    setTransferType("products");
    setAmount(0);
    setNotes("");
    setItems([]);
  };

  const addItem = () => {
    if (!selProduct) return;
    const p = products.find((x: any) => x.id === Number(selProduct));
    if (!p) return;
    if (items.some((i) => i.product_id === p.id)) {
      notify(t("itemAlreadyAdded"), "error");
      return;
    }
    setItems([...items, {
      product_id: p.id,
      name: p.name,
      quantity: selQty,
      available: p.quantity || 0,
    }]);
    setSelProduct("");
    setSelQty(1);
  };

  const removeItem = (pid: number) => {
    setItems(items.filter((i) => i.product_id !== pid));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromWarehouseId || !toWarehouseId) {
      notify(t("selectBothWarehouses"), "error");
      return;
    }
    if (fromWarehouseId === toWarehouseId) {
      notify(t("cannotTransferToSame"), "error");
      return;
    }
    if (transferType === "products" && items.length === 0) {
      notify(t("addItemFirst"), "error");
      return;
    }
    try {
      await api.createWarehouseTransfer({
        date,
        from_warehouse_id: Number(fromWarehouseId),
        to_warehouse_id: Number(toWarehouseId),
        transfer_type: transferType,
        amount: transferType === "financial" ? amount : 0,
        notes: notes.trim() || null,
        items: transferType === "products" ? items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
        })) : [],
      });
      notify(t("transferCreated"));
      setShowForm(false);
      resetForm();
      load();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const remove = async (id: number) => {
    if (!(await confirmDialog(t("confirmDeleteTransfer")))) return;
    try {
      await api.deleteWarehouseTransfer(id);
      notify(t("transferDeleted"));
      load();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("warehouseTransfersTitle")}</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder={t("searchByTransferNo")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            className="btn primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            {t("newTransferBtn")}
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>
          {t("transferCount")}: <b>{transfers.length}</b>
        </span>
      </div>

      {loading ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p>{t("loading")}</p>
        </div>
      ) : transfers.length === 0 ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 16, color: "#6b7280" }}>{t("noTransfers")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("transferNo")}</th>
                <th>{t("date")}</th>
                <th>{t("fromWarehouse")}</th>
                <th>{t("toWarehouse")}</th>
                <th>{t("typeLabel")}</th>
                <th>{t("amount")}</th>
                <th>{t("notes")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t, i) => (
                <tr key={t.id}>
                  <td>{i + 1}</td>
                  <td className="strong">{t.transfer_no}</td>
                  <td>{t.date}</td>
                  <td>{t.from_warehouse ?? "—"}</td>
                  <td>{t.to_warehouse ?? "—"}</td>
                  <td>
                    <span style={{
                      background: t.transfer_type === "products" ? "#dbeafe" : "#fef3c7",
                      color: t.transfer_type === "products" ? "#1d4ed8" : "#b45309",
                      padding: "2px 8px", borderRadius: 10, fontSize: 11,
                    }}>
                      {t.transfer_type === "products" ? t("goodsLabel") : t("financialLabel")}
                    </span>
                  </td>
                  <td>{t.amount > 0 ? money(t.amount) : "—"}</td>
                  <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.notes ?? "—"}</td>
                  <td>
                    <button className="btn sm danger" onClick={() => remove(t.id)}>
                      {t("delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={t("newTransferTitle")} onClose={() => setShowForm(false)} width="650px">
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label={t("dateFieldRequired")}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t("transferTypeField")}>
                <select value={transferType} onChange={(e) => setTransferType(e.target.value)}>
                  <option value="products">{t("productTransferOption")}</option>
                  <option value="financial">{t("financialTransferOption")}</option>
                </select>
              </Field>
              <Field label={t("fromWarehouse") + " *"}>
                <select value={fromWarehouseId} onChange={(e) => setFromWarehouseId(e.target.value)}>
                  <option value="">{t("selectWarehouseOption")}</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("toWarehouse") + " *"}>
                <select value={toWarehouseId} onChange={(e) => setToWarehouseId(e.target.value)}>
                  <option value="">{t("selectWarehouseOption")}</option>
                  {warehouses.filter((w: any) => String(w.id) !== fromWarehouseId).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </Field>
              {transferType === "financial" && (
                <Field label={t("financialAmountField")}>
                  <input type="number" min={0} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
                </Field>
              )}
              <Field label={t("notes")}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("transferNotesPlaceholder")} />
              </Field>
            </div>

            {transferType === "products" && (
              <>
                <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div style={{ flex: 2, minWidth: 180 }}>
                    <Field label={t("selectProductForTransfer")}>
                      <select value={selProduct} onChange={(e) => setSelProduct(e.target.value)}>
                        <option value="">{t("selectProductOption")}</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>{p.name} (متوفر: {p.quantity})</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 100 }}>
                    <Field label={t("quantity")}>
                      <input type="number" min={0.01} step="0.01" value={selQty} onChange={(e) => setSelQty(Number(e.target.value))} />
                    </Field>
                  </div>
                  <button type="button" className="btn sm" onClick={addItem} style={{ marginBottom: 2 }}>{t("addBtn")}</button>
                </div>

                {items.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t("productCol")}</th>
                          <th>{t("quantity")}</th>
                          <th>{t("availableCol")}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.product_id}>
                            <td className="strong">{item.name}</td>
                            <td>
                              <input
                                type="number"
                                min={0.01}
                                step="0.01"
                                value={item.quantity}
                                onChange={(e) => {
                                  const qty = Number(e.target.value);
                                  setItems(items.map((i) =>
                                    i.product_id === item.product_id ? { ...i, quantity: qty } : i
                                  ));
                                }}
                                style={{ width: 80, padding: "4px 8px" }}
                              />
                            </td>
                            <td>{item.available}</td>
                            <td>
                              <button type="button" className="btn sm danger" onClick={() => removeItem(item.product_id)}>
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button type="submit" className="btn primary">{t("saveTransfer")}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>{t("cancel")}</button>
            </div>
          </form>
        </Modal>
      )}

      {warehouseStatsList.length > 0 && (
        <div className="wh-summary-bar">
          <div className="wh-summary-header">
            <span className="wh-summary-icon">💰</span>
            <span className="wh-summary-title">{t("cashBalanceSummary")}</span>
          </div>
          <div className="wh-summary-grid">
            {warehouseStatsList.map((ws) => (
              <div key={ws.id} className={`wh-summary-card ${ws.balance < 0 ? "wh-negative" : ""}`}>
                <div className="wh-card-name">🏬 {ws.name}</div>
                <div className="wh-card-stats">
                  <div className="wh-card-stat">
                    <span className="wh-card-label">{t("inbound")}</span>
                    <span className="wh-card-value wh-green">{money(ws.cashIn)}</span>
                  </div>
                  <div className="wh-card-stat">
                    <span className="wh-card-label">{t("outbound")}</span>
                    <span className="wh-card-value wh-red">{money(ws.cashOut)}</span>
                  </div>
                  <div className="wh-card-stat wh-balance-row">
                    <span className="wh-card-label">{t("balanceLabel")}</span>
                    <span className={`wh-card-value ${ws.balance < 0 ? "wh-red" : "wh-green"}`}>
                      {ws.balance < 0 ? "−" : ""}{money(Math.abs(ws.balance))}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            <div className="wh-summary-card wh-total-card">
              <div className="wh-card-name">{t("totalCashBoxes")}</div>
              <div className="wh-card-stats">
                <div className="wh-card-stat">
                  <span className="wh-card-label">{t("inboundShort")}</span>
                  <span className="wh-card-value wh-green">{money(warehouseStatsList.reduce((s, w) => s + w.cashIn, 0))}</span>
                </div>
                <div className="wh-card-stat">
                  <span className="wh-card-label">{t("outboundShort")}</span>
                  <span className="wh-card-value wh-red">{money(warehouseStatsList.reduce((s, w) => s + w.cashOut, 0))}</span>
                </div>
                <div className="wh-card-stat wh-balance-row">
                  <span className="wh-card-label">{t("balanceLabel")}</span>
                  {(() => {
                    const total = warehouseStatsList.reduce((s, w) => s + w.balance, 0);
                    return (
                      <span className={`wh-card-value ${total < 0 ? "wh-red" : "wh-green"}`}>
                        {total < 0 ? "−" : ""}{money(Math.abs(total))}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
