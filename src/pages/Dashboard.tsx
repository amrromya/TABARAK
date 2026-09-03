import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate, money, today, useToast } from "../components/ui";
import { t } from "../i18n";
import type { Dashboard as DashboardData } from "../types";

const FEATURES_KEY = "tabarak_features";

function getFeatures(): { maintenance: boolean; attendance: boolean; dark_mode: boolean; language: boolean; cash_register: boolean; customer_turns: boolean } {
  try {
    const raw = localStorage.getItem("tabarak_features");
    if (raw) return { maintenance: false, attendance: false, dark_mode: false, language: false, cash_register: false, customer_turns: false, ...JSON.parse(raw) };
  } catch {}
  return { maintenance: false, attendance: false, dark_mode: false, language: false, cash_register: false, customer_turns: false };
}

export function Dashboard({ onNavigate, onOpenPos }: { onNavigate: (page: string) => void; onOpenPos: (type: "sales-pos" | "purchase-pos") => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [showAccounting, setShowAccounting] = useState(false);
  const [features, setFeatures] = useState(getFeatures());
  const notify = useToast();

  useEffect(() => {
    const load = () =>
      api
        .getDashboard()
        .then(setData)
        .catch((e) => notify(String(e), "error"));
    load();
    const t = setInterval(load, 60000);

    const onStorage = (e: StorageEvent) => {
      if (e.key === FEATURES_KEY) setFeatures(getFeatures());
    };
    window.addEventListener("storage", onStorage);

    const onFocus = () => setFeatures(getFeatures());
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [notify]);

  const cards = [
    {
      label: t("todaySales"),
      value: money(data?.today_sales ?? 0),
      icon: "💰",
      cls: "green",
      page: "sales",
    },
    {
      label: t("todayProfit"),
      value: money(data?.today_profit ?? 0),
      icon: "📈",
      cls: "teal",
      page: "reports",
    },
    {
      label: t("todayPurchases"),
      value: money(data?.today_purchases ?? 0),
      icon: "📦",
      cls: "blue",
      page: "purchases",
    },
    {
      label: t("todayExpenses"),
      value: money(data?.today_expenses ?? 0),
      icon: "🧾",
      cls: "amber",
      page: "expenses",
    },
    {
      label: t("totalDebts"),
      value: money(data?.total_debts ?? 0),
      icon: "🤝",
      cls: "purple",
      page: "customers",
    },
    {
      label: t("cashInHand"),
      value: money(data?.cash_in_hand ?? 0),
      icon: "💵",
      cls: "blue",
      page: "reports",
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>{t("dashboard")}</h1>
        <span className="date-badge">{fmtDate(today())}</span>
      </div>

      <div className="quick-actions">
        <button className="quick-action-card sales-action" onClick={() => onOpenPos("sales-pos")}>
          <div className="qa-icon-wrap sales-icon-bg">
            <span className="qa-icon">🛒</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">{t("newSaleInvoice")}</span>
            <span className="qa-desc">{t("newSaleDesc")}</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        <button className="quick-action-card purchase-action" onClick={() => onOpenPos("purchase-pos")}>
          <div className="qa-icon-wrap purchase-icon-bg">
            <span className="qa-icon">🚚</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">{t("newPurchaseInvoice")}</span>
            <span className="qa-desc">{t("newPurchaseDesc")}</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        <button className="quick-action-card accounting-action" onClick={() => setShowAccounting(true)}>
          <div className="qa-icon-wrap accounting-icon-bg">
            <span className="qa-icon">💰</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">{t("accountingAction")}</span>
            <span className="qa-desc">{t("accountingDesc")}</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        {features.maintenance && (
        <button className="quick-action-card maintenance-action" onClick={() => onNavigate("maint_home")}>
          <div className="qa-icon-wrap maintenance-icon-bg">
            <span className="qa-icon">🔧</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">{t("maintenanceAction")}</span>
            <span className="qa-desc">{t("maintenanceDesc")}</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        )}
      </div>

      {showAccounting && (
        <div className="modal-overlay" onClick={() => setShowAccounting(false)}>
          <div className="modal accounting-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>💰 {t("accountingAction")}</h2>
              <button className="modal-close" onClick={() => setShowAccounting(false)}>✕</button>
            </div>
            <div className="accounting-grid">
              <button className="accounting-card ac-receipts" onClick={() => { setShowAccounting(false); onNavigate("receipt_vouchers"); }}>
                <div className="ac-icon-wrap">📥</div>
                <div className="ac-info">
                  <span className="ac-title">{t("receiptVouchersAction")}</span>
                  <span className="ac-desc">{t("receiptVouchersDesc")}</span>
                </div>
                <span className="ac-arrow">←</span>
              </button>
              <button className="accounting-card ac-payments" onClick={() => { setShowAccounting(false); onNavigate("payment_vouchers"); }}>
                <div className="ac-icon-wrap">📤</div>
                <div className="ac-info">
                  <span className="ac-title">{t("paymentVouchersAction")}</span>
                  <span className="ac-desc">{t("paymentVouchersDesc")}</span>
                </div>
                <span className="ac-arrow">←</span>
              </button>
              <button className="accounting-card ac-transfers" onClick={() => { setShowAccounting(false); onNavigate("warehouse_transfers"); }}>
                <div className="ac-icon-wrap">🔄</div>
                <div className="ac-info">
                  <span className="ac-title">{t("warehouseTransfersAction")}</span>
                  <span className="ac-desc">{t("warehouseTransfersDesc")}</span>
                </div>
                <span className="ac-arrow">←</span>
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="cards-grid">
        {cards.map((c) => (
          <button
            key={c.label}
            className={`card ${c.cls}`}
            onClick={() => onNavigate(c.page)}
          >
            <div className="card-icon">{c.icon}</div>
            <div>
              <div className="card-value">{c.value}</div>
              <div className="card-label">{c.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{data?.product_count ?? 0}</div>
          <div className="stat-label">{t("totalProducts")}</div>
        </div>
        <div className="stat-box warn">
          <div className="stat-value">{data?.low_stock_count ?? 0}</div>
          <div className="stat-label">{t("lowStock")}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.recent_sales_count ?? 0}</div>
          <div className="stat-label">{t("todayInvoices")}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.total_suppliers ?? 0}</div>
          <div className="stat-label">{t("totalSuppliers")}</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.total_customers ?? 0}</div>
          <div className="stat-label">{t("totalCustomers")}</div>
        </div>
      </div>

      {data && data.low_stock_count > 0 && (
        <div className="notice">
          <span>⚠️</span>
          <p>
            {t("lowStockNotice")}{" "}
            <a onClick={() => onNavigate("inventory")}>{t("reviewInventory")}</a>
          </p>
        </div>
      )}
      {data && data.total_debts > 0 && (
        <div className="notice debts">
          <span>🤝</span>
          <p>
            {t("debtsNotice")} <b>{money(data.total_debts)}</b>.{" "}
            <a onClick={() => onNavigate("customers")}>{t("followCustomers")}</a>
          </p>
        </div>
      )}
    </div>
  );
}
