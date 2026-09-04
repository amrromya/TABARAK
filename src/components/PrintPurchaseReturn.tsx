import { useEffect } from "react";
import { printSaleReceipt, getPrintSettings } from "../utils/directPrint";
import type { PurchaseReturn, Settings } from "../types";

export function PrintPurchaseReturn({
  purchaseReturn,
  settings,
  onClose,
}: {
  purchaseReturn: PurchaseReturn;
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ps = getPrintSettings();
        const items = purchaseReturn.items.map((it) => ({
          name: it.product_name.substring(0, 20),
          qty: String(it.quantity),
          price: it.cost_price.toFixed(2),
          total: it.total.toFixed(2),
        }));

        await printSaleReceipt({
          storeName: settings.store_name || "تبارك",
          phone: settings.phone || "",
          address: settings.address || "",
          invoiceNo: purchaseReturn.invoice_no,
          date: purchaseReturn.date,
          customerName: purchaseReturn.supplier_name ?? "—",
          paymentMethod: "",
          employeeName: purchaseReturn.employee_name || "",
          items,
          total: purchaseReturn.total,
          discount: purchaseReturn.discount,
          additional: purchaseReturn.additional || 0,
          netTotal: purchaseReturn.total - purchaseReturn.discount + (purchaseReturn.additional || 0),
          currency: settings.currency || "ج.م",
          footer: ps.invoiceFooter ? (settings.invoice_footer || "") : "",
        });
      } catch (err) {
        console.error("PrintPurchaseReturn failed:", err);
      } finally {
        if (!cancelled) onClose();
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
