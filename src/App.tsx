import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ToastProvider } from "./components/ui";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { Warehouses } from "./pages/Warehouses";
import { Sales } from "./pages/Sales";
import { Purchases } from "./pages/Purchases";
import { Expenses } from "./pages/Expenses";
import { Customers } from "./pages/Customers";
import { Employees } from "./pages/Employees";
import { Reports } from "./pages/Reports";
import { SettingsPage } from "./pages/SettingsPage";
import { Pos } from "./pages/Pos";
import { PurchasePos } from "./pages/PurchasePos";
import { StockCount } from "./pages/StockCount";
import { StockCounts } from "./pages/StockCounts";
import { Attendance } from "./pages/Attendance";
import { SplashScreen } from "./components/SplashScreen";
import { AutoLogin } from "./components/AutoLogin";
import { LoginScreen } from "./components/LoginScreen";
import { MaintenanceDashboard } from "./pages/maintenance/MaintenanceDashboard";
import { ServiceOrders } from "./pages/maintenance/ServiceOrders";
import { NewServiceOrder } from "./pages/maintenance/NewServiceOrder";
import { ServiceOrderDetail } from "./pages/maintenance/ServiceOrderDetail";
import { MaintenanceSettings } from "./pages/maintenance/MaintenanceSettings";
import { MaintenanceReports } from "./pages/maintenance/MaintenanceReports";
import { MaintenanceCustomers } from "./pages/maintenance/MaintenanceCustomers";
import { MaintenanceTechnicians } from "./pages/maintenance/MaintenanceTechnicians";
import { ReceiptVouchers } from "./pages/ReceiptVouchers";
import { PaymentVouchers } from "./pages/PaymentVouchers";
import { WarehouseTransfers } from "./pages/WarehouseTransfers";
import { Activation } from "./pages/Activation";
import type { Account } from "./types";
import { api } from "./api";

const NAV = [
  { key: "dashboard", label: "لوحة التحكم", icon: "🏠" },
  { key: "inventory", label: "المخزون", icon: "📦" },
  { key: "warehouses", label: "المستودعات", icon: "🏬" },
  { key: "purchases", label: "سجل المشتريات", icon: "📦" },
  { key: "customers", label: "العملاء والديون", icon: "🤝" },
  { key: "employees", label: "الموظفين", icon: "👥" },
  { key: "attendance", label: "الحضور والانصراف", icon: "🕐" },
  { key: "expenses", label: "المصروفات", icon: "🧾" },
  { key: "sales", label: "سجل المبيعات", icon: "🧾" },
  { key: "reports", label: "التقارير", icon: "📈" },
  { key: "settings", label: "الإعدادات", icon: "⚙️" },
];

const POS_WINDOWS: Record<string, { title: string }> = {
  "sales-pos": { title: "فاتورة مبيعات - تبارك" },
  "purchase-pos": { title: "فاتورة مشتريات - تبارك" },
  "count-pos": { title: "فاتورة جرد مؤقت - تبارك" },
  "counts-list": { title: "سجل فواتير الجرد - تبارك" },
};

const opening = new Set<string>();

async function openTool(label: string, pendingKey?: string, pendingValue?: number, urlSuffix?: string) {
  if (opening.has(label)) return;
  if (pendingValue != null && pendingKey) {
    localStorage.setItem(pendingKey, String(pendingValue));
  }
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await existing.close();
  }
  opening.add(label);
  const url = urlSuffix ? `index.html#${urlSuffix}` : undefined;
  new WebviewWindow(label, {
    url,
    title: POS_WINDOWS[label].title,
    width: 1100,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    center: true,
  });
  window.setTimeout(() => opening.delete(label), 1500);
}

async function openPosWindow(label: string, openSaleId?: number, account?: Account) {
  const accountJson = account ? JSON.stringify(account) : "";
  const params = new URLSearchParams();
  params.set("popup", "1");
  if (openSaleId) params.set("sale", String(openSaleId));
  if (accountJson) params.set("account", accountJson);
  await openTool(label, "tabarak_open_sale", openSaleId, params.toString());
}

async function openCountWindow(countId?: number, account?: Account) {
  const accountJson = account ? JSON.stringify(account) : "";
  const params = new URLSearchParams();
  params.set("popup", "1");
  if (countId) params.set("count", String(countId));
  if (accountJson) params.set("account", accountJson);
  await openTool("count-pos", "tabarak_open_count", countId, params.toString());
}

async function openCountsWindow(account?: Account) {
  const accountJson = account ? JSON.stringify(account) : "";
  const params = new URLSearchParams();
  params.set("popup", "1");
  if (accountJson) params.set("account", accountJson);
  await openTool("counts-list", undefined, undefined, params.toString());
}

function Shell({ account }: { account: Account }) {
  const [page, setPage] = useState("dashboard");
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail;
      if (id) setPage("maint_detail_" + id);
    };
    window.addEventListener("navigate-maint-detail", handler);
    return () => window.removeEventListener("navigate-maint-detail", handler);
  }, []);

  useEffect(() => {
    api.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;

    const autoSyncTick = async () => {
      if (running) return;
      try {
        const status = await api.getSyncStatus();
        if (!status.config.auto_sync || !status.config.supabase_url) return;
        if (status.pending_push === 0 && status.conflicts.length === 0) return;
        running = true;
        await api.syncNow();
      } catch {}
      finally { running = false; }
    };

    const startTimer = async () => {
      try {
        const status = await api.getSyncStatus();
        if (status.config.auto_sync && status.config.supabase_url) {
          const secs = Math.max(status.config.sync_interval_secs || 30, 10);
          timer = setInterval(autoSyncTick, secs * 1000);
        }
      } catch {}
    };

    startTimer();
    return () => { if (timer) clearInterval(timer); };
  }, []);
  
  let label = "main";
  try {
    const w = getCurrentWindow();
    label = w.label;
  } catch (e) {
    console.warn("Failed to get current window label:", e);
  }

  if (label === "sales-pos") {
    return <Pos onBack={() => getCurrentWindow().close()} />;
  }

  if (label === "purchase-pos") {
    return <PurchasePos onBack={() => getCurrentWindow().close()} />;
  }

  if (label === "count-pos") {
    return <StockCount onBack={() => getCurrentWindow().close()} />;
  }

  if (label === "counts-list") {
    return (
      <StockCounts
        onBack={() => getCurrentWindow().close()}
        onEditCount={(id) => openCountWindow(id)}
      />
    );
  }

  const canAccess = (menuKey: string) => {
    if (!account || !account.visibleMenus) return false;
    return account.visibleMenus.includes(menuKey);
  };

  const navClick = (n: (typeof NAV)[number]) => {
    setPage(n.key);
  };

  const visibleNav = NAV.filter((n) => {
    return canAccess(n.key);
  });

  const allowedPages = visibleNav.map((n) => n.key);
  const isDetailPage = page.startsWith("maint_detail_");
  const isMaintPage = page.startsWith("maint_");
  const isAccountingPage = ["receipt_vouchers", "payment_vouchers", "warehouse_transfers"].includes(page);
  const safePage = isDetailPage ? page : (allowedPages.includes(page) || isMaintPage || isAccountingPage ? page : allowedPages[0] ?? "dashboard");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <img src="/app.png" alt="تبارك" className="logo-mark-img" />
          <div>
            <h1>تبارك</h1>
            <p>برنامج الحسابات</p>
            {account && (
              <span className="account-badge">👤 {account.name}</span>
            )}
          </div>
        </div>
        <nav>
          {visibleNav.map((n) => (
              <button
                key={n.key}
                className={`nav-item ${page === n.key ? "active" : ""}`}
                onClick={() => navClick(n)}
              >
                <span className="nav-icon">{n.icon}</span>
                <span>{n.label}</span>
              </button>
          ))}
        </nav>
        {account && (
          <div className="sidebar-footer">
            <button className="nav-item logout-btn" onClick={() => window.location.reload()}>
              <span className="nav-icon">🚪</span>
              <span>خروج</span>
            </button>
            <div className="sidebar-version">
              <span>الإصدار {appVersion || "—"}</span>
              <span>إعداد وتطوير المهندس/ عمرو روميه</span>
            </div>
          </div>
        )}
      </aside>
      <main className="content">
        {safePage === "dashboard" && <Dashboard onNavigate={setPage} onOpenPos={(label) => openPosWindow(label, undefined, account)} />}
        {safePage === "inventory" && (
          <Inventory
            onOpenCount={() => openCountWindow(undefined, account)}
            onOpenCounts={() => openCountsWindow(account)}
          />
        )}
        {safePage === "warehouses" && <Warehouses />}
        {safePage === "sales" && (
          <Sales
            onViewSale={(id) => openPosWindow("sales-pos", id, account)}
            onNewSale={() => openPosWindow("sales-pos", undefined, account)}
          />
        )}
        {safePage === "purchases" && (
          <Purchases
            onNewPurchase={() => openPosWindow("purchase-pos", undefined, account)}
          />
        )}
        {safePage === "customers" && (
          <Customers
            onViewSale={(id) => openPosWindow("sales-pos", id, account)}
          />
        )}
        {safePage === "employees" && <Employees />}
        {safePage === "attendance" && <Attendance />}
        {safePage === "expenses" && <Expenses />}
        {safePage === "receipt_vouchers" && <ReceiptVouchers />}
        {safePage === "payment_vouchers" && <PaymentVouchers />}
        {safePage === "warehouse_transfers" && <WarehouseTransfers />}
        {safePage === "reports" && <Reports />}
        {safePage === "settings" && <SettingsPage />}
        {safePage === "maint_dashboard" && <MaintenanceDashboard />}
        {safePage === "maint_new" && <NewServiceOrder onDone={(id) => setPage("maint_detail_" + id)} />}
        {safePage === "maint_orders" && <ServiceOrders onNew={() => setPage("maint_new")} onView={(id) => setPage("maint_detail_" + id)} />}
        {safePage === "maint_settings" && <MaintenanceSettings />}
        {safePage === "maint_customers" && <MaintenanceCustomers />}
        {safePage === "maint_techs" && <MaintenanceTechnicians />}
        {safePage === "maint_reports" && <MaintenanceReports />}
        {safePage.startsWith("maint_detail_") && <ServiceOrderDetail orderId={Number(safePage.replace("maint_detail_", ""))} onBack={() => setPage("maint_orders")} />}
      </main>
    </div>
  );
}

function App() {
  const windowLabel = (() => {
    try { return getCurrentWindow().label; } catch { return "main"; }
  })();
  const isPopup = window.location.hash.includes("popup=") || windowLabel !== "main";

  const [loading, setLoading] = useState(!isPopup);
  const [authenticated, setAuthenticated] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [licenseActive, setLicenseActive] = useState(isPopup);

  const handleSplashFinish = () => {
    api.checkLicense()
      .then(() => {
        setLicenseActive(true);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  const handleLogin = (acc: Account) => {
    setAccount(acc);
    setAuthenticated(true);
  };

  if (loading) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (!licenseActive) {
    return <Activation onActivated={() => setLicenseActive(true)} />;
  }

  if (!authenticated || !account) {
    if (isPopup) {
      return <AutoLogin onLogin={handleLogin} />;
    }
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <Shell account={account} />
    </ToastProvider>
  );
}

export default App;
