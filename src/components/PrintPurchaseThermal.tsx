import { useEffect } from "react";
import { printSaleReceipt, getPrintSettings } from "../utils/directPrint";
import type { Purchase, Settings } from "../types";

export function PrintPurchaseThermal({
  purchase,
  settings,
  onClose,
}: {
  purchase: Purchase;
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ps = getPrintSettings();
        const items = purchase.items.map((it) => ({
          name: it.product_name.substring(0, 20),
          qty: String(it.quantity),
          price: it.cost_price.toFixed(2),
          total: it.total.toFixed(2),
        }));

        await printSaleReceipt({
          storeName: settings.store_name || "تبارك",
          phone: settings.phone || "",
          address: settings.address || "",
          invoiceNo: String(purchase.id),
          date: purchase.date,
          customerName: purchase.supplier_name || "—",
          paymentMethod: "",
          employeeName: purchase.employee_name || "",
          items,
          total: purchase.total,
          discount: purchase.discount,
          additional: purchase.additional || 0,
          netTotal: purchase.total - purchase.discount + (purchase.additional || 0),
          currency: settings.currency || "ج.م",
          footer: ps.invoiceFooter ? (settings.invoice_footer || "") : "",
        });
      } catch (err) {
        console.error("PrintPurchaseThermal failed:", err);
      } finally {
        if (!cancelled) onClose();
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
