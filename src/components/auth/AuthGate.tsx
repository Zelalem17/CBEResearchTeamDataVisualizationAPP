import { type ReactNode, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { isAuthConfigured } from "@/services/auth";
import LoginScreen from "./LoginScreen";

/** Gates the entire app behind the login screen. Nothing else in the
 * app renders until a user is signed in, so a plain link with no
 * credentials gets nothing but the login form — see the security caveat
 * in services/auth.ts before treating this as a real access boundary. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isAuthConfigured) {
      // eslint-disable-next-line no-console
      console.warn(
        "[auth] No accounts configured — data/users.ts is empty and " +
          "VITE_ADMIN_PASSWORD_HASH isn't set. The login gate has nothing " +
          "to check credentials against. See .env.example / data/users.ts."
      );
    }
  }, []);

  if (!isAuthConfigured) {
    // Fail closed in a real deployment: don't ship an app that *looks*
    // login-protected but silently lets everyone in because no accounts
    // were ever set up.
    if (import.meta.env.PROD) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="card w-full max-w-sm p-6 text-center space-y-2">
            <AlertTriangle className="mx-auto text-amber-500" size={28} />
            <h1 className="font-bold text-gray-900 dark:text-white">No accounts configured</h1>
            <p className="text-sm text-gray-400">
              This deployment has no user accounts. Add at least one admin account —
              either VITE_ADMIN_PASSWORD_HASH (see .env.example) or an entry in
              src/data/users.ts — and rebuild.
            </p>
          </div>
        </div>
      );
    }
    // Local dev with no accounts set: don't block the developer.
    return <>{children}</>;
  }

  if (!user) return <LoginScreen />;
  return <>{children}</>;
}
