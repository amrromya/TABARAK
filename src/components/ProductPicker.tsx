import { useState, useRef, useEffect } from "react";
import { money, qty } from "./ui";
import type { Product } from "../types";

export function ProductPicker({
  products,
  onSelect,
  onViewMovements,
  placeholder,
  getPrice,
}: {
  products: Product[];
  onSelect: (product: Product) => void;
  onViewMovements: (product: Product) => void;
  placeholder?: string;
  getPrice: (product: Product) => number;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="product-picker" ref={ref}>
      <input
        type="text"
        placeholder={placeholder || "بحث عن منتج..."}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
      />
      {isOpen && filtered.length > 0 && (
        <div className="product-picker-dropdown">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="product-picker-item"
              onClick={() => {
                onSelect(p);
                setIsOpen(false);
                setSearch("");
              }}
            >
              <div className="product-picker-info">
                <span className="strong">{p.name}</span>
                <span className="hint">
                  متوفر: {qty(p.quantity)} | سعر البيع: {money(getPrice(p))} | سعر الشراء: {money(p.cost_price)}
                </span>
              </div>
              <button
                type="button"
                className="btn sm movement-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewMovements(p);
                }}
                title="حركة الصنف"
              >
                حركة صنف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
