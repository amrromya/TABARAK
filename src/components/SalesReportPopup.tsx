import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { money, qty, useToast } from "./ui";
import type { Sale, SaleItem, Settings } from "../types";

interface Props {
  onClose: () => void;
}

export function SalesReportPopup({ onClose }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<SaleItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, st] = await Promise.all([api.listSales(), api.getSettings()]);
      setSales(s);
      setSettings(st);
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = sales.filter((s) => {
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.invoice_no.toLowerCase().includes(q) ||
        (s.customer_name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalFiltered = filtered.reduce((s, x) => s + x.net_total, 0);

  const toggleDetails = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedItems([]);
      return;
    }
    try {
      const full = await api.getSale(id);
      setExpandedItems(full.items);
      setExpandedId(id);
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTableMod = await import("jspdf-autotable");
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      doc.setFontSize(16);
      doc.text("Sales Report - " + (settings?.store_name || "Tabarak"), 105, 15, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${dateFrom || "All"} - ${dateTo || "All"} | Invoices: ${filtered.length} | Total: ${totalFiltered.toFixed(2)}`, 105, 22, { align: "center" });
      doc.setTextColor(0);

      const rows = filtered.map((s) => [
        s.invoice_no,
        s.date,
        s.customer_name ?? "—",
        s.payment_method,
        s.total.toFixed(2),
        s.discount.toFixed(2),
        s.net_total.toFixed(2),
      ]);

      autoTable(doc, {
        startY: 28,
        head: [["Invoice", "Date", "Customer", "Payment", "Total", "Discount", "Net"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [15, 138, 95] },
        styles: { fontSize: 8 },
        columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.text(`Total Net: ${totalFiltered.toFixed(2)}`, 14, finalY);

      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Save Sales Report",
        defaultPath: `sales_report_${dateFrom || "all"}-${dateTo || "all"}.pdf`,
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

  return (
    <div className="report-popup-overlay" onClick={onClose}>
      <div className="report-popup" onClick={(e) => e.stopPropagation()}>
        <div className="report-popup-header">
          <div className="report-popup-title">
            <span className="report-popup-icon" style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>🛒</span>
            <div>
              <h2>تقرير المبيعات</h2>
              <span className="report-popup-sub">{filtered.length} فاتورة — {money(totalFiltered)}</span>
            </div>
          </div>
          <button className="report-popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="report-popup-toolbar">
          <div className="report-popup-search">
            <input
              placeholder="بحث برقم الفاتورة أو اسم العميل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="report-popup-dates">
            <label>
              <span>من</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              <span>إلى</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
            <button className="btn sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>الكل</button>
          </div>
          <button className="btn sm primary" onClick={exportPDF}>📥 PDF</button>
        </div>

        <div className="report-popup-body">
          {loading ? (
            <div className="report-popup-loading">جارٍ التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="report-popup-empty">لا توجد فواتير</div>
          ) : (
            filtered.map((s) => (
              <div key={s.id} className={`report-invoice-card ${expandedId === s.id ? "expanded" : ""}`}>
                <div className="report-invoice-row" onClick={() => toggleDetails(s.id)}>
                  <div className="report-inv-main">
                    <span className="report-inv-no">{s.invoice_no}</span>
                    <span className="report-inv-date">{s.date}</span>
                    <span className="report-inv-customer">{s.customer_name ?? "\u2014"}</span>
                    <span className={`pay-badge ${s.payment_method}`}>{s.payment_method === "cash" ? "نقدي" : s.payment_method === "credit" ? "آجل" : "شبكة"}</span>
                  </div>
                  <div className="report-inv-amounts">
                    {s.discount > 0 && <span className="report-inv-discount">-{money(s.discount)}</span>}
                    <span className="report-inv-net">{money(s.net_total)}</span>
                  </div>
                  <span className="report-inv-expand">{expandedId === s.id ? "▲" : "▼"}</span>
                </div>
                {expandedId === s.id && expandedItems.length > 0 && (
                  <div className="report-invoice-details">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>المنتج</th>
                          <th>الكمية</th>
                          <th>السعر</th>
                          <th>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expandedItems.map((it, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td className="strong">{it.item_name || it.product_name}</td>
                            <td>{qty(it.quantity)}</td>
                            <td>{money(it.sell_price)}</td>
                            <td className="strong">{money(it.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
