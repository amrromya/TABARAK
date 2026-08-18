import { useEffect } from "react";

export function ResetAccountsPage() {
  useEffect(() => {
    localStorage.clear();
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
  }, []);

  return (
    <div className="login-screen">
      <div className="login-card" style={{ textAlign: "center" }}>
        <h2>تم إعادة تعيين الحسابات</h2>
        <p>جاري تحويلك لشاشة تسجيل الدخول...</p>
      </div>
    </div>
  );
}
