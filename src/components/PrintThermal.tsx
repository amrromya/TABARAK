import { useEffect } from "react";
import { printSale } from "../utils/directPrint";
import type { Sale, Settings } from "../types";

export function PrintThermal({
  sale,
  settings,
  onClose,
}: {
  sale: Sale;
  settings: Settings;
  onClose: () => void;
}) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await printSale(sale, settings);
      } catch (err) {
        console.error("Print error:", err);
      } finally {
        if (!cancelled) onClose();
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return null;
}
