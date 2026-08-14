import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches any uncaught error thrown while rendering the app and shows a
 * readable message instead of an entirely blank page.
 *
 * Without this, React's default behavior for an uncaught render error is
 * to unmount the *whole* tree — nothing gets left in the DOM at all,
 * which is indistinguishable from "the site is empty" and next to
 * impossible to diagnose on a deployed build without already having
 * devtools open at the exact moment it happens. This turns that into a
 * visible error message (and always logs the full error + component
 * stack to the console too), so if something ever does throw, both the
 * page and this app's future maintainers get to see what and where. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] Uncaught render error:", error, "\nComponent stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 520, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.08)", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#e11d48", marginBottom: 8 }}>
              <AlertTriangle size={20} />
              <h1 style={{ fontWeight: 700, color: "#111827", margin: 0, fontSize: 17 }}>Something went wrong</h1>
            </div>
            <p style={{ fontSize: 14, color: "#4b5563", marginBottom: 12 }}>
              The app hit an error while rendering. Reloading sometimes clears it (e.g. a stale
              cached script after a deploy); if it keeps happening, this message — and the full
              error in the browser console (F12) — is what to share for debugging.
            </p>
            <pre style={{ fontSize: 12, background: "#f3f4f6", borderRadius: 8, padding: 12, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#b91c1c", margin: "0 0 14px" }}>
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ fontSize: 14, fontWeight: 600, color: "#111827", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
