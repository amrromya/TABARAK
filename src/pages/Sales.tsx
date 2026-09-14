import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import PrintPreview from "../components/PrintPreview";
import { ProductMovements } from "../components/ProductMovements";
import { ProductPicker } from "../components/ProductPicker";
import { getPrintSettings, getCompanyLogo } from "../utils/directPrint";
import {
  Field,
  Modal,
  confirmDialog,
  fmtDate,
  money,
  qty,
  today,
  useToast,
} from "../components/ui";
import type { Customer, Employee, Product, Sale, SaleReturn, Settings, ProductMovement } from "../types";

interface Line {
  product_id: number;
  quantity: number;
  sell_price: number;
}

const PAYMENT_METHODS = [
  { value: "cash", label: "نقدي" },
  { value: "card", label: "شبكة" },
  { value: "credit", label: "آجل" },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "نقدي",
  card: "شبكة",
  card_visa: "شبكة - فيزا",
  card_wallet: "شبكة - محفظة",
  credit: "آجل",
};

export function Sales({
  onViewSale,
  onNewSale,
}: {
  onViewSale?: (id: number) => void;
  onNewSale?: () => void;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [viewingReturn, setViewingReturn] = useState<SaleReturn | null>(null);
  const [showMovements, setShowMovements] = useState(false);
  const [movementProduct, setMovementProduct] = useState<Product | null>(null);
  const [showTodayItems, setShowTodayItems] = useState(false);
  const [itemsSearch, setItemsSearch] = useState("");
  const [itemsDateFrom, setItemsDateFrom] = useState(today());
  const [itemsDateTo, setItemsDateTo] = useState(today());
  const [itemsExporting, setItemsExporting] = useState(false);

  const [date, setDate] = useState(today());
  const [customer, setCustomer] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [cardSubType, setCardSubType] = useState<"visa" | "wallet">("visa");
  const [walletPhone, setWalletPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [lines, setLines] = useState<Line[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");

  const [selProduct, setSelProduct] = useState("");
  const [selQty, setSelQty] = useState(1);
  const [selPrice, setSelPrice] = useState(0);

  const [customerType, setCustomerType] = useState("regular");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [printPreview, setPrintPreview] = useState<{ html: string; title: string; sale: Sale; paperSize?: string } | null>(null);
  const [printReturnPreview, setPrintReturnPreview] = useState<{ html: string; title: string; ret: SaleReturn; paperSize?: string } | null>(null);

  const notify = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSales(await api.listSales(search || undefined));
    } catch (e) {
      notify(String(e), "error");
    } finally {
      setLoading(false);
    }
  }, [search, notify]);

  useEffect(() => {
    load();
    api.getSettings().then(setSettings).catch(() => {});
  }, [load]);

  const generateInvoiceHtml = (sale: Sale, s: Settings, paperOverride?: string): string => {
    const ps = getPrintSettings();
    const paper = paperOverride || ps.receiptPrinter || "80mm";
    const fontSize = ps.receiptFontSize || 10;
    const isThermal = paper === "58mm" || paper === "80mm";
    const bodyWidth = paper === "58mm" ? "58mm" : paper === "80mm" ? "80mm" : paper === "A5" ? "148mm" : "210mm";
    const align = ps.receiptHeaderAlign || "center";
    const pad = isThermal ? "4mm" : "12mm";
    const headerSize = isThermal ? fontSize + 6 : fontSize + 12;
    const titleSize = isThermal ? fontSize + 2 : fontSize + 5;

    const items = (sale.items || [])
      .filter((it) => !(it.sell_price === 0 && !it.product_name))
      .map((it, idx) => {
        const name = (it.product_name || "").substring(0, isThermal ? 18 : 35);
        return `<tr>
          <td style="padding:3px 0;border-bottom:1px solid #eee">${idx + 1}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee">${name}</td>
          <td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center">${Number(it.sell_price).toFixed(2)}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center;font-weight:700">${Number(it.total).toFixed(2)}</td>
        </tr>`;
      }).join("");

    return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: ${bodyWidth} auto; margin: ${isThermal ? "2mm" : "8mm"}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo','Segoe UI',Tahoma,sans-serif; font-size:${isThermal ? fontSize : fontSize + 1}px; width:${bodyWidth}; margin:0 auto; padding:${pad}; direction:rtl; color:#1a1a2e; -webkit-print-color-adjust:exact; print-color-adjust:exact; line-height:1.5; }
  .invoice-box { border:${isThermal ? "none" : "2px solid #0f3460"}; border-radius:${isThermal ? "0" : "12px"}; padding:${isThermal ? "2mm" : "8mm"}; background:#fff; }
  .header { text-align:${align}; margin-bottom:${isThermal ? "2mm" : "5mm"}; }
  .store-name { font-size:${headerSize}px; font-weight:800; color:#0f3460; letter-spacing:1px; margin-bottom:2mm; }
  .store-info { font-size:${isThermal ? fontSize - 2 : fontSize}px; color:#555; line-height:1.6; }
  .divider { border:none; border-top:2px solid #0f3460; margin:${isThermal ? "2mm" : "4mm"} 0; }
  .divider-dashed { border:none; border-top:1px dashed #ccc; margin:${isThermal ? "1.5mm" : "3mm"} 0; }
  .doc-badge { display:inline-block; background:#0f3460; color:#fff; padding:${isThermal ? "1mm 3mm" : "2mm 6mm"}; border-radius:6px; font-size:${titleSize}px; font-weight:700; margin:${isThermal ? "1mm 0" : "2mm 0"}; letter-spacing:0.5px; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:${isThermal ? "1mm" : "2mm"}; margin:${isThermal ? "2mm" : "4mm"} 0; font-size:${isThermal ? fontSize - 1 : fontSize}px; }
  .meta-item { display:flex; flex-direction:column; }
  .meta-label { font-size:${isThermal ? fontSize - 3 : fontSize - 2}px; color:#888; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .meta-value { font-weight:700; color:#1a1a2e; }
  .items-table { width:100%; border-collapse:collapse; margin:${isThermal ? "2mm" : "4mm"} 0; font-size:${isThermal ? fontSize - 1 : fontSize}px; }
  .items-table thead th { background:#0f3460; color:#fff; padding:${isThermal ? "1.5mm" : "2.5mm"} ${isThermal ? "1mm" : "2mm"}; font-weight:700; font-size:${isThermal ? fontSize - 2 : fontSize - 1}px; text-align:center; }
  .items-table tbody tr:nth-child(even) { background:#f8f9fc; }
  .items-table td { padding:${isThermal ? "1.5mm" : "2.5mm"} ${isThermal ? "1mm" : "2mm"}; border-bottom:1px solid #eee; }
  .totals-box { margin:${isThermal ? "2mm" : "5mm"} 0; background:#f8f9fc; border-radius:${isThermal ? "0" : "8px"}; padding:${isThermal ? "2mm" : "4mm"}; }
  .total-row { display:flex; justify-content:space-between; padding:${isThermal ? "0.8mm" : "1.5mm"} 0; font-size:${isThermal ? fontSize - 1 : fontSize}px; }
  .total-row.grand { font-weight:800; font-size:${isThermal ? fontSize + 2 : fontSize + 4}px; color:#0f3460; border-top:2px solid #0f3460; padding-top:${isThermal ? "2mm" : "3mm"}; margin-top:${isThermal ? "1mm" : "2mm"}; }
  .payment-badge { display:inline-block; background:#e8f5e9; color:#2e7d32; padding:${isThermal ? "1mm 2mm" : "1.5mm 4mm"}; border-radius:4px; font-size:${isThermal ? fontSize - 1 : fontSize}px; font-weight:600; }
  .footer { text-align:center; margin-top:${isThermal ? "3mm" : "6mm"}; }
  .footer-line { font-size:${isThermal ? fontSize - 2 : fontSize - 1}px; color:#888; margin:1mm 0; }
  .thank-you { font-size:${isThermal ? fontSize : fontSize + 2}px; font-weight:800; color:#0f3460; margin-top:2mm; }
  @media print { body { width:${bodyWidth}; margin:0; padding:${isThermal ? "2mm" : "8mm"}; } .invoice-box { border:none; } }
</style></head><body>
<div class="invoice-box">
  <div class="header">
    ${(() => { const logo = getCompanyLogo(); return logo ? `<img src="${logo}" alt="logo" style="max-width:${isThermal ? "30mm" : "40mm"};max-height:${isThermal ? "15mm" : "25mm"};object-fit:contain;margin:0 auto ${isThermal ? "1mm" : "3mm"};display:block;" />` : ""; })()}
    <div class="store-name">${s.store_name || "تبارك"}</div>
    <div class="store-info">${s.phone ? `📞 ${s.phone}` : ""}${s.phone && s.address ? " | " : ""}${s.address ? `📍 ${s.address}` : ""}</div>
  </div>
  <hr class="divider">
  <div style="text-align:center"><span class="doc-badge">${sale.doc_type || "فاتورة بيع"}</span></div>
  <div class="meta-grid">
    <div class="meta-item"><span class="meta-label">رقم الفاتورة</span><span class="meta-value">#${sale.invoice_no}</span></div>
    ${ps.receiptShowDate !== false ? `<div class="meta-item"><span class="meta-label">التاريخ</span><span class="meta-value">${sale.date}</span></div>` : ""}
    ${ps.receiptShowCustomer !== false ? `<div class="meta-item"><span class="meta-label">العميل</span><span class="meta-value">${sale.customer_name || "نقدي"}</span></div>` : ""}
    ${ps.receiptShowPayment !== false ? `<div class="meta-item"><span class="meta-label">طريقة الدفع</span><span class="meta-value">${sale.payment_method === "cash" ? "💵 نقدي" : sale.payment_method === "card" ? "💳 فيزا" : sale.payment_method}</span></div>` : ""}
    ${ps.receiptShowEmployee !== false && sale.employee_name ? `<div class="meta-item"><span class="meta-label">الموظف</span><span class="meta-value">${sale.employee_name}</span></div>` : ""}
  </div>
  <hr class="divider-dashed">
  <table class="items-table">
    <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div class="totals-box">
    <div class="total-row"><span>الإجمالي:</span><span>${money(sale.total)}</span></div>
    ${sale.discount > 0 ? `<div class="total-row"><span>الخصم:</span><span>-${money(sale.discount)}</span></div>` : ""}
    ${sale.additional > 0 ? `<div class="total-row"><span>إضافي:</span><span>+${money(sale.additional)}</span></div>` : ""}
    <div class="total-row grand"><span>الصافي:</span><span>${money(sale.net_total)}</span></div>
  </div>
  <div style="text-align:center;margin:${isThermal ? "2mm" : "4mm"} 0">
    <span class="payment-badge">✅ ${sale.payment_method === "cash" ? "نقدي" : sale.payment_method === "card" ? "شبكة" : sale.payment_method}</span>
  </div>
  <div class="footer">
    ${s.invoice_footer ? `<div class="footer-line">${s.invoice_footer}</div>` : ""}
    <div class="thank-you">شكراً لاختياركم تبارك</div>
  </div>
</div>
</body></html>`;
  };

  const generateReturnHtml = (ret: SaleReturn, s: Settings, paperOverride?: string): string => {
    const ps = getPrintSettings();
    const paper = paperOverride || ps.receiptPrinter || "80mm";
    const fontSize = ps.receiptFontSize || 10;
    const isThermal = paper === "58mm" || paper === "80mm";
    const bodyWidth = paper === "58mm" ? "58mm" : paper === "80mm" ? "80mm" : paper === "A5" ? "148mm" : "210mm";
    const headerSize = isThermal ? fontSize + 6 : fontSize + 12;
    const titleSize = isThermal ? fontSize + 2 : fontSize + 5;

    const items = (ret.items || [])
      .filter((it) => !(it.sell_price === 0 && !it.product_name))
      .map((it, idx) => {
        const name = (it.product_name || "").substring(0, isThermal ? 18 : 35);
        return `<tr>
          <td style="padding:3px 0;border-bottom:1px solid #eee">${idx + 1}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee">${name}</td>
          <td style="padding:3px 4px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center">${Number(it.sell_price).toFixed(2)}</td>
          <td style="padding:3px 0;border-bottom:1px solid #eee;text-align:center;font-weight:700">${Number(it.total).toFixed(2)}</td>
        </tr>`;
      }).join("");

    return `<!DOCTYPE html>
<html lang="ar"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: ${bodyWidth} auto; margin: ${isThermal ? "2mm" : "8mm"}; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Cairo',sans-serif; font-size:${isThermal ? fontSize : fontSize + 1}px; width:${bodyWidth}; margin:0 auto; padding:12mm; direction:rtl; color:#1a1a2e; -webkit-print-color-adjust:exact; }
  .invoice-box { border:${isThermal ? "none" : "2px solid #dc2626"}; border-radius:${isThermal ? "0" : "12px"}; padding:8mm; background:#fff; }
  .header { text-align:center; margin-bottom:5mm; }
  .store-name { font-size:${headerSize}px; font-weight:800; color:#dc2626; }
  .doc-badge { display:inline-block; background:#dc2626; color:#fff; padding:2mm 6mm; border-radius:6px; font-size:${titleSize}px; font-weight:700; margin:2mm 0; }
  .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:2mm; margin:4mm 0; }
  .meta-label { font-size:${fontSize - 2}px; color:#888; font-weight:600; text-transform:uppercase; }
  .meta-value { font-weight:700; }
  .items-table { width:100%; border-collapse:collapse; margin:4mm 0; }
  .items-table thead th { background:#dc2626; color:#fff; padding:2.5mm 2mm; font-weight:700; text-align:center; }
  .items-table tbody tr:nth-child(even) { background:#fef2f2; }
  .items-table td { padding:2.5mm 2mm; border-bottom:1px solid #eee; }
  .total-row { display:flex; justify-content:space-between; padding:1.5mm 0; }
  .total-row.grand { font-weight:800; font-size:${fontSize + 4}px; color:#dc2626; border-top:2px solid #dc2626; }
</style></head><body>
<div class="invoice-box">
  <div class="header">
    ${(() => { const logo = getCompanyLogo(); return logo ? `<img src="${logo}" alt="logo" style="max-width:${isThermal ? "30mm" : "40mm"};max-height:${isThermal ? "15mm" : "25mm"};object-fit:contain;margin:0 auto ${isThermal ? "1mm" : "3mm"};display:block;" />` : ""; })()}
    <div class="store-name">${s.store_name || "تبارك"}</div>
  </div>
  <div style="text-align:center"><span class="doc-badge">مردود مبيعات</span></div>
  <div class="meta-grid">
    <div><span class="meta-label">رقم المردود:</span> <b>${ret.invoice_no}</b></div>
    <div><span class="meta-label">التاريخ:</span> <b>${ret.date}</b></div>
    <div><span class="meta-label">العميل:</span> <b>${ret.customer_name || "—"}</b></div>
    <div><span class="meta-label">طريقة الدفع:</span> <b>${ret.payment_method}</b></div>
  </div>
  <table class="items-table">
    <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${items}</tbody>
  </table>
  <div style="margin:4mm 0;background:#fef2f2;padding:4mm;border-radius:8px">
    <div class="total-row"><span>الإجمالي:</span><span>${money(ret.total)}</span></div>
    ${ret.discount > 0 ? `<div class="total-row"><span>الخصم:</span><span>-${money(ret.discount)}</span></div>` : ""}
    <div class="total-row grand"><span>الصافي:</span><span>${money(ret.total - ret.discount + (ret.additional || 0))}</span></div>
  </div>
</div>
</body></html>`;
  };

  const openNew = async () => {
    try {
      const [p, c, emps] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCustomers(c);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setCustomer("");
    setCustomerId("");
    setPaymentMethod("cash");
    setDiscount(0);
    setLines([]);
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
    setCustomerType("regular");
    setShowNewCustomer(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
    setEmployeeId("1");
    setShowForm(true);
  };

  const onSelectProduct = (p: Product) => {
    setSelProduct(String(p.id));
    setSelPrice(customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price);
    setSelQty(1);
  };


  const addLine = () => {
    if (!selProduct) {
      notify("اختر المنتج أولاً", "error");
      return;
    }
    const pid = Number(selProduct);
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    if (selQty <= 0) {
      notify("الكمية يجب أن تكون أكبر من صفر", "error");
      return;
    }
    setLines((ls) => {
      const existing = ls.find((l) => l.product_id === pid);
      if (existing) {
        return ls.map((l) =>
          l.product_id === pid
            ? { ...l, quantity: l.quantity + selQty, sell_price: selPrice }
            : l,
        );
      }
      return [...ls, { product_id: pid, quantity: selQty, sell_price: selPrice }];
    });
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
  };

  const removeLine = (pid: number) =>
    setLines((ls) => ls.filter((l) => l.product_id !== pid));

  const total = lines.reduce((s, l) => s + l.quantity * l.sell_price, 0);
  const netTotal = Math.max(0, total - discount);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "credit" && !customerId) {
      notify("اختر عميلًا للبيع الآجل", "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify("أدخل رقم الجوال للتحويل", "error");
      return;
    }

    let finalCustomerId = customerId ? Number(customerId) : null;
    let finalCustomerName = customer || null;

    if (showNewCustomer && newCustomerName.trim()) {
      try {
        const nc = await api.createCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          customer_type: customerType,
        });
        finalCustomerId = nc.id;
        finalCustomerName = nc.name;
        setCustomers(await api.listCustomers());
      } catch (err) {
        notify("فشل إنشاء العميل: " + String(err), "error");
        return;
      }
    }

    const effectivePayment = paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod;
    const effectiveCustomer = paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : finalCustomerName;
    try {
      const sale = await api.createSale({
        date,
        discount,
        customer_name: effectiveCustomer,
        customer_id: finalCustomerId,
        payment_method: effectivePayment,
        employee_id: employeeId ? Number(employeeId) : null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          sell_price: l.sell_price,
        })),
      });
      notify(`تم تسجيل الفاتورة ${sale.invoice_no}`);
      setShowForm(false);
      load();
      setSettings(await api.getSettings());
      setViewingSale(sale);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const saveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "credit" && !customerId) {
      notify("اختر عميلًا لمردود المبيعات الآجل", "error");
      return;
    }
    if (paymentMethod === "card" && cardSubType === "wallet" && !walletPhone.trim()) {
      notify("أدخل رقم الجوال للتحويل", "error");
      return;
    }
    const effectivePayment = paymentMethod === "card" ? (cardSubType === "wallet" ? "card_wallet" : "card_visa") : paymentMethod;
    const effectiveCustomer = paymentMethod === "card" && cardSubType === "wallet" && walletPhone.trim() ? walletPhone.trim() : (customer || null);
    try {
      const ret = await api.createSaleReturn({
        date,
        discount,
        additional: 0,
        warehouse_id: null,
        customer_name: effectiveCustomer,
        customer_id: customerId ? Number(customerId) : null,
        payment_method: effectivePayment,
        notes: null,
        employee_id: employeeId ? Number(employeeId) : null,
        items: lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          sell_price: l.sell_price,
        })),
      });
      notify(`تم تسجيل مردود المبيعات ${ret.invoice_no}`);
      setShowReturnForm(false);
      load();
      setSettings(await api.getSettings());
      setViewingReturn(ret);
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const handleViewMovement = async (movement: ProductMovement) => {
    try {
      if (movement.type === "sale") {
        const sale = await api.getSale(movement.related_id);
        setSettings(await api.getSettings());
        setViewingSale(sale);
      } else if (movement.type === "sale_return") {
        const ret = await api.getSaleReturn(movement.related_id);
        setSettings(await api.getSettings());
        setViewingReturn(ret);
      } else {
        notify("عرض الفاتورة غير متاح من هنا", "error");
      }
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const remove = async (s: Sale) => {
    if (
      !confirmDialog(
        `هل تريد حذف الفاتورة ${s.invoice_no}؟ سترجع الكميات للمخزون.`,
      )
    )
      return;
    try {
      await api.deleteSale(s.id);
      notify("تم حذف الفاتورة");
      load();
    } catch (err) {
      notify(String(err), "error");
    }
  };

  const openReturn = async () => {
    try {
      const [p, c, emps] = await Promise.all([
        api.listProducts(),
        api.listCustomers(),
        api.listEmployees(),
      ]);
      setProducts(p);
      setCustomers(c);
      setEmployees(emps);
    } catch (e) {
      notify(String(e), "error");
      return;
    }
    setDate(today());
    setCustomer("");
    setCustomerId("");
    setPaymentMethod("cash");
    setDiscount(0);
    setLines([]);
    setSelProduct("");
    setSelQty(1);
    setSelPrice(0);
    setEmployeeId("1");
    setShowReturnForm(true);
  };

  const availableFor = (pid: number) =>
    products.find((p) => p.id === pid)?.quantity ?? 0;

  const totalToday = sales
    .filter((s) => s.date === today())
    .reduce((sum, s) => sum + s.net_total, 0);

  const todayItemsMap = sales
    .filter((s) => {
      if (itemsDateFrom && s.date < itemsDateFrom) return false;
      if (itemsDateTo && s.date > itemsDateTo) return false;
      return true;
    })
    .flatMap((s) => (s.items || []).map((it) => ({ ...it, invoice_no: s.invoice_no, sale_date: s.date })))
    .reduce<Record<string, { product_name: string; quantity: number; sell_price: number; total: number; invoices: string[]; dates: string[] }>>((acc, it) => {
      const key = String(it.product_id);
      if (!acc[key]) acc[key] = { product_name: it.product_name, quantity: 0, sell_price: it.sell_price, total: 0, invoices: [], dates: [] };
      acc[key].quantity += it.quantity;
      acc[key].total += it.total;
      if (!acc[key].invoices.includes(it.invoice_no)) acc[key].invoices.push(it.invoice_no);
      if (!acc[key].dates.includes(it.sale_date)) acc[key].dates.push(it.sale_date);
      return acc;
    }, {});
  const allTodayItems = Object.values(todayItemsMap);
  const todayItems = itemsSearch
    ? allTodayItems.filter((it) => it.product_name.includes(itemsSearch) || it.invoices.some((inv) => inv.includes(itemsSearch)))
    : allTodayItems;

  if (showTodayItems) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>
            <button className="btn" onClick={() => setShowTodayItems(false)} style={{ marginLeft: 10 }}>
              ← رجوع
            </button>
            📦 حركة الأصناف
          </h1>
          <div className="head-actions">
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>من:</label>
              <input type="date" className="search" value={itemsDateFrom} onChange={(e) => setItemsDateFrom(e.target.value)} style={{ width: 150 }} />
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>إلى:</label>
              <input type="date" className="search" value={itemsDateTo} onChange={(e) => setItemsDateTo(e.target.value)} style={{ width: 150 }} />
            </div>
            <button className="btn sm" onClick={() => { setItemsDateFrom(""); setItemsDateTo(""); }}>الكل</button>
            <button className="btn sm" onClick={() => { setItemsDateFrom(today()); setItemsDateTo(today()); }}>اليوم</button>
            <input
              className="search"
              placeholder="🔍 بحث بالاسم أو رقم الفاتورة..."
              value={itemsSearch}
              onChange={(e) => setItemsSearch(e.target.value)}
              style={{ width: 240 }}
            />
            <button className="btn primary" disabled={itemsExporting || todayItems.length === 0} onClick={async () => {
              setItemsExporting(true);
              try {
                const { jsPDF } = await import("jspdf");
                const autoTableMod = await import("jspdf-autotable");
                const autoTable = autoTableMod.default;
                const doc = new jsPDF({ orientation: "l", unit: "mm", format: "a4" });
                const pw = doc.internal.pageSize.getWidth();

                doc.setFontSize(18);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 52, 96);
                doc.text("Items Movement Report", pw / 2, 14, { align: "center" });

                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.setTextColor(100);
                const range = itemsDateFrom && itemsDateTo ? `${itemsDateFrom} - ${itemsDateTo}` : itemsDateFrom ? `From: ${itemsDateFrom}` : itemsDateTo ? `Until: ${itemsDateTo}` : "All Dates";
                doc.text(`Date Range: ${range}`, pw / 2, 21, { align: "center" });
                doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, pw / 2, 26, { align: "center" });
                doc.setDrawColor(15, 52, 96);
                doc.setLineWidth(0.5);
                doc.line(14, 29, pw - 14, 29);

                const tQty = todayItems.reduce((s, it) => s + it.quantity, 0);
                const tAmt = todayItems.reduce((s, it) => s + it.total, 0);

                autoTable(doc, {
                  startY: 33,
                  head: [["#", "Product", "Qty", "Unit Price", "Total", "Invoices"]],
                  body: todayItems.map((it, i) => [
                    i + 1, it.product_name, it.quantity, it.sell_price.toFixed(2), it.total.toFixed(2), it.invoices.join(", "),
                  ]),
                  foot: [["", "TOTAL", String(tQty), "", tAmt.toFixed(2), ""]],
                  theme: "grid",
                  headStyles: { fillColor: [15, 52, 96], textColor: 255, fontStyle: "bold", halign: "center", fontSize: 9 },
                  bodyStyles: { fontSize: 8, halign: "center" },
                  footStyles: { fillColor: [241, 245, 249], textColor: [15, 52, 96], fontStyle: "bold", fontSize: 9 },
                  columnStyles: { 0: { cellWidth: 12 }, 1: { halign: "left", cellWidth: 70 }, 2: { cellWidth: 18 }, 3: { cellWidth: 28 }, 4: { cellWidth: 28, fontStyle: "bold" }, 5: { halign: "left", cellWidth: "auto" } },
                  margin: { left: 14, right: 14 },
                });

                const { save } = await import("@tauri-apps/plugin-dialog");
                const path = await save({ title: "Save Items Movement", defaultPath: `items_movement_${itemsDateFrom || "all"}-${itemsDateTo || "all"}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
                if (path) {
                  const bytes = doc.output("arraybuffer");
                  await api.writeBinaryFile(path, Array.from(new Uint8Array(bytes)));
                  notify("تم تصدير التقرير بنجاح", "success");
                }
              } catch (e) {
                notify("فشل التصدير: " + String(e), "error");
              } finally {
                setItemsExporting(false);
              }
            }}>
              {itemsExporting ? "⏳ جاري..." : "📥 PDF"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1, background: "#f0f4ff", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>عدد الأصناف</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f3460" }}>{todayItems.length}</div>
          </div>
          <div style={{ flex: 1, background: "#f0fdf4", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>إجمالي الكمية</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a" }}>{todayItems.reduce((s, it) => s + it.quantity, 0)}</div>
          </div>
          <div style={{ flex: 1, background: "#fefce8", borderRadius: 10, padding: "10px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>إجمالي المبلغ</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ca8a04" }}>{money(todayItems.reduce((s, it) => s + it.total, 0))}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>الصنف</th>
                <th style={{ width: 70 }}>الكمية</th>
                <th style={{ width: 100 }}>السعر</th>
                <th style={{ width: 100 }}>المبلغ</th>
                <th>الفواتير</th>
              </tr>
            </thead>
            <tbody>
              {todayItems.length === 0 && (
                <tr><td colSpan={6} className="empty">لا توجد أصناف في الفترة المحددة</td></tr>
              )}
              {todayItems.map((it, i) => (
                <tr key={i}>
                  <td style={{ color: "#94a3b8" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{it.product_name}</td>
                  <td>{qty(it.quantity)}</td>
                  <td>{money(it.sell_price)}</td>
                  <td style={{ fontWeight: 700 }}>{money(it.total)}</td>
                  <td style={{ fontSize: 11, color: "#666" }}>{it.invoices.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>سجل المبيعات</h1>
        <div className="head-actions">
          <input
            className="search"
            placeholder="بحث برقم الفاتورة أو اسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn primary" onClick={() => onNewSale ? onNewSale() : openNew()}>
            + فاتورة جديدة
          </button>
          <button className="btn" onClick={() => setShowTodayItems(true)}>
            📦 حركة الأصناف
          </button>
          <button className="btn" onClick={openReturn}>
            + مردود مبيعات
          </button>
        </div>
      </div>

      <div className="toolbar-info">
        <span>
          فواتير اليوم: <b>{sales.filter((s) => s.date === today()).length}</b>
        </span>
        <span>
          مبيعات اليوم: <b>{money(totalToday)}</b>
        </span>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>الفاتورة</th>
              <th>التاريخ</th>
              <th>العميل</th>
              <th>الموظف</th>
              <th>الطريقة</th>
              <th>الإجمالي</th>
              <th>الخصم</th>
              <th>الصافي</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="empty">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && sales.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  لا توجد فواتير بعد.
                </td>
              </tr>
            )}
            {sales.map((s) => (
              <tr key={s.id}>
                <td className="strong">{s.invoice_no}</td>
                <td>{fmtDate(s.date)}</td>
                <td>{s.customer_name ?? "—"}</td>
                <td>{s.employee_name ?? "—"}</td>
                <td>
                  <span className={`pay-badge ${s.payment_method}`}>
                    {PAYMENT_LABELS[s.payment_method] ?? s.payment_method}
                  </span>
                </td>
                <td>{money(s.total)}</td>
                <td>{money(s.discount)}</td>
                <td className="strong">{money(s.net_total)}</td>
                <td className="actions">
                  <button
                    className="btn sm"
                    onClick={() => onViewSale?.(s.id)}
                    title="فتح الفاتورة كاملة"
                  >
                    عرض
                  </button>
                  <button
                    className="btn sm"
                    onClick={async () => {
                      if (!settings) return;
                      try {
                        const full = await api.getSale(s.id);
                        setPrintPreview({ html: generateInvoiceHtml(full, settings), title: full.invoice_no, sale: full });
                      } catch (e) { notify(String(e), "error"); }
                    }}
                    title="طباعة الفاتورة"
                  >
                    🖨️ طباعة
                  </button>
                  <button
                    className="btn sm"
                    onClick={() => openReturn()}
                    title="مردود مبيعات"
                  >
                    مردود
                  </button>
                  <button className="btn sm danger" onClick={() => remove(s)}>
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title="فاتورة بيع جديدة"
          onClose={() => setShowForm(false)}
          width="760px"
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <Field label="التاريخ">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="طريقة الدفع">
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== "card") setCardSubType("visa");
                  }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {paymentMethod === "card" && (
                <Field label="نوع الشبكة">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "visa" ? "primary" : ""}`}
                      onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                    >
                      💳 فيزا
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "wallet" ? "primary" : ""}`}
                      onClick={() => setCardSubType("wallet")}
                    >
                      📱 محفظة إلكترونية
                    </button>
                  </div>
                </Field>
              )}
              {paymentMethod === "card" && cardSubType === "wallet" && (
                <Field label="رقم الجوال للتحويل *">
                  <input
                    type="tel"
                    placeholder="05XXXXXXXX"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </Field>
              )}
              {paymentMethod === "credit" ? (
                <Field label="اختر العميل *">
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.find(
                        (x) => x.id === Number(e.target.value),
                      );
                      setCustomer(c ? c.name : "");
                    }}
                  >
                    <option value="">— اختر العميل —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.balance > 0 ? ` (مدين: ${money(c.balance)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="اسم العميل (اختياري)">
                    <div style={{ display: "flex", gap: 6 }}>
                      <select
                        value={customerId}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__new__") {
                            setShowNewCustomer(true);
                            setCustomerId("");
                            setCustomer("");
                          } else {
                            setCustomerId(v);
                            const c = customers.find((x) => x.id === Number(v));
                            setCustomer(c ? c.name : "");
                            if (c) setCustomerType(c.customer_type || "regular");
                            setShowNewCustomer(false);
                          }
                        }}
                        style={{ flex: 1 }}
                      >
                        <option value="">— اختر عميل —</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.customer_type === "wholesale" ? "(جملة)" : c.customer_type === "merchant" ? "(تاجر)" : ""}
                          </option>
                        ))}
                        <option value="__new__">+ عميل جديد</option>
                      </select>
                    </div>
                  </Field>
                  {showNewCustomer && (
                    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>عميل جديد</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <input
                          placeholder="اسم العميل *"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          style={{ flex: 1, minWidth: 140 }}
                        />
                        <input
                          placeholder="الجوال (اختياري)"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          style={{ flex: 1, minWidth: 120 }}
                        />
                        <select
                          value={customerType}
                          onChange={(e) => setCustomerType(e.target.value)}
                          style={{ minWidth: 120 }}
                        >
                          <option value="regular">عميل جاري</option>
                          <option value="wholesale">عميل جملة</option>
                          <option value="merchant">تاجر</option>
                        </select>
                      </div>
                    </div>
                  )}
                </>
              )}
              <Field label="الموظف (اختياري)">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="line-adder">
              <ProductPicker
                products={products}
                onSelect={onSelectProduct}
                onViewMovements={(p) => {
                  setMovementProduct(p);
                  setShowMovements(true);
                }}
                placeholder="اختر المنتج..."
                getPrice={(p) => customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selQty}
                onChange={(e) => setSelQty(Number(e.target.value))}
                title="الكمية"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selPrice === 0 ? "" : selPrice}
                placeholder="0"
                onChange={(e) => setSelPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                title="سعر البيع"
              />
              <button type="button" className="btn primary" onClick={addLine}>
                + إضافة
              </button>
            </div>

            {lines.length > 0 && (
              <div className="cart">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product_id}>
                        <td>
                          {products.find((p) => p.id === l.product_id)?.name ??
                            l.product_id}
                          <span className="hint">
                            {" "}
                            (متوفر: {qty(availableFor(l.product_id))})
                          </span>
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.sell_price)}</td>
                        <td>{money(l.quantity * l.sell_price)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => removeLine(l.product_id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="totals">
              <Field label="الخصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <div className="total-line">
                <span>الإجمالي:</span>
                <b>{money(total)}</b>
              </div>
              <div className="total-line final">
                <span>الصافي:</span>
                <b>{money(netTotal)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ الفاتورة
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showReturnForm && (
        <Modal
          title="مردود مبيعات"
          onClose={() => setShowReturnForm(false)}
          width="760px"
        >
          <form onSubmit={saveReturn}>
            <div className="form-grid">
              <Field label="التاريخ">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="طريقة الدفع">
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value);
                    if (e.target.value !== "card") setCardSubType("visa");
                  }}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              {paymentMethod === "card" && (
                <Field label="نوع الشبكة">
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "visa" ? "primary" : ""}`}
                      onClick={() => { setCardSubType("visa"); setWalletPhone(""); }}
                    >
                      💳 فيزا
                    </button>
                    <button
                      type="button"
                      className={`btn sm ${cardSubType === "wallet" ? "primary" : ""}`}
                      onClick={() => setCardSubType("wallet")}
                    >
                      📱 محفظة إلكترونية
                    </button>
                  </div>
                </Field>
              )}
              {paymentMethod === "card" && cardSubType === "wallet" && (
                <Field label="رقم الجوال للتحويل *">
                  <input
                    type="tel"
                    placeholder="05XXXXXXXX"
                    value={walletPhone}
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </Field>
              )}
              {paymentMethod === "credit" ? (
                <Field label="اختر العميل *">
                  <select
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      const c = customers.find(
                        (x) => x.id === Number(e.target.value),
                      );
                      setCustomer(c ? c.name : "");
                    }}
                  >
                    <option value="">— اختر العميل —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.balance > 0 ? ` (مدين: ${money(c.balance)})` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="اسم العميل (اختياري)">
                  <input
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    placeholder="للمردود النقدي"
                  />
                </Field>
              )}
              <Field label="الموظف (اختياري)">
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">— اختر الموظف —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="line-adder">
              <ProductPicker
                products={products}
                onSelect={onSelectProduct}
                onViewMovements={(p) => {
                  setMovementProduct(p);
                  setShowMovements(true);
                }}
                placeholder="اختر المنتج..."
                getPrice={(p) => customerType === "wholesale" && p.wholesale_price > 0 ? p.wholesale_price : p.sell_price}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selQty}
                onChange={(e) => setSelQty(Number(e.target.value))}
                title="الكمية"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={selPrice === 0 ? "" : selPrice}
                placeholder="0"
                onChange={(e) => setSelPrice(e.target.value === "" ? 0 : Number(e.target.value))}
                title="سعر البيع"
              />
              <button type="button" className="btn primary" onClick={addLine}>
                + إضافة
              </button>
            </div>

            {lines.length > 0 && (
              <div className="cart">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المنتج</th>
                      <th>الكمية</th>
                      <th>السعر</th>
                      <th>الإجمالي</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.product_id}>
                        <td>
                          {products.find((p) => p.id === l.product_id)?.name ??
                            l.product_id}
                          <span className="hint">
                            {" "}
                            (متوفر: {qty(availableFor(l.product_id))})
                          </span>
                        </td>
                        <td>{qty(l.quantity)}</td>
                        <td>{money(l.sell_price)}</td>
                        <td>{money(l.quantity * l.sell_price)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => removeLine(l.product_id)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="totals">
              <Field label="الخصم">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </Field>
              <div className="total-line">
                <span>الإجمالي:</span>
                <b>{money(total)}</b>
              </div>
              <div className="total-line final">
                <span>الصافي:</span>
                <b>{money(netTotal)}</b>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn primary">
                حفظ مردود المبيعات
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowReturnForm(false)}
              >
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {viewingSale && (
        <Modal title={`فاتورة بيع ${viewingSale.invoice_no}`} onClose={() => setViewingSale(null)} fullScreen>
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(viewingSale.date)}</b></div>
              <div><span>العميل:</span> <b>{viewingSale.customer_name ?? "—"}</b></div>
              <div><span>طريقة الدفع:</span> <b>{viewingSale.payment_method}</b></div>
              {viewingSale.warehouse_name && <div><span>المستودع:</span> <b>{viewingSale.warehouse_name}</b></div>}
              {viewingSale.employee_name && <div><span>الموظف:</span> <b>{viewingSale.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingSale.items.filter((it) => !(it.sell_price === 0 && !it.item_name)).map((it, i) => (
                  <tr key={i}>
                    <td>{it.item_name || it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.sell_price)}</td>
                    <td>{money(it.quantity * it.sell_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-totals">
              <div><span>الإجمالي:</span> <b>{money(viewingSale.total)}</b></div>
              {viewingSale.discount > 0 && <div><span>الخصم:</span> <b>{money(viewingSale.discount)}</b></div>}
              {viewingSale.additional > 0 && <div><span>إضافي:</span> <b>{money(viewingSale.additional)}</b></div>}
              <div className="inv-net"><span>الصافي:</span> <b>{money(viewingSale.net_total)}</b></div>
            </div>
            <div className="form-actions">
              <button
                className="btn primary"
                onClick={() => {
                  if (settings) {
                    setPrintPreview({ html: generateInvoiceHtml(viewingSale, settings), title: viewingSale.invoice_no, sale: viewingSale });
                  }
                }}
              >
                🖨️ طباعة
              </button>
              <button
                className="btn"
                onClick={() => setViewingSale(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}

      {viewingReturn && (
        <Modal title={`فاتورة مردود مبيعات ${viewingReturn.invoice_no}`} onClose={() => setViewingReturn(null)} fullScreen>
          <div className="view-invoice">
            <div className="inv-meta">
              <div><span>التاريخ:</span> <b>{fmtDate(viewingReturn.date)}</b></div>
              <div><span>العميل:</span> <b>{viewingReturn.customer_name ?? "—"}</b></div>
              <div><span>طريقة الدفع:</span> <b>{viewingReturn.payment_method}</b></div>
              {viewingReturn.warehouse_name && <div><span>المستودع:</span> <b>{viewingReturn.warehouse_name}</b></div>}
              {viewingReturn.employee_name && <div><span>الموظف:</span> <b>{viewingReturn.employee_name}</b></div>}
            </div>
            <table className="table">
              <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
              <tbody>
                {viewingReturn.items.filter((it) => !(it.sell_price === 0 && !it.item_name)).map((it, i) => (
                  <tr key={i}>
                    <td>{it.item_name || it.product_name}</td>
                    <td>{qty(it.quantity)}</td>
                    <td>{money(it.sell_price)}</td>
                    <td>{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="inv-totals">
              <div><span>الإجمالي:</span> <b>{money(viewingReturn.total)}</b></div>
              {viewingReturn.discount > 0 && <div><span>الخصم:</span> <b>{money(viewingReturn.discount)}</b></div>}
              {viewingReturn.additional > 0 && <div><span>إضافي:</span> <b>{money(viewingReturn.additional)}</b></div>}
              <div className="inv-net"><span>الصافي:</span> <b>{money(viewingReturn.total - viewingReturn.discount + viewingReturn.additional)}</b></div>
            </div>
            <div className="form-actions">
              <button
                className="btn primary"
                onClick={() => {
                  if (settings) {
                    setPrintReturnPreview({ html: generateReturnHtml(viewingReturn, settings), title: viewingReturn.invoice_no, ret: viewingReturn });
                  }
                }}
              >
                🖨️ طباعة المردود
              </button>
              <button
                className="btn"
                onClick={() => setViewingReturn(null)}
              >
                إغلاق
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showMovements && movementProduct && (
        <ProductMovements
          product={movementProduct}
          onClose={() => setShowMovements(false)}
          onViewInvoice={handleViewMovement}
        />
      )}

      {printPreview && settings && (
        <PrintPreview
          html={printPreview.html}
          title={printPreview.title}
          paperSize={printPreview.paperSize || getPrintSettings().receiptPrinter}
          onClose={() => setPrintPreview(null)}
          onPaperSizeChange={(newSize) => {
            const newHtml = generateInvoiceHtml(printPreview.sale, settings, newSize);
            setPrintPreview({ ...printPreview, html: newHtml, paperSize: newSize });
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

      {printReturnPreview && settings && (
        <PrintPreview
          html={printReturnPreview.html}
          title={printReturnPreview.title}
          paperSize={printReturnPreview.paperSize || getPrintSettings().receiptPrinter}
          onClose={() => setPrintReturnPreview(null)}
          onPaperSizeChange={(newSize) => {
            const newHtml = generateReturnHtml(printReturnPreview.ret, settings, newSize);
            setPrintReturnPreview({ ...printReturnPreview, html: newHtml, paperSize: newSize });
          }}
          onPrint={async (printer, copiesCount) => {
            try {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("print_html_direct", { htmlContent: printReturnPreview.html, printerName: printer || "", copies: copiesCount || 1 });
              notify("تمت طباعة المردود بنجاح ✓", "success");
            } catch (e) { notify(String(e), "error"); }
            setPrintReturnPreview(null);
          }}
        />
      )}
    </div>
  );
}


