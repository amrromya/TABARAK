import { useEffect, useState } from "react";

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onFinish, 300);
    }, 2000);
    return () => clearTimeout(t);
  }, [onFinish]);

  if (!visible) return null;

  return (
    <div className="splash">
      <div className="splash-inner">
        <div className="splash-logo">
          <img src="/app.png" alt="تبارك" className="splash-logo-img" />
        </div>
        <h1 className="splash-title">تبارك</h1>
        <p className="splash-sub">برنامج الحسابات</p>
        <div className="splash-loader">
          <div className="splash-dot" />
          <div className="splash-dot" />
          <div className="splash-dot" />
        </div>
      </div>
    </div>
  );
}
