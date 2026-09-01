import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { money, qty, useToast } from "../components/ui";
import { t } from "../i18n";
import type { BestSeller, DailySalesRow, ProfitLoss, StockValue } from "../types";
import { SalesReportPopup } from "../components/SalesReportPopup";
import { PurchaseReportPopup } from "../components/PurchaseReportPopup";

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;

type ReportTab = "summary" | "daily" | "bestsellers";

export function Reports() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayISO());
  const [data, setData] = useState<ProfitLoss | null>(null);
  const [stock, setStock] = useState<StockValue | null>(null);
  const [daily, setDaily] = useState<DailySalesRow[]>([]);
  const [bestsellers, setBestsellers] = useState<BestSeller[]>([]);
  const [activeTab, setActiveTab] = useState<ReportTab>("summary");
  const notify = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [showSalesReport, setShowSalesReport] = useState(false);
  const [showPurchasesReport, setShowPurchasesReport] = useState(false);

  const range = { from: from || null, to: to || null };

  const load = useCallback(async () => {
    try {
      const [pl, sv, d, b] = await Promise.all([
        api.getProfitLoss(range),
        api.getStockValue(),
        api.getDailySales(range),
        api.getBestSellers(range),
      ]);
      setData(pl);
      setStock(sv);
      setDaily(d);
      setBestsellers(b);
    } catch (e) {
      notify(String(e), "error");
    }
  }, [from, to, notify]);

  useEffect(() => { load(); }, [load]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none";
    document.body.appendChild(frame);
    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) { document.body.removeChild(frame); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>تقرير تبارك</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px;margin:0;color:#1f2937;font-size:12px}
      h2{text-align:center;color:#0f8a5f;border-bottom:2px solid #0f8a5f;padding-bottom:6px;font-size:18px}
      h3{color:#374151;margin:20px 0 8px;font-size:14px;border-right:3px solid #0f8a5f;padding-right:8px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #d1d5db;padding:6px 10px;text-align:right;font-size:11px}
      th{background:#f3f4f6;font-weight:700}
      .summary-row td{padding:5px 10px;border-bottom:1px solid #e5e7eb}
      .highlight{background:#f0fdf4;font-weight:700}
      .green{color:#16a34a}.red{color:#dc2626}
      .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}
      .card{border:1px solid #d1d5db;border-radius:8px;padding:10px;text-align:center}
      .card-val{font-size:16px;font-weight:800}
      .card-lbl{font-size:10px;color:#6b7280}
      .footer{margin-top:20px;border-top:1px dashed #ccc;padding-top:8px;color:#6b7280;font-size:10px;text-align:center}
      @media print{body{padding:10px}}</style></head><body>
      <h2>تقرير النظام — تبارك</h2>
      <div style="text-align:center;color:#6b7280;margin-bottom:12px">الفترة: ${from || "الكل"} — ${to || "الكل"}</div>
      ${data ? `<h3>ملخص الأرباح والخسائر</h3>
      <div class="cards">
        <div class="card"><div style="font-size:20px">🛒</div><div class="card-val">${money(data.sales_total)}</div><div class="card-lbl">إجمالي المبيعات</div></div>
        <div class="card"><div style="font-size:20px">📦</div><div class="card-val">${money(data.cost_total)}</div><div class="card-lbl">تكلفة البضاعة</div></div>
        <div class="card"><div style="font-size:20px">📈</div><div class="card-val green">${money(data.gross_profit)}</div><div class="card-lbl">المكسب الإجمالي</div></div>
        <div class="card"><div style="font-size:20px">🧾</div><div class="card-val red">${money(data.expenses_total)}</div><div class="card-lbl">المصروفات</div></div>
        <div class="card"><div style="font-size:20px">💰</div><div class="card-val ${data.net_profit >= 0 ? 'green' : 'red'}">${money(data.net_profit)}</div><div class="card-lbl">صافي الربح</div></div>
        <div class="card"><div style="font-size:20px">🚚</div><div class="card-val">${money(data.purchases_total)}</div><div class="card-lbl">المشتريات</div></div>
      </div>
      <table class="summary">
        <tr><td>عدد الفواتير</td><td style="font-weight:700">${data.sales_count}</td></tr>
        <tr><td>إجمالي المبيعات</td><td style="font-weight:700">${money(data.sales_total)}</td></tr>
        <tr><td>تكلفة البضاعة المباعة</td><td style="font-weight:700">- ${money(data.cost_total)}</td></tr>
        <tr class="highlight"><td>المكسب الإجمالي</td><td style="font-weight:700">${money(data.gross_profit)}</td></tr>
        <tr><td>المصروفات</td><td style="font-weight:700;color:#dc2626">- ${money(data.expenses_total)}</td></tr>
        <tr class="highlight"><td>صافي الربح</td><td style="font-weight:700;color:${data.net_profit >= 0 ? '#16a34a' : '#dc2626'}">${money(data.net_profit)}</td></tr>
      </table>` : ""}
      ${stock ? `<h3>المخزون</h3>
      <table class="summary">
        <tr><td>عدد المنتجات</td><td style="font-weight:700">${stock.product_count}</td></tr>
        <tr><td>قيمة المخزون</td><td style="font-weight:700">${money(stock.total_value)}</td></tr>
        <tr><td>منتجات مخزونها منخفض</td><td style="font-weight:700;color:#dc2626">${stock.low_stock_count}</td></tr>
      </table>` : ""}
      ${daily.length > 0 ? `<h3>المبيعات اليومية</h3>
      <table><thead><tr><th>التاريخ</th><th>الفواتير</th><th>المبيعات</th><th>المكسب</th></tr></thead>
      <tbody>${daily.map(d => `<tr><td>${d.date}</td><td>${d.sales_count}</td><td>${money(d.sales_total)}</td><td style="font-weight:700">${money(d.profit)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${bestsellers.length > 0 ? `<h3>الأكثر مبيعاً</h3>
      <table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>الإيراد</th></tr></thead>
      <tbody>${bestsellers.map((b,i) => `<tr><td>${i+1}</td><td style="font-weight:700">${b.product_name}</td><td>${qty(b.quantity)}</td><td>${money(b.revenue)}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="footer">تقرير نظام تبارك — ${new Date().toLocaleDateString("ar-EG")}</div></body></html>`);
    doc.close();
    frame.contentWindow?.focus();
    setTimeout(() => { frame.contentWindow?.print(); setTimeout(() => document.body.removeChild(frame), 1000); }, 500);
  };

  const handleExportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableMod = await import("jspdf-autotable");
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      doc.setFont("helvetica");
      doc.setFontSize(18);
      doc.text("Tabarak Report", 105, 15, { align: "center" });
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Period: ${from || "All"} - ${to || "All"}`, 105, 22, { align: "center" });
      doc.setTextColor(0);
      let y = 30;
      if (data) {
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Profit & Loss", 14, y); y += 2;
        autoTable(doc, {
          startY: y, head: [["Item", "Amount"]],
          body: [
            ["Total Sales", data.sales_total.toFixed(2)],
            ["Cost of Goods", data.cost_total.toFixed(2)],
            ["Gross Profit", data.gross_profit.toFixed(2)],
            ["Expenses", data.expenses_total.toFixed(2)],
            ["Net Profit", data.net_profit.toFixed(2)],
            ["Purchases", data.purchases_total.toFixed(2)],
            ["Invoice Count", String(data.sales_count)],
          ],
          theme: "grid", headStyles: { fillColor: [15, 138, 95] }, styles: { fontSize: 10 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
      if (stock) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Inventory", 14, y); y += 2;
        autoTable(doc, {
          startY: y, head: [["Item", "Value"]],
          body: [
            ["Product Count", String(stock.product_count)],
            ["Total Value", stock.total_value.toFixed(2)],
            ["Low Stock", String(stock.low_stock_count)],
          ],
          theme: "grid", headStyles: { fillColor: [15, 138, 95] }, styles: { fontSize: 10 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
      if (daily.length > 0) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Daily Sales", 14, y); y += 2;
        autoTable(doc, {
          startY: y, head: [["Date", "Invoices", "Sales", "Profit"]],
          body: daily.map((d) => [d.date, String(d.sales_count), d.sales_total.toFixed(2), d.profit.toFixed(2)]),
          theme: "grid", headStyles: { fillColor: [15, 138, 95] }, styles: { fontSize: 10 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
      if (bestsellers.length > 0) {
        if (y > 250) { doc.addPage(); y = 15; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Best Sellers", 14, y); y += 2;
        autoTable(doc, {
          startY: y, head: [["#", "Product", "Qty Sold", "Revenue"]],
          body: bestsellers.map((b, i) => [String(i + 1), b.product_name, b.quantity.toFixed(2), b.revenue.toFixed(2)]),
          theme: "grid", headStyles: { fillColor: [15, 138, 95] }, styles: { fontSize: 10 },
        });
      }
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "حفظ التقرير كـ PDF",
        defaultPath: `report_${from || "all"}-${to || "all"}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (path) {
        const bytes = doc.output("arraybuffer");
        await api.writeBinaryFile(path, Array.from(new Uint8Array(bytes)));
        notify("تم حفظ التقرير بنجاح");
      }
    } catch (e) {
      notify("فشل التصدير: " + String(e), "error");
    }
  };

  const netProfitColor = data && data.net_profit >= 0 ? "#16a34a" : "#dc2626";

  const TABS: { id: ReportTab; label: string; icon: string }[] = [
    { id: "summary", label: t("summaryTab"), icon: "📊" },
    { id: "daily", label: t("dailySalesTab"), icon: "📅" },
    { id: "bestsellers", label: t("bestsellersTab"), icon: "🏆" },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <h1>📈 {t("reports")}</h1>
        <div className="head-actions">
          <button className="btn sm" onClick={handlePrint}>🖨️ {t("print")}</button>
          <button className="btn sm primary" onClick={handleExportPDF}>📥 {t("exportPDF")}</button>
        </div>
      </div>

      {/* بطاقات التقارير السريعة */}
      <div className="rpt-quick-reports">
        <button className="rpt-report-card rpt-sales-card" onClick={() => setShowSalesReport(true)}>
          <div className="rpt-report-card-icon">🛒</div>
          <div className="rpt-report-card-body">
            <h3>تقارير المبيعات</h3>
            <p>عرض جميع فواتير البيع مع التفاصيل والتصدير</p>
          </div>
          <div className="rpt-report-card-arrow">←</div>
        </button>
        <button className="rpt-report-card rpt-purchases-card" onClick={() => setShowPurchasesReport(true)}>
          <div className="rpt-report-card-icon">📦</div>
          <div className="rpt-report-card-body">
            <h3>تقارير المشتريات</h3>
            <p>عرض جميع فواتير المشتريات مع التفاصيل والتصدير</p>
          </div>
          <div className="rpt-report-card-arrow">←</div>
        </button>
      </div>

      {/* شريط الفلاتر */}
      <div className="rpt-filters">
        <div className="rpt-quick-filters">
          <button className="btn sm" onClick={() => { setFrom(todayISO()); setTo(todayISO()); }}>{t("todayLabel")}</button>
          <button className="btn sm" onClick={() => { setFrom(monthStart()); setTo(todayISO()); }}>{t("thisMonth")}</button>
          <button className="btn sm" onClick={() => { setFrom(yearStart()); setTo(todayISO()); }}>{t("thisYear")}</button>
          <button className="btn sm" onClick={() => { setFrom(""); setTo(""); }}>{t("all")}</button>
        </div>
        <div className="rpt-date-range">
          <label className="rpt-date-field">
            <span>{t("from")}</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="rpt-date-field">
            <span>{t("to")}</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </div>

      {/* بطاقات الملخص السريع */}
      {data && (
        <div className="rpt-kpi-grid">
          <div className="rpt-kpi rpt-kpi-green">
            <div className="rpt-kpi-icon">🛒</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value">{money(data.sales_total)}</div>
              <div className="rpt-kpi-label">{t("salesTotal")}</div>
            </div>
          </div>
          <div className="rpt-kpi rpt-kpi-blue">
            <div className="rpt-kpi-icon">📦</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value">{money(data.cost_total)}</div>
              <div className="rpt-kpi-label">{t("costOfGoods")}</div>
            </div>
          </div>
          <div className="rpt-kpi rpt-kpi-teal">
            <div className="rpt-kpi-icon">📈</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value">{money(data.gross_profit)}</div>
              <div className="rpt-kpi-label">{t("grossProfit")}</div>
            </div>
          </div>
          <div className="rpt-kpi rpt-kpi-amber">
            <div className="rpt-kpi-icon">🧾</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value">{money(data.expenses_total)}</div>
              <div className="rpt-kpi-label">{t("expenses")}</div>
            </div>
          </div>
          <div className="rpt-kpi" style={{ borderRightColor: netProfitColor }}>
            <div className="rpt-kpi-icon">💰</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value" style={{ color: netProfitColor }}>{money(data.net_profit)}</div>
              <div className="rpt-kpi-label">{t("netProfit")}</div>
            </div>
          </div>
          <div className="rpt-kpi rpt-kpi-purple">
            <div className="rpt-kpi-icon">🚚</div>
            <div className="rpt-kpi-body">
              <div className="rpt-kpi-value">{money(data.purchases_total)}</div>
              <div className="rpt-kpi-label">{t("purchasesLabel")}</div>
            </div>
          </div>
        </div>
      )}

      {/* تبويبات الأقسام */}
      <div className="rpt-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`rpt-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* المحتوى */}
      <div ref={printRef}>
        {/* === الملخص العام === */}
        {activeTab === "summary" && (
          <div className="rpt-content">
            {data && (
              <div className="rpt-section">
                <h2 className="rpt-section-title">📊 {t("profitLoss")}</h2>
                <div className="rpt-two-col">
                  <div className="rpt-card">
                    <h3>{t("details")}</h3>
                    <table className="rpt-summary-table">
                      <tbody>
                        <tr><td>{t("invoiceCount")}</td><td className="rpt-strong">{data.sales_count}</td></tr>
                        <tr><td>{t("salesTotal")}</td><td className="rpt-strong">{money(data.sales_total)}</td></tr>
                        <tr><td>{t("costOfGoodsSold")}</td><td className="rpt-strong rpt-text-red">- {money(data.cost_total)}</td></tr>
                        <tr className="rpt-highlight"><td>{t("grossProfit")}</td><td className="rpt-strong rpt-text-green">{money(data.gross_profit)}</td></tr>
                        <tr><td>{t("generalExpenses")}</td><td className="rpt-strong rpt-text-red">- {money(data.expenses_total)}</td></tr>
                        <tr className="rpt-highlight rpt-total-row"><td>{t("netProfit")}</td><td className="rpt-strong" style={{ color: netProfitColor }}>{money(data.net_profit)}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {stock && (
                    <div className="rpt-card">
                      <h3>📦 {t("inventory")}</h3>
                      <table className="rpt-summary-table">
                        <tbody>
                          <tr><td>{t("productCount")}</td><td className="rpt-strong">{stock.product_count}</td></tr>
                          <tr><td>{t("inventoryValue")}</td><td className="rpt-strong">{money(stock.total_value)}</td></tr>
                          <tr><td>{t("lowStockCount")}</td><td className="rpt-strong" style={{ color: stock.low_stock_count > 0 ? "#dc2626" : undefined }}>{stock.low_stock_count}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === المبيعات اليومية === */}
        {activeTab === "daily" && (
          <div className="rpt-content">
            <div className="rpt-section">
              <h2 className="rpt-section-title">📅 {t("dailySalesTab")}</h2>
              {daily.length === 0 ? (
                <div className="rpt-empty">{t("noSalesData")}</div>
              ) : (
                <>
                  <div className="rpt-daily-summary">
                    <span>{t("totalDays")}: <strong>{daily.length}</strong></span>
                    <span>{t("salesTotal")}: <strong>{money(daily.reduce((s, d) => s + d.sales_total, 0))}</strong></span>
                    <span>{t("totalProfit")}: <strong style={{ color: "#16a34a" }}>{money(daily.reduce((s, d) => s + d.profit, 0))}</strong></span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t("date")}</th>
                          <th>{t("invoiceCount")}</th>
                          <th>{t("salesLabel")}</th>
                          <th>{t("profit")}</th>
                          <th>{t("profitRatio")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daily.map((d, i) => {
                          const profitRatio = d.sales_total > 0 ? ((d.profit / d.sales_total) * 100).toFixed(1) : "0";
                          return (
                            <tr key={d.date}>
                              <td>{i + 1}</td>
                              <td className="rpt-strong">{d.date}</td>
                              <td>{d.sales_count}</td>
                              <td>{money(d.sales_total)}</td>
                              <td className="rpt-strong" style={{ color: d.profit >= 0 ? "#16a34a" : "#dc2626" }}>{money(d.profit)}</td>
                              <td>
                                <span className="rpt-ratio-badge" style={{
                                  background: Number(profitRatio) >= 20 ? "#dcfce7" : Number(profitRatio) >= 10 ? "#fef9c3" : "#fee2e2",
                                  color: Number(profitRatio) >= 20 ? "#16a34a" : Number(profitRatio) >= 10 ? "#a16207" : "#dc2626",
                                }}>
                                  {profitRatio}%
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* === الأكثر مبيعاً === */}
        {activeTab === "bestsellers" && (
          <div className="rpt-content">
            <div className="rpt-section">
              <h2 className="rpt-section-title">🏆 {t("bestsellersTab")}</h2>
              {bestsellers.length === 0 ? (
                <div className="rpt-empty">{t("noSalesData")}</div>
              ) : (
                <>
                  <div className="rpt-daily-summary">
                    <span>{t("totalProducts")}: <strong>{bestsellers.length}</strong></span>
                    <span>{t("totalRevenue")}: <strong>{money(bestsellers.reduce((s, b) => s + b.revenue, 0))}</strong></span>
                    <span>{t("totalQuantity")}: <strong>{qty(bestsellers.reduce((s, b) => s + b.quantity, 0))}</strong></span>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t("product")}</th>
                          <th>{t("soldQuantity")}</th>
                          <th>{t("revenue")}</th>
                          <th>{t("rank")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bestsellers.map((b, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td className="rpt-strong">{b.product_name}</td>
                            <td>{qty(b.quantity)}</td>
                            <td className="rpt-strong">{money(b.revenue)}</td>
                            <td>
                              <span className="rpt-rank-badge" style={{
                                background: i === 0 ? "#fef3c7" : i === 1 ? "#e5e7eb" : i === 2 ? "#fed7aa" : "#f3f4f6",
                                color: i === 0 ? "#a16207" : i === 1 ? "#374151" : i === 2 ? "#c2410c" : "#6b7280",
                              }}>
                                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showSalesReport && <SalesReportPopup onClose={() => setShowSalesReport(false)} />}
      {showPurchasesReport && <PurchaseReportPopup onClose={() => setShowPurchasesReport(false)} />}
    </div>
  );
}
