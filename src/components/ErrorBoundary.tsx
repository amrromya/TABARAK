import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[TABARAK ERROR]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
              fontFamily: "Cairo, sans-serif",
              direction: "rtl",
              background: "var(--bg, #f5f5f5)",
              color: "var(--text, #333)",
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ margin: "0 0 8px", color: "#ef4444" }}>حدث خطأ غير متوقع</h2>
            <p style={{ margin: "0 0 16px", color: "#888", maxWidth: 400, textAlign: "center" }}>
              {this.state.error?.message || "خطأ غير معروف"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: "10px 24px",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              إعادة تحميل
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
