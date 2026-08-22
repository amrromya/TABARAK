import { useEffect, useState } from "react";
import { LoginScreen } from "./LoginScreen";
import type { Account } from "../types";

const ACCOUNTS_KEY = "tabarak_accounts";

function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function AutoLogin({ onLogin }: { onLogin: (account: Account) => void }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tryAutoLogin = () => {
      try {
        const hash = window.location.hash;
        console.log("AutoLogin hash:", hash);
        if (hash && hash.includes("account=")) {
          const params = new URLSearchParams(hash.substring(1));
          const accountJson = params.get("account");
          console.log("AutoLogin accountJson:", accountJson);
          if (accountJson) {
            const pendingAccount = JSON.parse(accountJson) as Account;
            window.location.hash = "";
            onLogin(pendingAccount);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error("Failed to parse account from hash:", e);
      }

      const accounts = getAccounts();
      console.log("AutoLogin fallback accounts:", accounts.length);
      if (accounts.length > 0) {
        onLogin(accounts[0]);
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    const timer = setTimeout(tryAutoLogin, 50);
    return () => clearTimeout(timer);
  }, [onLogin]);

  if (loading) {
    return (
      <div className="splash">
        <div className="splash-inner">
          <div className="splash-loader">
            <div className="splash-dot" />
            <div className="splash-dot" />
            <div className="splash-dot" />
          </div>
        </div>
      </div>
    );
  }

  return <LoginScreen onLogin={onLogin} />;
}
