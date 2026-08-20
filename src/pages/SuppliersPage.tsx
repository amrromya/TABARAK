import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Field, Modal, confirmDialog, fmtDate, money, useToast } from "../components/ui";
import { t } from "../i18n";
import type { NewSupplier, Settings, Supplier } from "../types";

export function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<NewSupplier>({ name: "", phone: "", address: "", credit_limit: 0, notes: "" });

  const [selected, setSelected] = useState<Supplier | null>(null);
  const [accountSummary, setAccountSummary] = useState<{ total_purchases: number; total_purchase_returns: number; total_paid: number; total_received: number; balance: number } | null>(null);
  const [transactions, setTransactions] = useState<{ date: string; description: string; debit: number; credit: number; notes: string | null }[]>([]);
  const [showAccount, setShowAccount] = useState(false);
  const [accountTab, setAccountTab] = useState<"summary" | "detailed">("summary");

  const [showVoucher, setShowVoucher] = useState<"receipt" | "payment" | null>(null);
  const [voucherForm, setVoucherForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: 0, payment_method: "cash", notes: "" });

  const printRef = useRef<HTMLDivElement>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([api.listSuppliers(), api.getSettings()]);
      setSuppliers(s);
      setSettings(st);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const filtered = suppliers.filter(
    (s) => !search.trim() || s.name.includes(search) || (s.phone ?? "").includes(search)
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", phone: "", address: "", credit_limit: 0, notes: "" });
    setShowForm(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone, address: s.address, credit_limit: s.credit_limit, notes: s.notes });
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { notify(t("supplierNameRequired"), "error"); return; }
    try {
      if (editing) {
        await api.updateSupplier(editing.id, form);
        notify(t("supplierUpdated"));
      } else {
        await api.createSupplier(form);
        notify(t("supplierAddedLabel"));
      }
      setShowForm(false);
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (s: Supplier) => {
    if (!confirmDialog(t("confirmDeleteSupplier") + " \"" + s.name + "\"؟")) return;
    try {
      await api.deleteSupplier(s.id);
      notify(t("supplierDeleted"));
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const openAccountStatement = async (s: Supplier) => {
    setSelected(s);
    try {
      const [acc, txns] = await Promise.all([
        api.getSupplierAccount(s.id),
        api.getSupplierTransactions(s.id),
      ]);
      setAccountSummary(acc);
      setTransactions(txns);
      setAccountTab("summary");
      setShowAccount(true);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const openVoucher = (type: "receipt" | "payment") => {
    setVoucherForm({ date: new Date().toISOString().slice(0, 10), amount: 0, payment_method: "cash", notes: "" });
    setShowVoucher(type);
  };

  const saveVoucher = async () => {
    if (!selected) return;
    if (voucherForm.amount <= 0) { notify(t("enterAmount"), "error"); return; }
    try {
      if (showVoucher === "receipt") {
        await api.createReceiptVoucher({
          date: voucherForm.date,
          amount: voucherForm.amount,
          source_type: "supplier",
          source_id: selected.id,
          source_name: selected.name,
          payment_method: voucherForm.payment_method,
          warehouse_id: null,
          notes: voucherForm.notes || null,
        });
        notify(t("receiptRecorded"));
      } else {
        await api.createPaymentVoucher({
          date: voucherForm.date,
          amount: voucherForm.amount,
          dest_type: "supplier",
          dest_id: selected.id,
          dest_name: selected.name,
          payment_method: voucherForm.payment_method,
          warehouse_id: null,
          notes: voucherForm.notes || null,
        });
        notify(t("paymentRecorded"));
      }
      setShowVoucher(null);
      openAccountStatement(selected);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const printAccount = () => {
    const content = printRef.current;
    if (!content) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    const supplierName = selected?.name || "";
    w.document.write(
      '<html dir="rtl"><head><title>كشف حساب ' + supplierName + '</title><style>' +
      'body{font-family:Cairo,sans-serif;padding:20px;font-size:13px}' +
      'table{width:100%;border-collapse:collapse;margin:12px 0}' +
      'th,td{border:1px solid #ddd;padding:8px;text-align:right}' +
      'th{background:#f3f4f6;font-weight:700}' +
      '.total{font-weight:700;font-size:15px;margin-top:12px}' +
      'h2{text-align:center;margin-bottom:4px}' +
      '.meta{text-align:center;color:#666;margin-bottom:16px;font-size:12px}' +
      '</style></head><body>' + content.innerHTML + '</body></html>'
    );
    w.document.close();
    w.print();
  };

  const titleAccount = t("supplierStatement") + " - " + (selected?.name || "");

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("suppliers")}</h1>
        <div className="head-actions">
          <input className="search" placeholder={t("searchByNameOrPhone")} value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="btn primary" onClick={openNew}>+ {t("newSupplier")}</button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("supplier")}</th>
              <th>{t("phone")}</th>
              <th>{t("address")}</th>
              <th>{t("creditLimit")}</th>
              <th>{t("notes")}</th>
              <th>{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="empty">{t("loading")}</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={6} className="empty">{t("noSuppliers")}</td></tr>}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.name}</td>
                <td>{s.phone ?? "—"}</td>
                <td>{s.address ?? "—"}</td>
                <td>{s.credit_limit > 0 ? money(s.credit_limit) : "—"}</td>
                <td>{s.notes ?? "—"}</td>
                <td className="actions">
                  <button className="btn sm" onClick={() => openAccountStatement(s)}>{t("statement")}</button>
                  <button className="btn sm outline" onClick={() => openEdit(s)}>{t("edit")}</button>
                  <button className="btn sm danger" onClick={() => remove(s)}>{t("delete")}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? t("editSupplier") : t("newSupplier")} onClose={() => setShowForm(false)} width="520px">
          <form onSubmit={save} className="form-grid">
            <Field label={t("supplierName") + " *"}>
              <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label={t("phoneNumber")}>
              <input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t("address")}>
              <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label={t("creditLimit")}>
              <input type="number" min={0} step="0.01" value={form.credit_limit ?? 0} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} />
            </Field>
            <Field label={t("notes")}>
              <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="form-actions">
              <button type="submit" className="btn primary">{editing ? t("saveChanges") : t("addSupplier")}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>{t("cancel")}</button>
            </div>
          </form>
        </Modal>
      )}

      {showAccount && selected && accountSummary && (
        <Modal title={titleAccount} onClose={() => setShowAccount(false)} width="760px">
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button className={accountTab === "summary" ? "btn sm primary" : "btn sm"} onClick={() => setAccountTab("summary")}>{t("summaryLabel")}</button>
            <button className={accountTab === "detailed" ? "btn sm primary" : "btn sm"} onClick={() => setAccountTab("detailed")}>{t("detailedLabel")}</button>
            <button className="btn sm" onClick={printAccount}>🖨️ {t("print")}</button>
            <button className="btn sm" onClick={() => openVoucher("receipt")}>📥 {t("receiptVouchers")}</button>
            <button className="btn sm" onClick={() => openVoucher("payment")}>📤 {t("paymentVouchers")}</button>
          </div>

          <div ref={printRef}>
            <h2 style={{ textAlign: "center", margin: 0 }}>{t("supplierStatement")}</h2>
            <div style={{ textAlign: "center", color: "#6b7280", fontSize: 12, marginBottom: 16 }}>
              {settings?.store_name || "تبارك"} — {new Date().toLocaleDateString("ar-EG")}
            </div>

            {accountTab === "summary" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: 14, borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontSize: 12, color: "#065f46" }}>{t("totalPurchases")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#065f46" }}>{money(accountSummary.total_purchases)}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                  <div style={{ fontSize: 12, color: "#991b1b" }}>{t("purchaseReturns")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#991b1b" }}>{money(accountSummary.total_purchase_returns)}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <div style={{ fontSize: 12, color: "#1e40af" }}>{t("paymentsReceipts")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1e40af" }}>{money(accountSummary.total_paid)}</div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a" }}>
                  <div style={{ fontSize: 12, color: "#92400e" }}>{t("collectedAmounts")}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#92400e" }}>{money(accountSummary.total_received)}</div>
                </div>
                <div style={{ gridColumn: "1 / -1", padding: 16, borderRadius: 10, background: accountSummary.balance > 0 ? "#fef2f2" : "#f0fdf4", border: "1px solid " + (accountSummary.balance > 0 ? "#fecaca" : "#bbf7d0"), textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: accountSummary.balance > 0 ? "#991b1b" : "#065f46" }}>{t("currentBalance")}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: accountSummary.balance > 0 ? "#991b1b" : "#065f46" }}>{money(accountSummary.balance)}</div>
                </div>
              </div>
            )}

            {accountTab === "detailed" && (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("date")}</th>
                      <th>{t("description")}</th>
                      <th>{t("debit")}</th>
                      <th>{t("creditLabel")}</th>
                      <th>{t("notes")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 && <tr><td colSpan={5} className="empty">{t("noTransactions")}</td></tr>}
                    {transactions.map((t, i) => (
                      <tr key={i}>
                        <td>{fmtDate(t.date)}</td>
                        <td className="strong">{t.description}</td>
                        <td style={{ color: "#dc2626" }}>{t.debit > 0 ? money(t.debit) : "—"}</td>
                        <td style={{ color: "#16a34a" }}>{t.credit > 0 ? money(t.credit) : "—"}</td>
                        <td>{t.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showVoucher && selected && (
        <Modal title={showVoucher === "receipt" ? t("receiptVoucherTitleSupplier") : t("paymentVoucherTitleSupplier")} onClose={() => setShowVoucher(null)} width="420px">
          <div style={{ marginBottom: 12, padding: "8px 12px", borderRadius: 8, background: "#f3f4f6", fontSize: 13 }}>
            <strong>{selected.name}</strong>
          </div>
          <div className="form-grid">
            <Field label={t("date")}>
              <input type="date" value={voucherForm.date} onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })} />
            </Field>
            <Field label={t("amountRequired")}>
              <input type="number" min={0} step="0.01" value={voucherForm.amount} onChange={(e) => setVoucherForm({ ...voucherForm, amount: Number(e.target.value) })} autoFocus />
            </Field>
            <Field label={t("paymentMethod")}>
              <select value={voucherForm.payment_method} onChange={(e) => setVoucherForm({ ...voucherForm, payment_method: e.target.value })}>
                <option value="cash">{t("cash")}</option>
                <option value="card">{t("card")}</option>
                <option value="transfer">{t("bankTransfer")}</option>
              </select>
            </Field>
            <Field label={t("notes")}>
              <input value={voucherForm.notes} onChange={(e) => setVoucherForm({ ...voucherForm, notes: e.target.value })} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="btn primary" onClick={saveVoucher}>{t("saveVoucher")}</button>
            <button className="btn" onClick={() => setShowVoucher(null)}>{t("cancel")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
