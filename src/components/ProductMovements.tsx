import { useEffect, useState } from "react";
import { api } from "../api";
import { Modal } from "./ui";
import { fmtDate, money, qty } from "./ui";
import type { Product, ProductMovement } from "../types";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  sale: "🧾 بيع",
  purchase: "📦 شراء",
  sale_return: "↩️ مردود مبيعات",
  purchase_return: "📥 مردود مشتريات",
  maintenance: "🔧 صيانة",
};

const MOVEMENT_TYPE_CLASS: Record<string, string> = {
  sale: "type-sale",
  purchase: "type-purchase",
  sale_return: "type-return",
  purchase_return: "type-return",
  maintenance: "type-maintenance",
};

export function ProductMovements({
  product,
  onClose,
  onViewInvoice,
}: {
  product: Product;
  onClose: () => void;
  onViewInvoice: (movement: ProductMovement) => void;
}) {
  const [movements, setMovements] = useState<ProductMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getProductMovements(product.id)
      .then((data) => {
        if (active) {
          setMovements(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [product.id]);

  return (
    <Modal title={`حركة الصنف: ${product.name}`} onClose={onClose} width="820px">
      {loading ? (
        <div className="empty">جارٍ التحميل...</div>
      ) : movements.length === 0 ? (
        <div className="empty">لا توجد حركات مسجلة لهذا الصنف.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>المرجع</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
                <th>العميل / المورد</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m, idx) => (
                <tr
                  key={`${m.type}-${m.id}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => onViewInvoice(m)}
                >
                  <td className="text-center">{idx + 1}</td>
                  <td>{fmtDate(m.date)}</td>
                  <td>
                    <span className={`stmt-type-badge ${MOVEMENT_TYPE_CLASS[m.type] || ""}`}>
                      {MOVEMENT_TYPE_LABELS[m.type] || m.type}
                    </span>
                  </td>
                  <td className="strong">{m.reference}</td>
                  <td className={m.quantity > 0 ? "text-green" : "text-red"}>
                    {m.quantity > 0 ? "+" : ""}
                    {qty(m.quantity)}
                  </td>
                  <td>{money(m.price)}</td>
                  <td>{money(m.total)}</td>
                  <td>
                    {m.customer_name ??
                      m.supplier_name ??
                      m.warehouse_name ??
                      "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="form-actions">
        <button type="button" className="btn" onClick={onClose}>
          إغلاق
        </button>
      </div>
    </Modal>
  );
}
