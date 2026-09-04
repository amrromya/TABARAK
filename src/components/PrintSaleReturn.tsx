import { useEffect } from "react";
import { printSaleReceipt, getPrintSettings } from "../utils/directPrint";
import type { SaleReturn, Settings } from "../types";

export function PrintSaleReturn({
  saleReturn,
  settings,
  onClose,
}: {
  saleReturn: SaleReturn;
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const ps = getPrintSettings();
        const items = saleReturn.items.map((it) => ({
          name: it.product_name.substring(0, 20),
          qty: String(it.quantity),
          price: it.sell_price.toFixed(2),
          total: it.total.toFixed(2),
        }));

        await printSaleReceipt({
          storeName: settings.store_name || "تبارك",
          phone: settings.phone || "",
          address: settings.address || "",
          invoiceNo: saleReturn.invoice_no,
          date: saleReturn.date,
          customerName: saleReturn.customer_name ?? "نقدي",
          paymentMethod: saleReturn.payment_method,
          employeeName: saleReturn.employee_name || "",
          items,
          total: saleReturn.total,
          discount: saleReturn.discount,
          additional: saleReturn.additional || 0,
          netTotal: saleReturn.total - saleReturn.discount + (saleReturn.additional || 0),
          currency: settings.currency || "ج.م",
          footer: ps.invoiceFooter ? (settings.invoice_footer || "") : "",
        });
      } catch (err) {
        console.error("PrintSaleReturn failed:", err);
      } finally {
        if (!cancelled) onClose();
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return null;
}
