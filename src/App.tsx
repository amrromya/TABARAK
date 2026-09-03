import { useState, useEffect, useRef } from "react";
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
import { CustomerTurns } from "./pages/CustomerTurns";
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
import { CashRegister } from "./pages/CashRegister";
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
  { key: "cash_register", labelKey: "cashRegister", icon: "🏧" },
  { key: "customer_turns", labelKey: "customerTurns", icon: "🔄" },
  { key: "reports", labelKey: "reports", icon: "📈" },
  { key: "settings", labelKey: "settings", icon: "⚙️" },
];

const POS_WINDOWS: Record<string, { title: string }> = {
  "sales-pos": { title: "فاتورة مبيعات - تبارك" },
  "purchase-pos": { title: "فاتورة مشتريات - تبارك" },
  "count-pos": { title: "فاتورة جرد مؤقت - تبارك" },
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
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [features, setFeatures] = useState<{ dark_mode: boolean; language: boolean; cash_register: boolean; customer_turns: boolean }>(() => {
    try {
      const raw = localStorage.getItem("tabarak_features");
      if (raw) return { dark_mode: false, language: false, cash_register: false, customer_turns: false, ...JSON.parse(raw) };
    } catch {}
    return { dark_mode: false, language: false, cash_register: false, customer_turns: false };
  });

  // Listen for feature changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tabarak_features") {
        try {
          const raw = localStorage.getItem("tabarak_features");
          if (raw) setFeatures({ dark_mode: false, language: false, cash_register: false, ...JSON.parse(raw) });
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Close behavior: popup windows close immediately, main window shows backup dialog
  useEffect(() => {
    const w = getCurrentWindow();
    const winLabel = w.label;
    const isPopup = winLabel !== "main";
    const unlisten = w.onCloseRequested(async (e) => {
      e.preventDefault();
      if (isPopup) {
        try { await api.closeWindow(winLabel); } catch {}
        return;
      }
      setShowCloseDialog(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleBackupAndClose = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const path = await save({
        defaultPath: `tabarak_backup_${today}.db`,
        filters: [{ name: "Database", extensions: ["db"] }],
      });
      if (path) {
        await api.exportBackup(path);
      }
    } catch (e: any) {
      console.error("Backup failed:", e);
    }
    try { getCurrentWindow().destroy(); } catch { try { await api.forceExit(); } catch {} }
  };

  const handleCloseWithoutBackup = async () => {
    try { await api.forceExit(); } catch { try { getCurrentWindow().destroy(); } catch {} }
  };

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
    if (n.key === "cash_register" && !features.cash_register) return false;
    if (n.key === "customer_turns" && !features.customer_turns) return false;
    return canAccess(n.key);
  });

  const allowedPages = visibleNav.map((n) => n.key);
  const isDetailPage = page.startsWith("maint_detail_");
  const isMaintPage = page.startsWith("maint_");
  const isAccountingPage = ["receipt_vouchers", "payment_vouchers", "warehouse_transfers", "stock_counts"].includes(page);
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
            onOpenCounts={() => setPage("stock_counts")}
            onOpenFullCount={() => openFullCountWindow(account)}
            onNavigate={(page) => setPage(page)}
          />
        )}
        {safePage === "stock_counts" && (
          <StockCounts
            onBack={() => setPage("inventory")}
            onEditCount={(id) => openCountWindow(id, account)}
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
        {safePage === "cash_register" && <CashRegister />}
        {safePage === "customer_turns" && <CustomerTurns />}
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

      {showCloseDialog && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "36px 40px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)", textAlign: "center",
            maxWidth: 420, width: "90%",
          }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>💾</div>
            <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#1e293b" }}>
              {t("closeBackupTitle")}
            </h2>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#64748b" }}>
              {t("closeBackupPrompt")}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={handleBackupAndClose}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: "#22c55e", color: "#fff", fontSize: 15,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("yesBackup")}
              </button>
              <button
                onClick={handleCloseWithoutBackup}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none",
                  background: "#ef4444", color: "#fff", fontSize: 15,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                {t("no")}
              </button>
              <button
                onClick={() => setShowCloseDialog(false)}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  border: "1px solid #cbd5e1", background: "#fff",
                  color: "#475569", fontSize: 15, fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [licenseState, setLicenseState] = useState<"loading" | "active" | "expired" | "none">("loading");
  const expiryDateRef = useRef<Date | null>(null);

  // Initialize theme and language
  const [theme, toggleTheme] = useTheme();
  useEffect(() => { initLang(); }, []);

  // Start auto-backup from localStorage settings
  useEffect(() => {
    if (!authenticated) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    try {
      const raw = localStorage.getItem("tabarak_auto_backup");
      if (raw) {
        const cfg = JSON.parse(raw);
        if (cfg.enabled && cfg.path) {
          const intervalMs = (Number(cfg.interval) || 24) * 60 * 60 * 1000;
          timer = setInterval(async () => {
            try {
              const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
              const filename = `tabarak_auto_${ts}.db`;
              await api.exportBackup(cfg.path + "\\" + filename);
            } catch {}
          }, intervalMs);
        }
      }
    } catch {}
    return () => { if (timer) clearInterval(timer); };
  }, [authenticated]);

  // License check — runs on mount + periodic check every 5 minutes
  useEffect(() => {
    if (isPopup) return;

    const parseExpiry = (raw: string) => {
      return raw.includes(" ")
        ? new Date(raw.replace(" ", "T"))
        : new Date(raw + "T23:59:59");
    };

    const checkLicense = async () => {
      try {
        const info = await api.getLicenseInfo();
        if (!info) {
          expiryDateRef.current = null;
          setLicenseState("none");
          setLoading(false);
          return;
        }
        const expiry = parseExpiry(info.expiry_date);
        expiryDateRef.current = expiry;
        if (new Date() > expiry) {
          setLicenseState("expired");
        } else {
          setLicenseState("active");
        }
      } catch (err: any) {
        expiryDateRef.current = null;
        const msg = String(err || "");
        if (msg.includes("تاريخ الجهاز") || msg.includes(".clock")) {
          setLicenseState("expired");
        } else {
          setLicenseState("none");
        }
      }
      setLoading(false);
    };

    checkLicense();

    // Periodic check every 5 minutes — only compares stored date, no Rust calls
    const interval = setInterval(() => {
      if (expiryDateRef.current && new Date() > expiryDateRef.current) {
        setLicenseState("expired");
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isPopup]);

  const handleSplashFinish = () => {
    setLoading(false);
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

  if (licenseState === "expired") {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#fef2f2" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>⛔</div>
          <h1 style={{ color: "#991b1b", fontSize: 32, fontWeight: 800, margin: 0 }}>{t("licenseExpired")}</h1>
          <p style={{ color: "#b91c1c", fontSize: 16, marginTop: 8 }}>{t("licenseExpiredMessage")}</p>
          <button
            onClick={async () => {
              try {
                await api.removeLicense();
                setLicenseState("none");
              } catch (err) {
                console.error(err);
              }
            }}
            style={{
              marginTop: 24,
              padding: "12px 32px",
              fontSize: 16,
              fontWeight: 700,
              color: "#fff",
              background: "#991b1b",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            {t("reactivate")}
          </button>
        </div>
      </div>
    );
  }

  if (licenseState === "none") {
    return (
      <ErrorBoundary>
        <Activation onActivated={async () => {
          try {
            const info = await api.getLicenseInfo();
            if (info) {
              const raw = info.expiry_date;
              expiryDateRef.current = raw.includes(" ")
                ? new Date(raw.replace(" ", "T"))
                : new Date(raw + "T23:59:59");
            }
          } catch {}
          setLicenseState("active");
        }} />
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
