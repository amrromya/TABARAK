import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export const money = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);

export const qty = (n: number) =>
  new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 3,
  }).format(n || 0);

export const signed = (n: number) => {
  const abs = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n) || 0);
  return n > 0 ? `+${abs}` : n < 0 ? `-${abs}` : abs;
};

export const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("ar-EG");
};

export const today = () => new Date().toISOString().slice(0, 10);

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

const ToastContext = createContext<(message: string, type?: ToastType) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const notify = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function Modal({
  title,
  onClose,
  children,
  width,
  className,
  closeOnOverlay = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
  className?: string;
  closeOnOverlay?: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={closeOnOverlay ? onClose : undefined}>
      <div
        className={"modal" + (className ? " " + className : "")}
        style={width ? { width } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function confirmDialog(message: string): boolean {
  return window.confirm(message);
}
