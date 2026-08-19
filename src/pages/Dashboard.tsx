import { useEffect, useState } from "react";
import { api } from "../api";
import { fmtDate, money, today, useToast } from "../components/ui";
import type { Dashboard as DashboardData } from "../types";

const FEATURES_KEY = "tabarak_features";

function getFeatures(): { maintenance: boolean; attendance: boolean } {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { maintenance: false, attendance: false };
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
      label: "مبيعات اليوم",
      value: money(data?.today_sales ?? 0),
      icon: "💰",
      cls: "green",
      page: "sales",
    },
    {
      label: "ربح اليوم",
      value: money(data?.today_profit ?? 0),
      icon: "📈",
      cls: "teal",
      page: "reports",
    },
    {
      label: "مشتريات اليوم",
      value: money(data?.today_purchases ?? 0),
      icon: "📦",
      cls: "blue",
      page: "purchases",
    },
    {
      label: "مصروفات اليوم",
      value: money(data?.today_expenses ?? 0),
      icon: "🧾",
      cls: "amber",
      page: "expenses",
    },
    {
      label: "الديون المستحقة",
      value: money(data?.total_debts ?? 0),
      icon: "🤝",
      cls: "purple",
      page: "customers",
    },
    {
      label: "رصيد الصندوق",
      value: money(data?.cash_in_hand ?? 0),
      icon: "💵",
      cls: "blue",
      page: "reports",
    },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>لوحة التحكم</h1>
        <span className="date-badge">{fmtDate(today())}</span>
      </div>

      <div className="quick-actions">
        <button className="quick-action-card sales-action" onClick={() => onOpenPos("sales-pos")}>
          <div className="qa-icon-wrap sales-icon-bg">
            <span className="qa-icon">🛒</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">فاتورة مبيعات جديدة</span>
            <span className="qa-desc">إضافة فاتورة بيع سريعة</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        <button className="quick-action-card purchase-action" onClick={() => onOpenPos("purchase-pos")}>
          <div className="qa-icon-wrap purchase-icon-bg">
            <span className="qa-icon">🚚</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">فاتورة مشتريات جديدة</span>
            <span className="qa-desc">إضافة فاتورة شراء سريعة</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        <button className="quick-action-card accounting-action" onClick={() => setShowAccounting(true)}>
          <div className="qa-icon-wrap accounting-icon-bg">
            <span className="qa-icon">💰</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">الحسابات</span>
            <span className="qa-desc">سندات القبض والصرف والتحويلات</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        {features.maintenance && (
        <button className="quick-action-card maintenance-action" onClick={() => onNavigate("maint_home")}>
          <div className="qa-icon-wrap maintenance-icon-bg">
            <span className="qa-icon">🔧</span>
          </div>
          <div className="qa-content">
            <span className="qa-title">الصيانة</span>
            <span className="qa-desc">أوامر الصيانة وال الفنيين</span>
          </div>
          <span className="qa-arrow">←</span>
        </button>
        )}
      </div>

      {showAccounting && (
        <div className="modal-overlay" onClick={() => setShowAccounting(false)}>
          <div className="modal accounting-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>💰 الحسابات</h2>
              <button className="modal-close" onClick={() => setShowAccounting(false)}>✕</button>
            </div>
            <div className="accounting-grid">
              <button className="accounting-card ac-receipts" onClick={() => { setShowAccounting(false); onNavigate("receipt_vouchers"); }}>
                <div className="ac-icon-wrap">📥</div>
                <div className="ac-info">
                  <span className="ac-title">سندات القبض</span>
                  <span className="ac-desc">تسجيل المبالغ المحصلة من العملاء</span>
                </div>
                <span className="ac-arrow">←</span>
              </button>
              <button className="accounting-card ac-payments" onClick={() => { setShowAccounting(false); onNavigate("payment_vouchers"); }}>
                <div className="ac-icon-wrap">📤</div>
                <div className="ac-info">
                  <span className="ac-title">سندات الصرف</span>
                  <span className="ac-desc">تسجيل المبالغ المصروفة للموردين</span>
                </div>
                <span className="ac-arrow">←</span>
              </button>
              <button className="accounting-card ac-transfers" onClick={() => { setShowAccounting(false); onNavigate("warehouse_transfers"); }}>
                <div className="ac-icon-wrap">🔄</div>
                <div className="ac-info">
                  <span className="ac-title">تحويلات المستودعات</span>
                  <span className="ac-desc">نقل البضائع بين المستودعات</span>
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
          <div className="stat-label">إجمالي المنتجات</div>
        </div>
        <div className="stat-box warn">
          <div className="stat-value">{data?.low_stock_count ?? 0}</div>
          <div className="stat-label">منتجات منخفضة المخزون</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.recent_sales_count ?? 0}</div>
          <div className="stat-label">فواتير اليوم</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.total_suppliers ?? 0}</div>
          <div className="stat-label">عدد الموردين</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{data?.total_customers ?? 0}</div>
          <div className="stat-label">عدد العملاء</div>
        </div>
      </div>

      {data && data.low_stock_count > 0 && (
        <div className="notice">
          <span>⚠️</span>
          <p>
            يوجد <b>{data.low_stock_count}</b> منتج وصل أو انخفض عن حد الطلب الأدنى.{" "}
            <a onClick={() => onNavigate("inventory")}>مراجعة المخزون</a>
          </p>
        </div>
      )}
      {data && data.total_debts > 0 && (
        <div className="notice debts">
          <span>🤝</span>
          <p>
            إجمالي الديون المستحقة عليك تحصيلها: <b>{money(data.total_debts)}</b>.{" "}
            <a onClick={() => onNavigate("customers")}>متابعة العملاء</a>
          </p>
        </div>
      )}
    </div>
  );
}
