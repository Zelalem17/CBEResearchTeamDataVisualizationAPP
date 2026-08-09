import { type ReactNode, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { isAuthConfigured } from "@/services/auth";
import LoginScreen from "./LoginScreen";

/** Gates the entire app behind the password screen. Nothing else in the
 * app renders until `role` is set, so a plain link with no credentials
 * gets nothing but the login form — see the security caveat in
 * services/auth.ts before treating this as a real access boundary. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (!isAuthConfigured) {
      // eslint-disable-next-line no-console
      console.warn(
        "[auth] No VITE_ADMIN_PASSWORD_HASH / VITE_VIEWER_PASSWORD_HASH configured — " +
          "the login gate has nothing to check passwords against. See .env.example."
      );
    }
  }, []);

  if (!isAuthConfigured) {
    // Fail closed in a real deployment: don't ship an app that *looks*
    // password-protected but silently lets everyone in because the
    // build forgot to set the env vars.
    if (import.meta.env.PROD) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="card w-full max-w-sm p-6 text-center space-y-2">
            <AlertTriangle className="mx-auto text-amber-500" size={28} />
            <h1 className="font-bold text-gray-900 dark:text-white">Access control not configured</h1>
            <p className="text-sm text-gray-400">
              This deployment is missing VITE_ADMIN_PASSWORD_HASH / VITE_VIEWER_PASSWORD_HASH.
              Set them and rebuild — see .env.example.
            </p>
          </div>
        </div>
      );
    }
    // Local dev with no passwords set: don't block the developer.
    return <>{children}</>;
  }

  if (!role) return <LoginScreen />;
  return <>{children}</>;
}
