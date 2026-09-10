import React, { useState, useEffect, useMemo } from "react";
import {
  getProfessionalPrintSettings,
  generateBarcodeLabelsHTML,
  printDocument,
  BarcodeConfig,
  listAvailablePrinters,
  BarcodeType,
} from "../utils/printSystem";
import { Modal, Field, useToast } from "../components/ui";

interface ProductItem {
  id: number;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  sell_price: number;
  cost_price?: number;
  quantity?: number;
}

interface ProfessionalBarcodePrintProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductItem[];
  defaultQuantityPerProduct?: number;
}

type LocalBarcodeConfig = Omit<
  BarcodeConfig,
  "fontFamily" | "labelGap" | "pageMargin" | "border"
> & {
  border: boolean;
};

export default function ProfessionalBarcodePrint({
  isOpen,
  onClose,
  products,
  defaultQuantityPerProduct = 1,
}: ProfessionalBarcodePrintProps) {
  const toast = useToast();

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [included, setIncluded] = useState<Record<number, boolean>>({});
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [config, setConfig] = useState<LocalBarcodeConfig>(() => {
    const g = getProfessionalPrintSettings().barcodeConfig;
    return {
      widthMm: g.widthMm,
      heightMm: g.heightMm,
      fontSize: g.fontSize,
      showName: g.showName,
      showPrice: g.showPrice,
      showBarcode: g.showBarcode,
      showSku: g.showSku,
      barcodeType: g.barcodeType,
      columnsPerRow: g.columnsPerRow,
      border: g.border,
    };
  });

  useEffect(() => {
    if (!isOpen) return;
    const q: Record<number, number> = {};
    const inc: Record<number, boolean> = {};
    products.forEach((p) => {
      q[p.id] = defaultQuantityPerProduct;
      inc[p.id] = true;
    });
    setQuantities(q);
    setIncluded(inc);
    loadPrinters();
  }, [isOpen, products, defaultQuantityPerProduct]);

  const loadPrinters = async () => {
    if (loadingPrinters) return;
    setLoadingPrinters(true);
    try {
      const list = await listAvailablePrinters();
      setPrinters(list);
      const gs = getProfessionalPrintSettings();
      setSelectedPrinter(gs.defaultPrinter || "");
    } catch {
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  const totalLabels = useMemo(() => {
    let s = 0;
    products.forEach((p) => {
      if (included[p.id]) {
        s += Math.max(1, quantities[p.id] ?? defaultQuantityPerProduct);
      }
    });
    return s;
  }, [products, included, quantities, defaultQuantityPerProduct]);

  const setQty = (id: number, v: number) => {
    const val = Math.max(1, Math.min(999, isNaN(v) ? 1 : v));
    setQuantities((q) => ({ ...q, [id]: val }));
  };

  const toggleInclude = (id: number) => {
    setIncluded((i) => ({ ...i, [id]: !i[id] }));
  };

  const selectAll = () => {
    const inc: Record<number, boolean> = {};
    products.forEach((p) => (inc[p.id] = true));
    setIncluded(inc);
  };

  const selectNone = () => {
    const inc: Record<number, boolean> = {};
    products.forEach((p) => (inc[p.id] = false));
    setIncluded(inc);
  };

  const buildLabels = () => {
    const labels: any[] = [];
    products.forEach((p) => {
      if (!included[p.id]) return;
      const barcode = p.barcode || p.sku || String(p.id);
      labels.push({
        name: p.name,
        barcode,
        price: p.sell_price,
        sku: p.sku || undefined,
        quantity: Math.max(1, quantities[p.id] ?? defaultQuantityPerProduct),
      });
    });
    return labels;
  };

  const runPrint = async (mode: "direct" | "preview") => {
    try {
      const labels = buildLabels();
      if (!labels.length) {
        toast("⚠️ اختر صنفًا واحدًا على الأقل للطباعة", "error");
        return;
      }
      const mergedCfg: Partial<BarcodeConfig> = {
        widthMm: config.widthMm,
        heightMm: config.heightMm,
        fontSize: config.fontSize,
        showName: config.showName,
        showPrice: config.showPrice,
        showBarcode: config.showBarcode,
        showSku: config.showSku,
        barcodeType: config.barcodeType,
        columnsPerRow: config.columnsPerRow,
        border: config.border,
      };
      const html = generateBarcodeLabelsHTML(labels, mergedCfg);
      const extraConfig: any = { mode };
      if (selectedPrinter) extraConfig.printer = selectedPrinter;
      await printDocument("barcode_label", html, extraConfig);
      toast(`✅ تم ${mode === "direct" ? "إرسال" : "عرض"} ${labels.length} ملصق بنجاح`, "success");
    } catch (e: any) {
      toast("❌ فشل في الطباعة: " + (e?.message || "خطأ غير معروف"), "error");
    }
  };

  if (!isOpen) return null;

  const includedCount = products.filter((p) => included[p.id]).length;

  return (
    <Modal title="🏷️ طباعة ملصقات الباركود" onClose={onClose} width="900px">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "18px",
          direction: "rtl",
          fontFamily: "inherit",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#1f2937" }}>
              📦 قائمة المنتجات ({products.length})
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#374151",
                }}
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={selectNone}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#374151",
                }}
              >
                مسح الكل
              </button>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              maxHeight: "420px",
              overflowY: "auto",
              background: "#fafafa",
            }}
          >
            {!products.length ? (
              <div
                style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: "#6b7280",
                  fontSize: "13px",
                }}
              >
                لا توجد منتجات لعرضها
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr
                    style={{
                      position: "sticky",
                      top: 0,
                      background: "#1e3a5f",
                      color: "#fff",
                    }}
                  >
                    <th
                      style={{
                        padding: "8px 6px",
                        width: "36px",
                        textAlign: "center",
                      }}
                    >
                      ✔
                    </th>
                    <th style={{ padding: "8px 6px", textAlign: "right" }}>
                      المنتج
                    </th>
                    <th
                      style={{
                        padding: "8px 6px",
                        width: "110px",
                        textAlign: "center",
                      }}
                    >
                      الباركود
                    </th>
                    <th
                      style={{
                        padding: "8px 6px",
                        width: "90px",
                        textAlign: "center",
                      }}
                    >
                      السعر
                    </th>
                    <th
                      style={{
                        padding: "8px 6px",
                        width: "100px",
                        textAlign: "center",
                      }}
                    >
                      الكمية للطباعة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, idx) => {
                    const isInc = included[p.id] ?? true;
                    return (
                      <tr
                        key={p.id}
                        style={{
                          background: idx % 2 ? "#fff" : "#f9fafb",
                          borderTop: "1px solid #f3f4f6",
                          opacity: isInc ? 1 : 0.5,
                        }}
                      >
                        <td style={{ padding: "6px", textAlign: "center" }}>
                          <input
                            type="checkbox"
                            checked={isInc}
                            onChange={() => toggleInclude(p.id)}
                            style={{ cursor: "pointer", width: "16px", height: "16px" }}
                          />
                        </td>
                        <td
                          style={{
                            padding: "6px 8px",
                            textAlign: "right",
                            fontWeight: 500,
                            color: "#1f2937",
                          }}
                        >
                          <div>{p.name}</div>
                          {p.sku && (
                            <div style={{ fontSize: "10px", color: "#6b7280" }}>
                              SKU: {p.sku}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", fontFamily: "'Courier New', monospace", fontSize: "11px" }}>
                          {p.barcode || p.sku || "—"}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center", fontWeight: 600, color: "#1e3a5f" }}>
                          {p.sell_price.toFixed(2)}
                        </td>
                        <td style={{ padding: "6px", textAlign: "center" }}>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={quantities[p.id] ?? defaultQuantityPerProduct}
                            onChange={(e) => setQty(p.id, parseInt(e.target.value) || 1)}
                            disabled={!isInc}
                            style={{
                              width: "60px",
                              padding: "4px 6px",
                              border: "1px solid #d1d5db",
                              borderRadius: "4px",
                              fontSize: "12px",
                              textAlign: "center",
                              fontFamily: "inherit",
                              background: isInc ? "#fff" : "#f3f4f6",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div
            style={{
              marginTop: "12px",
              padding: "12px 14px",
              background: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "12px", color: "#1e40af", fontWeight: 600 }}>
                📊 ملخص الطباعة
              </div>
              <div style={{ fontSize: "11px", color: "#3b82f6", marginTop: "2px" }}>
                المنتجات المحددة: <strong>{includedCount}</strong> من أصل{" "}
                {products.length}
              </div>
            </div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: "11px", color: "#1e40af" }}>إجمالي الملصقات</div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "#1e3a5f",
                  lineHeight: 1,
                }}
              >
                {totalLabels}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div
            style={{
              padding: "14px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#1e3a5f",
                marginBottom: "12px",
              }}
            >
              ⚙️ إعدادات الملصقات
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Field label="الأعمدة لكل صف (1-8)">
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={config.columnsPerRow}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      columnsPerRow: Math.max(1, Math.min(8, parseInt(e.target.value) || 1)),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
              <Field label="نوع الباركود">
                <select
                  value={config.barcodeType}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, barcodeType: e.target.value as BarcodeType }))
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                    background: "#fff",
                  }}
                >
                  <option value="CODE128">CODE 128</option>
                  <option value="EAN13">EAN-13</option>
                  <option value="QR_CODE">QR Code</option>
                </select>
              </Field>
              <Field label="العرض (mm)">
                <input
                  type="number"
                  min={15}
                  max={200}
                  step={1}
                  value={config.widthMm}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      widthMm: Math.max(15, Math.min(200, parseFloat(e.target.value) || c.widthMm)),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
              <Field label="الارتفاع (mm)">
                <input
                  type="number"
                  min={10}
                  max={200}
                  step={1}
                  value={config.heightMm}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      heightMm: Math.max(10, Math.min(200, parseFloat(e.target.value) || c.heightMm)),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
              <Field label="حجم الخط (px)">
                <input
                  type="number"
                  min={6}
                  max={24}
                  value={config.fontSize}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      fontSize: Math.max(6, Math.min(24, parseInt(e.target.value) || 10)),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    border: "1px solid #d1d5db",
                    borderRadius: "5px",
                    fontSize: "12px",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
              <Field label="حدود الملصق">
                <div
                  style={{
                    padding: "6px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.border}
                    onChange={(e) => setConfig((c) => ({ ...c, border: e.target.checked }))}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "12px", color: "#374151" }}>
                    {config.border ? "مع حدود" : "بدون حدود"}
                  </span>
                </div>
              </Field>
            </div>

            <div
              style={{
                marginTop: "14px",
                paddingTop: "12px",
                borderTop: "1px dashed #e5e7eb",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                🎚️ عناصر العرض في الملصق:
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {(
                  [
                    ["showName", "اسم المنتج"],
                    ["showPrice", "السعر"],
                    ["showBarcode", "الباركود + النص"],
                    ["showSku", "كود SKU"],
                  ] as const
                ).map(([key, lbl]) => (
                  <label
                    key={key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "#374151",
                      cursor: "pointer",
                      padding: "4px 6px",
                      borderRadius: "4px",
                      background: config[key] ? "#eff6ff" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={config[key]}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, [key]: e.target.checked }))
                      }
                      style={{ width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    {lbl}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: "14px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          >
            <Field label="🖨️ الطابعة (اختياري)">
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  border: "1px solid #d1d5db",
                  borderRadius: "5px",
                  fontSize: "12px",
                  fontFamily: "inherit",
                  background: "#fff",
                }}
              >
                <option value="">الطابعة الافتراضية</option>
                {printers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {!printers.length && (
                <button
                  type="button"
                  onClick={loadPrinters}
                  disabled={loadingPrinters}
                  style={{
                    marginTop: "5px",
                    fontSize: "11px",
                    color: "#2563eb",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                  }}
                >
                  {loadingPrinters ? "جاري التحميل..." : "🔄 تحديث قائمة الطابعات"}
                </button>
              )}
            </Field>
          </div>

          <div
            style={{
              padding: "14px",
              background: "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
              borderRadius: "8px",
              color: "#fff",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 700,
                marginBottom: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>🚀 إجراءات الطباعة</span>
              <span style={{ fontSize: "11px", opacity: 0.9 }}>
                {totalLabels} ملصق
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                onClick={() => runPrint("direct")}
                disabled={totalLabels === 0}
                style={{
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  background: "#fff",
                  color: "#1e3a5f",
                  border: "none",
                  cursor: totalLabels === 0 ? "not-allowed" : "pointer",
                  opacity: totalLabels === 0 ? 0.6 : 1,
                  fontFamily: "inherit",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  transition: "transform 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (totalLabels > 0) e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
              >
                ⚡ طباعة مباشرة
              </button>
              <button
                type="button"
                onClick={() => runPrint("preview")}
                disabled={totalLabels === 0}
                style={{
                  padding: "10px 12px",
                  fontSize: "13px",
                  fontWeight: 700,
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  border: "1px solid rgba(255,255,255,0.3)",
                  cursor: totalLabels === 0 ? "not-allowed" : "pointer",
                  opacity: totalLabels === 0 ? 0.6 : 1,
                  fontFamily: "inherit",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (totalLabels > 0)
                    e.currentTarget.style.background = "rgba(255,255,255,0.25)";
                }}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.15)")
                }
              >
                👁️ معاينة قبل الطباعة
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "8px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  background: "transparent",
                  color: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
