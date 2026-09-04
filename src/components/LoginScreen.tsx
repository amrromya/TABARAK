import { useEffect, useState } from "react";
import type { Account } from "../types";
import { api } from "../api";
import { t } from "../i18n";

const ACCOUNTS_KEY = "tabarak_accounts";

function getFeatures(): { maintenance: boolean; attendance: boolean; dark_mode: boolean; language: boolean; cash_register: boolean; customer_turns: boolean } {
  try {
    const raw = localStorage.getItem("tabarak_features");
    if (raw) return { maintenance: false, attendance: false, dark_mode: false, language: false, cash_register: false, customer_turns: false, ...JSON.parse(raw) };
  } catch {}
  return { maintenance: false, attendance: false, dark_mode: false, language: false, cash_register: false, customer_turns: false };
}

function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      let changed = false;
      const features = getFeatures();
      const updated = parsed.map((a: Account) => {
        let menus = [...(a.visibleMenus || [])];
        let perms = [...(a.permissions || [])];
        let localChanged = false;

        const hasAccounting = menus.includes("receipt_vouchers");
        if (!hasAccounting) {
          localChanged = true;
          menus = [...menus, "receipt_vouchers", "payment_vouchers", "warehouse_transfers"];
          perms = [...perms, "view_receipt_vouchers", "view_payment_vouchers", "view_warehouse_transfers"];
        }

        if (features.cash_register && !menus.includes("cash_register")) {
          localChanged = true;
          menus = [...menus, "cash_register"];
          perms = [...perms, "view_cash_register"];
        }
        if (!features.cash_register && menus.includes("cash_register")) {
          localChanged = true;
          menus = menus.filter((m) => m !== "cash_register");
          perms = perms.filter((p) => p !== "view_cash_register");
        }

        if (features.maintenance && !menus.includes("maintenance")) {
          localChanged = true;
          menus.push("maintenance");
        }
        if (!features.maintenance && menus.includes("maintenance")) {
          localChanged = true;
          menus = menus.filter((m) => m !== "maintenance");
        }
        if (features.attendance && !menus.includes("attendance")) {
          localChanged = true;
          menus.push("attendance");
        }
        if (!features.attendance && menus.includes("attendance")) {
          localChanged = true;
          menus = menus.filter((m) => m !== "attendance");
        }

        if (localChanged) {
          changed = true;
          return { ...a, visibleMenus: [...new Set(menus)], permissions: [...new Set(perms)] };
        }
        return a;
      });
      if (changed) {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    }
  } catch {}
  const defaults: Account[] = [
    {
      id: "1",
      name: "admin",
      password: "",
      permissions: [
        "view_dashboard",
        "view_inventory",
        "view_warehouses",
        "view_sales",
        "view_purchases",
        "view_suppliers",
        "view_customers",
        "view_employees",
        "view_expenses",
        "view_reports",
        "view_settings",
        "create_sale",
        "edit_sale",
        "delete_sale",
        "create_purchase",
        "edit_purchase",
        "delete_purchase",
        "create_customer",
        "edit_customer",
        "delete_customer",
        "create_employee",
        "edit_employee",
        "delete_employee",
        "manage_accounts",
        "view_receipt_vouchers",
        "view_payment_vouchers",
        "view_warehouse_transfers",
        "view_cash_register",
        "view_audit_log",
      ],
      visibleMenus: [
        "dashboard",
        "inventory",
        "warehouses",
        "sales",
        "purchases",
        "suppliers",
        "customers",
        "employees",
        "expenses",
        "receipt_vouchers",
        "payment_vouchers",
        "warehouse_transfers",
        "cash_register",
        "reports",
        "settings",
        "audit_log",
        "pos",
        "ppos",
      ],
    },
  ];
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(defaults));
  return defaults;
}

export function LoginScreen({ onLogin }: { onLogin: (account: Account) => void }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [licenseInfo, setLicenseInfo] = useState<{ expiry_date: string; customer_name: string } | null>(null);
  const [firstRun, setFirstRun] = useState(false);
  const [adminName, setAdminName] = useState("");
  const [adminPass, setAdminPass] = useState("");
  const [adminPass2, setAdminPass2] = useState("");
  const [setupMsg, setSetupMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    api.getLicenseInfo().then(setLicenseInfo).catch(() => {});
    api.isFirstRun().then(setFirstRun).catch(() => {});
  }, []);

  useEffect(() => {
    const pendingRaw = localStorage.getItem("tabarak_pending_account");
    if (pendingRaw) {
      try {
        const pendingAccount = JSON.parse(pendingRaw);
        localStorage.removeItem("tabarak_pending_account");
        onLogin(pendingAccount);
        return;
      } catch (e) {
        console.error("Failed to parse pending account:", e);
        localStorage.removeItem("tabarak_pending_account");
      }
    }
    const accs = getAccounts();
    setAccounts(accs);
    if (accs.length > 0) {
      setSelectedId(accs[0].id);
    }
  }, [onLogin]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const account = accounts.find((a) => a.id === selectedId);
    if (!account) {
      setError(t("chooseAccount"));
      return;
    }
    if (account.password !== password) {
      setError(t("loginError"));
      return;
    }
    onLogin(account);
  };

  const handleFirstRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupMsg("");
    if (!adminName.trim()) {
      setSetupMsg(t("nameRequired"));
      return;
    }
    if (adminPass.length < 6) {
      setSetupMsg(t("passwordTooShort"));
      return;
    }
    if (adminPass !== adminPass2) {
      setSetupMsg(t("passwordsNotMatch"));
      return;
    }
    try {
      await api.initializeAdmin(adminName, adminPass);
      setFirstRun(false);
      // Create default account and log in
      const newAccount: Account = {
        id: "1",
        name: adminName,
        password: adminPass,
        permissions: [
          "view_dashboard", "view_inventory", "view_warehouses", "view_sales",
          "view_purchases", "view_suppliers", "view_customers", "view_employees",
          "view_expenses", "view_reports", "view_settings", "create_sale", "edit_sale",
          "delete_sale", "create_purchase", "edit_purchase", "delete_purchase",
          "create_customer", "edit_customer", "delete_customer", "create_employee",
          "edit_employee", "delete_employee", "manage_accounts",
          "view_receipt_vouchers", "view_payment_vouchers", "view_warehouse_transfers",
          "view_audit_log",
        ],
        visibleMenus: [
          "dashboard", "inventory", "warehouses", "sales", "purchases", "suppliers",
          "customers", "employees", "expenses", "receipt_vouchers", "payment_vouchers",
          "warehouse_transfers", "reports", "settings", "audit_log", "pos", "ppos",
        ],
      };
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([newAccount]));
      onLogin(newAccount);
    } catch (err) {
      setSetupMsg(String(err));
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <img src="/app.png" alt="تبارك" className="login-logo" />
          <h1>{t("appTitle")}</h1>
          <p>{t("appSubtitle")}</p>
        </div>

        {firstRun ? (
          <form onSubmit={handleFirstRun} className="login-form">
            <div style={{ textAlign: "center", marginBottom: 12, color: "var(--primary)", fontWeight: 700 }}>
              {t("firstRun")}
            </div>
            <div className="form-group">
              <label>{t("adminName")}</label>
              <input
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder={t("enterAdminName")}
                className="login-input"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>{t("adminPassword")}</label>
              <input
                type="password"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder={t("minPassword")}
                className="login-input"
              />
            </div>
            <div className="form-group">
              <label>{t("confirmPassword")}</label>
              <input
                type="password"
                value={adminPass2}
                onChange={(e) => setAdminPass2(e.target.value)}
                placeholder={t("reenterPassword")}
                className="login-input"
              />
            </div>
            {setupMsg && <div className="login-error">{setupMsg}</div>}
            <button type="submit" className="login-btn">
              {t("setupAccount")}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>{t("selectAccount")}</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="login-select"
              >
                {accounts.length === 0 && <option value="">{t("noAccounts")}</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("enterPassword")}
                className="login-input"
                autoFocus
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-btn">
              {t("login")}
            </button>
          </form>
        )}

        {licenseInfo && (() => {
          const raw = licenseInfo.expiry_date;
          const expiry = raw.includes(" ")
            ? new Date(raw.replace(" ", "T"))
            : new Date(raw + "T23:59:59");
          const isLifetime = expiry.getFullYear() >= 2099;
          const diffMs = expiry.getTime() - now;
          const isExpired = diffMs <= 0;
          const absDiffMs = Math.abs(diffMs);
          const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
          const hours = Math.floor((absDiffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((absDiffMs % (1000 * 60)) / 1000);
          const isWarning = !isExpired && days <= 7;
          const parts: string[] = [];
          if (days > 0) parts.push(`${days} ${t("dayUnit")}`);
          if (hours > 0) parts.push(`${hours} ${t("hourUnit")}`);
          if (minutes > 0) parts.push(`${minutes} ${t("minuteUnit")}`);
          if (seconds > 0 || parts.length === 0) parts.push(`${seconds} ${t("secondUnit")}`);
          const timeText = parts.join(" ");
          return (
            <div className={`login-license-status ${isExpired ? "expired" : isWarning ? "warning" : "active"}`}>
              <div className="license-status-label">
                {isExpired ? t("licenseExpired") : isWarning ? t("licenseExpiring") : t("licenseActive")}
              </div>
              <div className="license-status-detail">
                {isLifetime && <span>{t("activatedForever")}</span>}
                {!isLifetime && !isExpired && <span>{t("expiresIn")} {timeText}</span>}
                {!isLifetime && isExpired && <span style={{ color: "var(--danger)" }}>{t("expiredAgo")} {timeText}</span>}
                <span className="license-status-date"> — {licenseInfo.expiry_date}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
