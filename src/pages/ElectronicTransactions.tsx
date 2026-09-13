import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import { money, useToast, confirmDialog } from "../components/ui";
import { t } from "../i18n";
import type { Sale } from "../types";
import { getPrintSettings } from "../utils/directPrint";
import PrintPreview from "../components/PrintPreview";

const ELECTRONIC_LABELS: Record<string, string> = {
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
};

interface ElectronicTxn {
  id: number;
  invoice_no: string;
  date: string;
  customer_name: string;
  total: number;
  payment_method: string;
}

export function ElectronicTransactions({ onBack, onViewSale }: { onBack: () => void; onViewSale?: (id: number) => void }) {
  const [txns, setTxns] = useState<ElectronicTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [printPreview, setPrintPreview] = useState<{ sale: Sale; html: string; title: string } | null>(null);
  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTxns(await api.getElectronicTransactions());
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (tx: ElectronicTxn) => {
    if (!confirmDialog(`هل تريد حذف الفاتورة ${tx.invoice_no}؟ سترجع الكميات للمخزون.`)) return;
    try {
      await api.deleteSale(tx.id);
      notify("تم حذف الفاتورة");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const handleView = (id: number) => {
    onViewSale?.(id);
  };

  const handlePrint = async (id: number) => {
    try {
      const sale = await api.getSale(id);
      const items = (sale.items || []).map((it: any) =>
        `<tr><td>${it.product_name}</td><td>${it.quantity}</td><td>${Number(it.sell_price).toFixed(2)}</td><td>${Number(it.total).toFixed(2)}</td></tr>`
      ).join("");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
        body{font-family:'Cairo',Arial,sans-serif;text-align:center;padding:10px;font-size:12px}
        table{width:100%;border-collapse:collapse;margin:8px 0}
        th,td{border:1px solid #ddd;padding:4px 6px;font-size:11px}
        th{background:#f5f5f5}
      </style></head><body>
        <h3 style="margin:0">📄 فاتورة ${sale.invoice_no}</h3>
        <p style="margin:2px 0;color:#666">${sale.date} | ${sale.customer_name || "نقدي"} | ${ELECTRONIC_LABELS[sale.payment_method] || sale.payment_method}</p>
        <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>المبلغ</th></tr></thead><tbody>${items}</tbody></table>
        <p style="font-size:14px;font-weight:700">الإجمالي: ${Number(sale.net_total).toFixed(2)}</p>
      </body></html>`;
      setPrintPreview({ sale, html, title: sale.invoice_no });
    } catch (e) {
      notify(String(e), "error");
    }
  };

  const generateSaleHtml = (sale: Sale) => {
    const items = (sale.items || []).map((it: any) =>
      `<tr><td>${it.product_name}</td><td>${it.quantity}</td><td>${Number(it.sell_price).toFixed(2)}</td><td>${Number(it.total).toFixed(2)}</td></tr>`
    ).join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:'Cairo',Arial,sans-serif;text-align:center;padding:10px;font-size:12px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th,td{border:1px solid #ddd;padding:4px 6px;font-size:11px}
      th{background:#f5f5f5}
    </style></head><body>
      <h3 style="margin:0">📄 فاتورة ${sale.invoice_no}</h3>
      <p style="margin:2px 0;color:#666">${sale.date} | ${sale.customer_name || "نقدي"} | ${ELECTRONIC_LABELS[sale.payment_method] || sale.payment_method}</p>
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>المبلغ</th></tr></thead><tbody>${items}</tbody></table>
      <p style="font-size:14px;font-weight:700">الإجمالي: ${Number(sale.net_total).toFixed(2)}</p>
    </body></html>`;
  };

  const totalAll = txns.reduce((s, tx) => s + tx.total, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn" onClick={onBack} style={{ fontSize: 13 }}>← رجوع</button>
          <h1>💳 {t("electronicTransactions")}</h1>
        </div>
        <span className="date-badge" style={{ background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>
          الإجمالي: {money(totalAll)}
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>جاري التحميل...</div>
      ) : txns.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 16 }}>
          لا توجد عمليات إلكترونية
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ padding: "10px 16px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0", fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#166534" }}>عدد الفواتير: </span>
              <span style={{ fontWeight: 700, color: "#15803d" }}>{txns.length}</span>
            </div>
            {txns.filter(t => t.payment_method === "card_visa").length > 0 && (
              <div style={{ padding: "10px 16px", background: "#f5f3ff", borderRadius: 8, border: "1px solid #ddd6fe", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#6d28d9" }}>فيزا: </span>
                <span style={{ fontWeight: 700, color: "#7c3aed" }}>
                  {money(txns.filter(t => t.payment_method === "card_visa").reduce((s, t) => s + t.total, 0))}
                </span>
              </div>
            )}
            {txns.filter(t => t.payment_method === "card_wallet").length > 0 && (
              <div style={{ padding: "10px 16px", background: "#fffbeb", borderRadius: 8, border: "1px solid #fde68a", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#92400e" }}>محفظة: </span>
                <span style={{ fontWeight: 700, color: "#d97706" }}>
                  {money(txns.filter(t => t.payment_method === "card_wallet").reduce((s, t) => s + t.total, 0))}
                </span>
              </div>
            )}
            {txns.filter(t => t.payment_method === "card").length > 0 && (
              <div style={{ padding: "10px 16px", background: "#eef2ff", borderRadius: 8, border: "1px solid #c7d2fe", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: "#3730a3" }}>شبكة: </span>
                <span style={{ fontWeight: 700, color: "#4f46e5" }}>
                  {money(txns.filter(t => t.payment_method === "card").reduce((s, t) => s + t.total, 0))}
                </span>
              </div>
            )}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الفاتورة</th>
                  <th>التاريخ</th>
                  <th>العميل</th>
                  <th>الطريقة</th>
                  <th>المبلغ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((tx, idx) => (
                  <tr key={tx.id}>
                    <td style={{ color: "#94a3b8" }}>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{tx.invoice_no}</td>
                    <td>{tx.date}</td>
                    <td>{tx.customer_name || "نقدي"}</td>
                    <td>
                      <span style={{
                        display: "inline-block", padding: "3px 10px", borderRadius: 6,
                        fontSize: 11, fontWeight: 600,
                        background: tx.payment_method === "card_visa" ? "#ede9fe" : tx.payment_method === "card_wallet" ? "#fef3c7" : "#e0e7ff",
                        color: tx.payment_method === "card_visa" ? "#6d28d9" : tx.payment_method === "card_wallet" ? "#92400e" : "#3730a3",
                      }}>
                        {ELECTRONIC_LABELS[tx.payment_method] || tx.payment_method}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: "#059669" }}>{money(tx.total)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button className="btn sm" onClick={() => handleView(tx.id)}>
                          👁️ عرض
                        </button>
                        <button className="btn sm" onClick={() => handlePrint(tx.id)}>
                          🖨️ طباعة
                        </button>
                        <button className="btn sm danger" onClick={() => handleDelete(tx)}>
                          🗑️ حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {printPreview && (
        <PrintPreview
          html={printPreview.html}
          title={printPreview.title}
          paperSize={getPrintSettings().receiptPrinter || "80mm"}
          onClose={() => setPrintPreview(null)}
          onPaperSizeChange={() => {
            setPrintPreview({ ...printPreview, html: generateSaleHtml(printPreview.sale) });
          }}
          onPrint={async (printer, copiesCount) => {
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("print_html_direct", { htmlContent: printPreview.html, printerName: printer || "", copies: copiesCount || 1 });
              notify("تمت الطباعة بنجاح ✓", "success");
            } catch (e) { notify(String(e), "error"); }
            setPrintPreview(null);
          }}
        />
      )}
    </div>
  );
}
