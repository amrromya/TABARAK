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

const PAYMENT_METHODS = [
  { value: "cash", labelKey: "cash" },
  { value: "card", labelKey: "card" },
  { value: "transfer", labelKey: "bankTransferLabel" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "cash",
  card: "card",
  transfer: "bankTransferLabel",
};

export function ReceiptVouchers() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);

  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState(0);
  const [sourceType, setSourceType] = useState("customer");
  const [sourceId, setSourceId] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, w, c, s] = await Promise.all([
        api.listReceiptVouchers(search || undefined),
        api.listWarehouses(),
        api.listCustomers(),
        api.listSuppliers(),
      ]);
      setVouchers(v);
      setWarehouses(w);
      setCustomers(c);
      setSuppliers(s);
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
    setAmount(0);
    setSourceType("customer");
    setSourceId("");
    setSourceName("");
    setPaymentMethod("cash");
    setWarehouseId("");
    setNotes("");
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      notify(t("enterAmount"), "error");
      return;
    }
    try {
      await api.createReceiptVoucher({
        date,
        amount,
        source_type: sourceType,
        source_id: sourceId ? Number(sourceId) : null,
        source_name: sourceName.trim() || null,
        payment_method: paymentMethod,
        warehouse_id: warehouseId ? Number(warehouseId) : null,
        notes: notes.trim() || null,
      });
      notify(t("receiptVoucherCreated"));
      setShowForm(false);
      resetForm();
      load();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const remove = async (id: number) => {
    if (!(await confirmDialog(t("confirmDeleteReceipt")))) return;
    try {
      await api.deleteReceiptVoucher(id);
      notify(t("receiptDeleted"));
      load();
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const totalAmount = vouchers.reduce((s, v) => s + (v.amount || 0), 0);

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("receiptVouchersTitle")}</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder={t("searchByVoucherOrName")}
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
            {t("newReceiptVoucher")}
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>
          {t("voucherCount")}: <b>{vouchers.length}</b>
        </span>
        <span>
          {t("total")}: <b style={{ color: "#0f8a5f" }}>{money(totalAmount)}</b>
        </span>
      </div>

      {loading ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p>{t("loading")}</p>
        </div>
      ) : vouchers.length === 0 ? (
        <div className="settings-card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 16, color: "#6b7280" }}>{t("noReceiptVouchers")}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("voucherNo")}</th>
                <th>{t("date")}</th>
                <th>{t("amount")}</th>
                <th>{t("typeLabel")}</th>
                <th>{t("sourceLabel")}</th>
                <th>{t("paymentMethod")}</th>
                <th>{t("notes")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v, i) => (
                <tr key={v.id}>
                  <td>{i + 1}</td>
                  <td className="strong">{v.voucher_no}</td>
                  <td>{v.date}</td>
                  <td style={{ color: "#0f8a5f", fontWeight: 700 }}>{money(v.amount)}</td>
                  <td>
                    <span style={{
                      background: v.source_type === "customer" ? "#dbeafe" : "#fef3c7",
                      color: v.source_type === "customer" ? "#1d4ed8" : "#b45309",
                      padding: "2px 8px", borderRadius: 10, fontSize: 11,
                    }}>
                      {v.source_type === "customer" ? t("customerLabel") : t("supplierLabel")}
                    </span>
                  </td>
                  <td>{v.source_name ?? "—"}</td>
                  <td>{t(PAYMENT_LABELS[v.payment_method] ?? "") || v.payment_method}</td>
                  <td style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.notes ?? "—"}</td>
                  <td>
                    <button className="btn sm danger" onClick={() => remove(v.id)}>
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
        <Modal title={t("newReceiptVoucherTitle")} onClose={() => setShowForm(false)} width="500px">
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label={t("dateFieldRequired")}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label={t("amountRequired")}>
                <input type="number" min={0} step="0.01" value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} />
              </Field>
              <Field label={t("collectedFrom")}>
                <select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setSourceId(""); setSourceName(""); }}>
                  <option value="customer">{t("customerLabel")}</option>
                  <option value="supplier">{t("supplierLabel")}</option>
                  <option value="other">{t("otherOption")}</option>
                </select>
              </Field>
              {sourceType === "customer" && (
                <Field label={t("selectCustomer")}>
                  <select value={sourceId} onChange={(e) => {
                    setSourceId(e.target.value);
                    const c = customers.find((x: any) => x.id === Number(e.target.value));
                    setSourceName(c?.name ?? "");
                  }}>
                    <option value="">{t("selectOption")}</option>
                    {customers.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              {sourceType === "supplier" && (
                <Field label={t("selectSupplierForVoucher")}>
                  <select value={sourceId} onChange={(e) => {
                    setSourceId(e.target.value);
                    const s = suppliers.find((x: any) => x.id === Number(e.target.value));
                    setSourceName(s?.name ?? "");
                  }}>
                    <option value="">{t("selectOption")}</option>
                    {suppliers.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              {sourceType === "other" && (
                <Field label={t("nameField")}>
                  <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder={t("entityNamePlaceholder")} />
                </Field>
              )}
              <Field label={t("receiptMethod")}>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{t(m.labelKey)}</option>
                  ))}
                </select>
              </Field>
              {warehouses.length > 0 && (
                <Field label={t("cashBoxWarehouse")}>
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                    <option value="">{t("selectOption")}</option>
                    {warehouses.map((w: any) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={t("notes")}>
                <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholderField")} />
              </Field>
            </div>
            <div className="form-actions">
              <button type="submit" className="btn primary">{t("saveBtn")}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>{t("cancel")}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
