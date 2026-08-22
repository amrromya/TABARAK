import { useState } from "react";
import { money, qty } from "./ui";
import type { Warehouse, WarehouseStats } from "../types";

export type DiscountType = "amount" | "percent";

export interface InvoiceBarProps {
  lines: { quantity: number; price: number }[];
  discount: number;
  setDiscount: (n: number) => void;
  discountType: DiscountType;
  setDiscountType: (t: DiscountType) => void;
  additional: number;
  setAdditional: (n: number) => void;
  warehouses: Warehouse[];
  warehouseId: string;
  setWarehouseId: (s: string) => void;
  warehouseStats: WarehouseStats | null;
  onAddWarehouse: (name: string) => Promise<void>;
}

export function InvoiceBar({
  lines,
  discount,
  setDiscount,
  discountType,
  setDiscountType,
  additional,
  setAdditional,
  warehouses,
  warehouseId,
  setWarehouseId,
  warehouseStats,
  onAddWarehouse,
}: InvoiceBarProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const addWarehouse = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await onAddWarehouse(newName.trim());
      setNewName("");
      setAdding(false);
    } catch {
      /* الخطأ يظهر عبر التنبيه في الصفحة */
    } finally {
      setBusy(false);
    }
  };

  const totalPieces = lines.reduce((s, l) => s + l.quantity, 0);
  const totalPrice = lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const discountAmount =
    discountType === "percent" ? (totalPrice * (discount || 0)) / 100 : discount;
  const net = Math.max(0, totalPrice - discountAmount + (additional || 0));

  return (
    <div className="inv-bar">
      <div className="inv-bar-stat">
        <span>إجمالي القطع</span>
        <b>{qty(totalPieces)}</b>
      </div>
      <div className="inv-bar-stat">
        <span>إجمالي السعر</span>
        <b>{money(totalPrice)}</b>
      </div>

      <div className="inv-bar-field">
        <span>الخصم</span>
        <div className="inv-bar-inputs">
          <input
            type="number"
            min={0}
            step="0.01"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
          <div className="inv-bar-toggle">
            <button
              type="button"
              className={discountType === "amount" ? "active" : ""}
              onClick={() => setDiscountType("amount")}
            >
              مبلغ
            </button>
            <button
              type="button"
              className={discountType === "percent" ? "active" : ""}
              onClick={() => setDiscountType("percent")}
            >
              %
            </button>
          </div>
        </div>
      </div>

      <div className="inv-bar-field">
        <span>الإضافي</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={additional}
          onChange={(e) => setAdditional(Number(e.target.value))}
        />
      </div>

      <div className="inv-bar-field">
        <span>المستودع</span>
        {adding ? (
          <div className="inv-bar-add-wh">
            <input
              autoFocus
              placeholder="اسم المستودع..."
              value={newName}
              disabled={busy}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addWarehouse();
                if (e.key === "Escape") {
                  setAdding(false);
                  setNewName("");
                }
              }}
            />
            <button
              type="button"
              className="btn sm primary"
              disabled={busy || !newName.trim()}
              onClick={addWarehouse}
            >
              حفظ
            </button>
            <button
              type="button"
              className="btn sm"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="inv-bar-wh-select">
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">— بدون مستودع —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="inv-bar-add-btn"
              title="إضافة مستودع جديد"
              onClick={() => setAdding(true)}
            >
              +
            </button>
          </div>
        )}
      </div>

      <div className="inv-bar-wh">
        <span>كمية المستودع: <b>{warehouseStats ? qty(warehouseStats.quantity) : "—"}</b></span>
        <span>قيمة المستودع: <b>{warehouseStats ? money(warehouseStats.value) : "—"}</b></span>
      </div>

      <div className="inv-bar-net">
        <span>الإجمالي</span>
        <b>{money(net)}</b>
      </div>
    </div>
  );
}
