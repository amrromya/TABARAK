import { useEffect, useState } from "react";
import type { Account } from "../types";
import { api } from "../api";

const ACCOUNTS_KEY = "tabarak_accounts";

const FEATURES_KEY = "tabarak_features";

function getFeatures(): { maintenance: boolean; attendance: boolean } {
  try {
    const raw = localStorage.getItem(FEATURES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { maintenance: false, attendance: false };
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
      password: "admin123",
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
        "reports",
        "settings",
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

  useEffect(() => {
    api.getLicenseInfo().then(setLicenseInfo).catch(() => {});
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
      setError("اختر الحساب");
      return;
    }
    if (account.password !== password) {
      setError("الرقم السري غير صحيح");
      return;
    }
    onLogin(account);
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <img src="/app.png" alt="تبارك" className="login-logo" />
          <h1>تبارك</h1>
          <p>برنامج الحسابات</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>الحساب</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="login-select"
            >
              {accounts.length === 0 && <option value="">— لا توجد حسابات —</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>الرقم السري</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="أدخل الرقم السري"
              className="login-input"
              autoFocus
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn">
            دخول
          </button>
        </form>

        {licenseInfo && (() => {
          const expiry = new Date(licenseInfo.expiry_date);
          const now = new Date();
          const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = daysLeft <= 0;
          const isWarning = daysLeft > 0 && daysLeft <= 30;
          return (
            <div className={`login-license-status ${isExpired ? "expired" : isWarning ? "warning" : "active"}`}>
              <div className="license-status-label">
                {isExpired ? "انتهت الصلاحية" : isWarning ? "قريب من الانتهاء" : "التفعيل نشط"}
              </div>
              <div className="license-status-detail">
                {isExpired ? `انتهى منذ ${Math.abs(daysLeft)} يوم` : `متبقي ${daysLeft} يوم`}
                <span className="license-status-date"> — {licenseInfo.expiry_date}</span>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
