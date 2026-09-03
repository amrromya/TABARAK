import { useState, useEffect } from "react";
import { t } from "../i18n";
import { api } from "../api";

interface TurnEntry {
  id: number;
  number: number;
  status: "waiting" | "serving" | "done";
  createdAt: string;
  doneAt?: string;
}

const STORAGE_KEY = "tabarak_customer_turns";

function loadTurns(): TurnEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveTurns(turns: TurnEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(turns));
}

export function CustomerTurns() {
  const [turns, setTurns] = useState<TurnEntry[]>(loadTurns);

  useEffect(() => {
    saveTurns(turns);
  }, [turns]);

  const total = turns.length;
  const waiting = turns.filter((t) => t.status === "waiting" || t.status === "serving").length;
  const done = turns.filter((t) => t.status === "done").length;
  const nextNumber = total > 0 ? Math.max(...turns.map((t) => t.number)) + 1 : 1;

  const addTurn = () => {
    const now = new Date();
    const entry: TurnEntry = {
      id: Date.now(),
      number: nextNumber,
      status: "waiting",
      createdAt: now.toLocaleString("ar-EG"),
    };
    setTurns([...turns, entry]);
    printNumber(entry);
  };

  const markDone = (id: number) => {
    setTurns((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, status: "done" as const, doneAt: new Date().toLocaleString("ar-EG") } : t
      )
    );
  };

  const callNext = () => {
    setTurns((prev) => {
      const serving = prev.find((t) => t.status === "serving");
      if (serving) {
        return prev.map((t) =>
          t.id === serving.id ? { ...t, status: "done" as const, doneAt: new Date().toLocaleString("ar-EG") } : t
        );
      }
      const nextWaiting = prev.find((t) => t.status === "waiting");
      if (nextWaiting) {
        return prev.map((t) =>
          t.id === nextWaiting.id ? { ...t, status: "serving" as const } : t
        );
      }
      return prev;
    });
  };

  const resetAll = () => {
    if (!confirm(t("turnsResetConfirm"))) return;
    setTurns([]);
  };

  const printNumber = async (entry: TurnEntry) => {
    try {
      await api.printTurnNumber(entry.number, getStoreName(), entry.createdAt);
    } catch (err) {
      console.error("Print error:", err);
    }
  };

  const getStoreName = (): string => {
    try {
      const raw = localStorage.getItem("tabarak_settings");
      if (raw) {
        const s = JSON.parse(raw);
        return s.store_name || "تبارك";
      }
    } catch {}
    return "تبارك";
  };

  const serving = turns.find((t) => t.status === "serving");

  return (
    <div className="page">
      <div className="page-head">
        <h1>🔄 {t("customerTurnsTitle")}</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          borderRadius: 16, padding: "20px 24px", color: "#fff",
          boxShadow: "0 4px 15px rgba(59,130,246,0.3)",
        }}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>📊 {t("turnsTotal")}</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{total}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          borderRadius: 16, padding: "20px 24px", color: "#fff",
          boxShadow: "0 4px 15px rgba(245,158,11,0.3)",
        }}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>⏳ {t("turnsWaiting")}</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{waiting}</div>
        </div>
        <div style={{
          background: "linear-gradient(135deg, #22c55e, #16a34a)",
          borderRadius: 16, padding: "20px 24px", color: "#fff",
          boxShadow: "0 4px 15px rgba(34,197,94,0.3)",
        }}>
          <div style={{ fontSize: 13, opacity: 0.9, marginBottom: 4 }}>✅ {t("turnsDone")}</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{done}</div>
        </div>
      </div>

      {serving && (
        <div style={{
          background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
          borderRadius: 16, padding: "20px 28px", marginBottom: 20, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 4px 15px rgba(139,92,246,0.3)",
        }}>
          <div style={{ fontSize: 15 }}>
            📢 {t("turnsNowServing")}: <span style={{ fontSize: 32, fontWeight: 800 }}>#{serving.number}</span>
          </div>
          <button onClick={() => markDone(serving.id)} style={{
            padding: "10px 24px", borderRadius: 10, border: "none",
            background: "#fff", color: "#7c3aed", fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>
            ✅ {t("turnsComplete")}
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <button onClick={addTurn} style={{
          padding: "12px 28px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
        }}>
          🖨️ {t("turnsPrintNew")}
        </button>
        <button onClick={callNext} style={{
          padding: "12px 28px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
        }}>
          ⏭️ {t("turnsCallNext")}
        </button>
        <button onClick={resetAll} style={{
          padding: "12px 28px", borderRadius: 12, border: "none",
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 12px rgba(239,68,68,0.3)",
        }}>
          🔄 {t("turnsReset")}
        </button>
      </div>

      {turns.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 20px", color: "#9ca3af",
          background: "#f9fafb", borderRadius: 16, border: "2px dashed #e5e7eb",
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔢</div>
          <div style={{ fontSize: 16 }}>{t("turnsEmpty")}</div>
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t("turnsNumber")}</th>
                <th>{t("turnsStatus")}</th>
                <th>{t("turnsCreatedAt")}</th>
                <th>{t("turnsActions")}</th>
              </tr>
            </thead>
            <tbody>
              {[...turns].reverse().map((turn, idx) => (
                <tr key={turn.id} style={turn.status === "serving" ? { background: "#f5f3ff" } : turn.status === "done" ? { background: "#f0fdf4", opacity: 0.7 } : {}}>
                  <td>{idx + 1}</td>
                  <td style={{ fontWeight: 700, fontSize: 18 }}>#{turn.number}</td>
                  <td>
                    {turn.status === "waiting" && (
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                        ⏳ {t("turnsStatusWaiting")}
                      </span>
                    )}
                    {turn.status === "serving" && (
                      <span style={{ background: "#ede9fe", color: "#5b21b6", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                        📢 {t("turnsStatusServing")}
                      </span>
                    )}
                    {turn.status === "done" && (
                      <span style={{ background: "#dcfce7", color: "#166534", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
                        ✅ {t("turnsStatusDone")}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: "#6b7280" }}>{turn.createdAt}</td>
                  <td>
                    {turn.status === "waiting" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn sm primary" onClick={() => {
                          setTurns((prev) => prev.map((t) => t.id === turn.id ? { ...t, status: "serving" as const } : t));
                        }}>
                          📢 {t("turnsCall")}
                        </button>
                        <button className="btn sm" onClick={() => markDone(turn.id)}>
                          ✅ {t("turnsDoneBtn")}
                        </button>
                      </div>
                    )}
                    {turn.status === "serving" && (
                      <button className="btn sm primary" onClick={() => markDone(turn.id)}>
                        ✅ {t("turnsComplete")}
                      </button>
                    )}
                    {turn.status === "done" && (
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>{turn.doneAt}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
