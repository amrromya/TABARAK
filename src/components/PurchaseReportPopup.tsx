import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { money, qty, useToast } from "./ui";
import type { Purchase, PurchaseItem, Settings } from "../types";

interface Props {
  onClose: () => void;
}

export function PurchaseReportPopup({ onClose }: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<PurchaseItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, st] = await Promise.all([api.listPurchases(), api.getSettings()]);
      setPurchases(p);
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

  const filtered = purchases.filter((p) => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo && p.date > dateTo) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        (p.supplier_name ?? "").toLowerCase().includes(q) ||
        p.date.includes(q)
      );
    }
    return true;
  });

  const totalFiltered = filtered.reduce((s, x) => s + (x.total - x.discount + (x.additional || 0)), 0);

  const toggleDetails = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedItems([]);
      return;
    }
    try {
      const full = await api.getPurchase(id);
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
      doc.text("Purchases Report - " + (settings?.store_name || "Tabarak"), 105, 15, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${dateFrom || "All"} - ${dateTo || "All"} | Invoices: ${filtered.length} | Total: ${totalFiltered.toFixed(2)}`, 105, 22, { align: "center" });
      doc.setTextColor(0);

      const rows = filtered.map((p) => [
        `#${p.id}`,
        p.date,
        p.supplier_name ?? "—",
        p.total.toFixed(2),
        p.discount.toFixed(2),
        (p.total - p.discount + (p.additional || 0)).toFixed(2),
      ]);

      autoTable(doc, {
        startY: 28,
        head: [["Invoice", "Date", "Supplier", "Total", "Discount", "Net"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 },
        columnStyles: { 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.text(`Total Net: ${totalFiltered.toFixed(2)}`, 14, finalY);

      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Save Purchases Report",
        defaultPath: `purchases_report_${dateFrom || "all"}-${dateTo || "all"}.pdf`,
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
            <span className="report-popup-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}>📦</span>
            <div>
              <h2>تقرير المشتريات</h2>
              <span className="report-popup-sub">{filtered.length} فاتورة — {money(totalFiltered)}</span>
            </div>
          </div>
          <button className="report-popup-close" onClick={onClose}>✕</button>
        </div>

        <div className="report-popup-toolbar">
          <div className="report-popup-search">
            <input
              placeholder="بحث باسم المورد..."
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
            <div className="report-popup-empty">لا توجد فواتير مشتريات</div>
          ) : (
            filtered.map((p) => {
              const net = p.total - p.discount + (p.additional || 0);
              return (
                <div key={p.id} className={`report-invoice-card ${expandedId === p.id ? "expanded" : ""}`}>
                  <div className="report-invoice-row" onClick={() => toggleDetails(p.id)}>
                    <div className="report-inv-main">
                      <span className="report-inv-no">#{p.id}</span>
                      <span className="report-inv-date">{p.date}</span>
                      <span className="report-inv-customer">{p.supplier_name ?? "—"}</span>
                    </div>
                    <div className="report-inv-amounts">
                      {p.discount > 0 && <span className="report-inv-discount">-{money(p.discount)}</span>}
                      <span className="report-inv-net">{money(net)}</span>
                    </div>
                    <span className="report-inv-expand">{expandedId === p.id ? "▲" : "▼"}</span>
                  </div>
                  {expandedId === p.id && expandedItems.length > 0 && (
                    <div className="report-invoice-details">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>المنتج</th>
                            <th>الكمية</th>
                            <th>التكلفة</th>
                            <th>الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody>
                          {expandedItems.map((it, i) => (
                            <tr key={i}>
                              <td>{i + 1}</td>
                              <td className="strong">{it.product_name}</td>
                              <td>{qty(it.quantity)}</td>
                              <td>{money(it.cost_price)}</td>
                              <td className="strong">{money(it.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
