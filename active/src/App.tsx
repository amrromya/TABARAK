import { useState } from "react";
import { GenerateTab } from "./tabs/GenerateTab";
import { ListTab } from "./tabs/ListTab";
import { VerifyTab } from "./tabs/VerifyTab";

type Tab = "generate" | "list" | "verify";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("generate");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">🔐</div>
          <div>
            <h1>إدارة التفعيل</h1>
            <p>أداة تبارك</p>
          </div>
        </div>
        <nav>
          <button
            className={`nav-item ${activeTab === "generate" ? "active" : ""}`}
            onClick={() => setActiveTab("generate")}
          >
            <span className="nav-icon">🔑</span>
            <span>توليد تفعيل</span>
          </button>
          <button
            className={`nav-item ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <span className="nav-icon">📋</span>
            <span>أكواد التفعيل</span>
          </button>
          <button
            className={`nav-item ${activeTab === "verify" ? "active" : ""}`}
            onClick={() => setActiveTab("verify")}
          >
            <span className="nav-icon">✅</span>
            <span>التحقق من كود</span>
          </button>
        </nav>
        <div className="sidebar-footer">
          <span className="version">v1.0.0</span>
        </div>
      </aside>
      <main className="content">
        {activeTab === "generate" && <GenerateTab />}
        {activeTab === "list" && <ListTab />}
        {activeTab === "verify" && <VerifyTab />}
      </main>
    </div>
  );
}
