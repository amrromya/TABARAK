import { useEffect } from "react";
import { generateAndPrintBarcode } from "../utils/directPrint";

export interface BarcodeCard {
  name: string;
  barcode: string;
  price?: number;
}

export function PrintBarcode({
  cards,
  onClose,
}: {
  cards: BarcodeCard[];
  storeName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (cards.length === 0) {
      onClose();
      return;
    }

    const printAll = async () => {
      try {
        for (const card of cards) {
          await generateAndPrintBarcode({
            id: 0,
            name: card.name,
            barcode: card.barcode,
            sell_price: card.price ?? 0,
            quantity: 1,
          });
        }
      } catch (err) {
        console.error("Barcode print failed:", err);
      } finally {
        onClose();
      }
    };

    printAll();
  }, [cards, onClose]);

  return null;
}
