import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ToastProvider } from "./components/ui";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useTheme } from "./hooks/useTheme";
import { initLang, setLang, getLang, t } from "./i18n";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
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
import { FullInventoryCount } from "./pages/FullInventoryCount";
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
import { MaintenanceHome } from "./pages/maintenance/MaintenanceHome";
import { ReceiptVouchers } from "./pages/ReceiptVouchers";
import { PaymentVouchers } from "./pages/PaymentVouchers";
import { WarehouseTransfers } from "./pages/WarehouseTransfers";
import { SuppliersPage } from "./pages/SuppliersPage";
import { Activation } from "./pages/Activation";
import type { Account } from "./types";
import { api } from "./api";

const NAV = [
  { key: "dashboard", labelKey: "dashboard", icon: "🏠" },
  { key: "inventory", labelKey: "inventory", icon: "📦" },
  { key: "warehouses", labelKey: "warehouses", icon: "🏬" },
  { key: "purchases", labelKey: "purchases", icon: "📦" },
  { key: "suppliers", labelKey: "suppliers", icon: "🚚" },
  { key: "customers", labelKey: "customers", icon: "🤝" },
  { key: "employees", labelKey: "employees", icon: "👥" },
  { key: "attendance", labelKey: "attendance", icon: "🕐" },
  { key: "expenses", labelKey: "expenses", icon: "🧾" },
  { key: "sales", labelKey: "sales", icon: "🧾" },
  { key: "reports", labelKey: "reports", icon: "📈" },
  { key: "settings", labelKey: "settings", icon: "⚙️" },
];

const POS_WINDOWS: Record<string, { title: string }> = {
  "sales-pos": { title: "فاتورة مبيعات - تبارك" },
  "purchase-pos": { title: "فاتورة مشتريات - تبارك" },
  "count-pos": { title: "فاتورة جرد مؤقت - تبارك" },
  "counts-list": { title: "سجل فواتير الجرد - تبارك" },
  "full-count": { title: "جرد كلي - تبارك" },
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

async function openFullCountWindow(account?: Account) {
  const accountJson = account ? JSON.stringify(account) : "";
  const params = new URLSearchParams();
  params.set("popup", "1");
  if (accountJson) params.set("account", accountJson);
  await openTool("full-count", undefined, undefined, params.toString());
}

function Shell({ account, theme, toggleTheme }: { account: Account; theme: "light" | "dark"; toggleTheme: () => void }) {
  const [page, setPage] = useState("dashboard");
  const [appVersion, setAppVersion] = useState("");
  const [features, setFeatures] = useState<{ dark_mode: boolean; language: boolean }>(() => {
    try {
      const raw = localStorage.getItem("tabarak_features");
      if (raw) return { dark_mode: false, language: false, ...JSON.parse(raw) };
    } catch {}
    return { dark_mode: false, language: false };
  });

  // Listen for feature changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tabarak_features") {
        try {
          const raw = localStorage.getItem("tabarak_features");
          if (raw) setFeatures({ dark_mode: false, language: false, ...JSON.parse(raw) });
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    "f2": () => { if (canAccess("sales")) openPosWindow("sales-pos", undefined, account); },
    "f3": () => { if (canAccess("purchases")) openPosWindow("purchase-pos", undefined, account); },
    "ctrl+f": () => { const el = document.querySelector<HTMLInputElement>(".search-input"); if (el) el.focus(); },
    "f1": () => setPage("dashboard"),
    "f5": () => window.location.reload(),
  });

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

  if (label === "full-count") {
    return <FullInventoryCount onBack={() => getCurrentWindow().close()} />;
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
            <h1>{t("appTitle")}</h1>
            <p>{t("appSubtitle")}</p>
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
                <span>{t(n.labelKey)}</span>
              </button>
          ))}
        </nav>
        {account && (
          <div className="sidebar-footer">
            <div className="sidebar-toggles">
              {features.dark_mode && (
                <button className="sidebar-toggle-btn" onClick={toggleTheme} title={theme === "dark" ? t("lightMode") : t("darkMode")}>
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>
              )}
              {features.language && (
                <button className="sidebar-toggle-btn" onClick={() => { setLang(getLang() === "ar" ? "en" : "ar"); window.location.reload(); }} title={t("language")}>
                  🌐
                </button>
              )}
            </div>
            <button className="nav-item logout-btn" onClick={() => window.location.reload()}>
              <span className="nav-icon">🚪</span>
              <span>{t("logout")}</span>
            </button>
            <div className="sidebar-version">
              <span>{t("version")} {appVersion || "—"}</span>
              <span>{t("devCredit")}</span>
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
            onOpenFullCount={() => openFullCountWindow(account)}
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
        {safePage === "suppliers" && <SuppliersPage />}
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
        {safePage === "maint_home" && <MaintenanceHome onNavigate={setPage} onBack={() => setPage("dashboard")} />}
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

  // Initialize theme and language
  const [theme, toggleTheme] = useTheme();
  useEffect(() => { initLang(); }, []);

  // Start auto-backup
  useEffect(() => { api.startAutoBackup().catch(() => {}); }, [authenticated]);

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
    return (
      <ErrorBoundary>
        <SplashScreen onFinish={handleSplashFinish} />
      </ErrorBoundary>
    );
  }

  if (!licenseActive) {
    return (
      <ErrorBoundary>
        <Activation onActivated={() => setLicenseActive(true)} />
      </ErrorBoundary>
    );
  }

  if (!authenticated || !account) {
    if (isPopup) {
      return (
        <ErrorBoundary>
          <AutoLogin onLogin={handleLogin} />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <LoginScreen onLogin={handleLogin} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <Shell account={account} theme={theme} toggleTheme={toggleTheme} />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
