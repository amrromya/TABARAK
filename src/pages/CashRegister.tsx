import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Modal, confirmDialog, money, useToast } from "../components/ui";
import { t } from "../i18n";
import type { CashRegisterSession, CashSessionSummary } from "../types";

type Tab = "current" | "history";

const MOVEMENT_LABELS: Record<string, string> = {
  sale_cash: "بيع نقدي",
  sale_return: "مرتجع نقدي",
  deposit: "إيداع",
  withdrawal: "سحب",
  opening: "رصيد افتتاحي",
  adjustment: "تسوية",
};

export function CashRegister() {
  const [tab, setTab] = useState<Tab>("current");
  const [summary, setSummary] = useState<CashSessionSummary | null>(null);
  const [sessions, setSessions] = useState<CashRegisterSession[]>([]);

  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);

  const [openingBal, setOpeningBal] = useState(0);
  const [closingBal, setClosingBal] = useState(0);
  const [actualCash, setActualCash] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [depositDesc, setDepositDesc] = useState("");
  const [withdrawalAmount, setWithdrawalAmount] = useState(0);
  const [withdrawalDesc, setWithdrawalDesc] = useState("");

  const notify = useToast();

  const loadSummary = useCallback(async () => {
    try {
      const s = await api.getCashSessionSummary();
      setSummary(s);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  const loadSessions = useCallback(async () => {
    try {
      setSessions(await api.listCashSessions());
    } catch (e) {
      notify(String(e), "error");
    }
  }, [notify]);

  const load = useCallback(async () => {
    await Promise.all([loadSummary(), loadSessions()]);
  }, [loadSummary, loadSessions]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    try {
      await api.openCashRegister(openingBal);
      notify(t("sessionOpened"));
      setShowOpen(false);
      setOpeningBal(0);
      await load();
    } catch (e) { notify(String(e), "error"); }
  };

  const handleClose = async () => {
    if (!confirmDialog(t("confirmClose"))) return;
    try {
      await api.closeCashRegister(closingBal, actualCash);
      notify(t("sessionClosed"));
      setShowClose(false);
      setClosingBal(0);
      setActualCash(0);
      await load();
    } catch (e) { notify(String(e), "error"); }
  };

  const handleDeposit = async () => {
    if (depositAmount <= 0) { notify("المبلغ يجب أن يكون أكبر من صفر", "error"); return; }
    try {
      await api.addCashMovement({ type: "deposit", amount: depositAmount, description: depositDesc || "إيداع" });
      notify(t("addDeposit"));
      setShowDeposit(false);
      setDepositAmount(0);
      setDepositDesc("");
      await load();
    } catch (e) { notify(String(e), "error"); }
  };

  const handleWithdrawal = async () => {
    if (withdrawalAmount <= 0) { notify("المبلغ يجب أن يكون أكبر من صفر", "error"); return; }
    try {
      await api.addCashMovement({ type: "withdrawal", amount: -withdrawalAmount, description: withdrawalDesc || "سحب" });
      notify(t("addWithdrawal"));
      setShowWithdrawal(false);
      setWithdrawalAmount(0);
      setWithdrawalDesc("");
      await load();
    } catch (e) { notify(String(e), "error"); }
  };

  const session = summary?.session;
  const isOpen = session?.status === "open";
  const diff = summary ? actualCash - summary.expected_cash : 0;

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t("cashRegister")}</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {!isOpen && (
            <button className="btn primary" onClick={() => setShowOpen(true)}>
              {t("openCashRegister")}
            </button>
          )}
          {isOpen && (
            <>
              <button className="btn" onClick={() => setShowDeposit(true)}>
                {t("addDeposit")}
              </button>
              <button className="btn" onClick={() => setShowWithdrawal(true)}>
                {t("addWithdrawal")}
              </button>
              <button className="btn" style={{ background: "#ef4444", color: "#fff" }} onClick={() => { setClosingBal(summary?.expected_cash ?? 0); setActualCash(0); setShowClose(true); }}>
                {t("closeCashRegister")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tabs" style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        <button className={`tab ${tab === "current" ? "active" : ""}`} onClick={() => setTab("current")}>{t("sessionSummary")}</button>
        <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>{t("cashRegisterHistory")}</button>
      </div>

      {tab === "current" && (
        <>
          {!isOpen ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🏧</div>
              <p style={{ fontSize: 16, margin: 0 }}>{t("noOpenSession")}</p>
              <p style={{ fontSize: 13, margin: "8px 0 0" }}>{t("openCashRegister")} للبدء</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div className="stat-card">
                <div className="stat-label">{t("openingBalanceLabel")}</div>
                <div className="stat-value">{money(session!.opening_balance)}</div>
                <div className="stat-sub">{session!.opened_at}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t("totalIn")}</div>
                <div className="stat-value green">{money(summary?.total_in ?? 0)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">{t("totalOut")}</div>
                <div className="stat-value red">{money(summary?.total_out ?? 0)}</div>
              </div>
              <div className="stat-card" style={{ border: "2px solid #0f8a5f" }}>
                <div className="stat-label">{t("expectedCash")}</div>
                <div className="stat-value" style={{ color: "#0f8a5f" }}>{money(summary?.expected_cash ?? 0)}</div>
              </div>
            </div>
          )}

          {isOpen && summary && summary.movements.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "#374151" }}>{t("cashMovements")}</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t("movementType")}</th>
                      <th>{t("movementAmount")}</th>
                      <th>{t("movementDescription")}</th>
                      <th>{t("movementDate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.movements.map((m) => (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td>{MOVEMENT_LABELS[m.type] || m.type}</td>
                        <td style={{ color: m.amount >= 0 ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                          {m.amount >= 0 ? "+" : ""}{money(m.amount)}
                        </td>
                        <td>{m.description || "—"}</td>
                        <td>{m.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t("sessionStatus")}</th>
                <th>{t("openingBalanceLabel")}</th>
                <th>{t("closingBalanceLabel")}</th>
                <th>{t("actualCashLabel")}</th>
                <th>{t("differenceLabel")}</th>
                <th>{t("openedAt")}</th>
                <th>{t("closedAt")}</th>
                <th>{t("openedBy")}</th>
                <th>{t("closedBy")}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const expected = s.opening_balance;
                const d = (s.actual_cash ?? 0) - expected;
                return (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>
                      <span style={{
                        padding: "2px 8px", borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: s.status === "open" ? "#dcfce7" : "#f3f4f6",
                        color: s.status === "open" ? "#16a34a" : "#6b7280",
                      }}>
                        {s.status === "open" ? t("sessionOpen") : t("sessionClosedLabel")}
                      </span>
                    </td>
                    <td>{money(s.opening_balance)}</td>
                    <td>{s.closing_balance != null ? money(s.closing_balance) : "—"}</td>
                    <td>{s.actual_cash != null ? money(s.actual_cash) : "—"}</td>
                    <td style={{ color: d > 0 ? "#16a34a" : d < 0 ? "#dc2626" : "#6b7280", fontWeight: 600 }}>
                      {s.actual_cash != null ? (d > 0 ? `+${money(d)}` : d < 0 ? money(d) : `= ${money(0)}`) : "—"}
                    </td>
                    <td>{s.opened_at}</td>
                    <td>{s.closed_at || "—"}</td>
                    <td>{s.opened_by || "—"}</td>
                    <td>{s.closed_by || "—"}</td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>لا توجد جلسات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Open Register Modal */}
      {showOpen && (
        <Modal title={t("openCashRegister")} onClose={() => setShowOpen(false)}>
          <div className="form-grid">
            <div className="field">
              <label>{t("openingBalanceLabel")}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={openingBal || ""}
                placeholder="0"
                onChange={(e) => setOpeningBal(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={handleOpen}>{t("openCashRegister")}</button>
              <button className="btn" onClick={() => setShowOpen(false)}>{t("cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Register Modal */}
      {showClose && (
        <Modal title={t("closeCashRegister")} onClose={() => setShowClose(false)}>
          <div className="form-grid">
            <div className="field">
              <label>{t("closingBalanceLabel")} ({t("expectedCash")})</label>
              <input type="number" value={summary?.expected_cash ?? 0} readOnly style={{ background: "#f3f4f6" }} />
            </div>
            <div className="field">
              <label>{t("actualCashLabel")} *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={actualCash || ""}
                placeholder="0"
                onChange={(e) => setActualCash(Number(e.target.value))}
                autoFocus
              />
            </div>
            {actualCash > 0 && (
              <div style={{
                padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600,
                background: diff === 0 ? "#f0fdf4" : diff > 0 ? "#eff6ff" : "#fef2f2",
                color: diff === 0 ? "#16a34a" : diff > 0 ? "#2563eb" : "#dc2626",
                textAlign: "center",
              }}>
                {diff === 0 && `✅ ${t("balanced")}`}
                {diff > 0 && `📈 ${t("surplus")}: +${money(diff)}`}
                {diff < 0 && `📉 ${t("deficit")}: ${money(diff)}`}
              </div>
            )}
            <div className="form-actions">
              <button className="btn primary" style={{ background: "#ef4444" }} onClick={handleClose}>{t("closeCashRegister")}</button>
              <button className="btn" onClick={() => setShowClose(false)}>{t("cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <Modal title={t("addDeposit")} onClose={() => setShowDeposit(false)}>
          <div className="form-grid">
            <div className="field">
              <label>{t("depositAmount")} *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={depositAmount || ""}
                placeholder="0"
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>{t("movementDescription")}</label>
              <input
                value={depositDesc}
                placeholder="اختياري"
                onChange={(e) => setDepositDesc(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button className="btn primary" onClick={handleDeposit}>{t("addDeposit")}</button>
              <button className="btn" onClick={() => setShowDeposit(false)}>{t("cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Withdrawal Modal */}
      {showWithdrawal && (
        <Modal title={t("addWithdrawal")} onClose={() => setShowWithdrawal(false)}>
          <div className="form-grid">
            <div className="field">
              <label>{t("withdrawalAmount")} *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={withdrawalAmount || ""}
                placeholder="0"
                onChange={(e) => setWithdrawalAmount(Number(e.target.value))}
                autoFocus
              />
            </div>
            <div className="field">
              <label>{t("movementDescription")}</label>
              <input
                value={withdrawalDesc}
                placeholder="اختياري"
                onChange={(e) => setWithdrawalDesc(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button className="btn primary" style={{ background: "#ef4444" }} onClick={handleWithdrawal}>{t("addWithdrawal")}</button>
              <button className="btn" onClick={() => setShowWithdrawal(false)}>{t("cancel")}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
