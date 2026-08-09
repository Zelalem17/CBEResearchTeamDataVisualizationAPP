/** Lightweight client-side access gate for this fully static app.
 *
 * READ THIS BEFORE RELYING ON IT: there is no backend, so the password
 * check below runs entirely in the visitor's browser against a hash
 * baked into the built JavaScript. Anyone who opens devtools can read
 * that hash, brute-force it offline, or simply patch the running app to
 * skip the check. This is enough to keep casual visitors and search
 * engines out of a link you don't want indiscriminately shared — it is
 * NOT real security and should never guard anything sensitive. For
 * genuine authentication on a static site, put it behind a hosted auth
 * provider instead (Netlify Identity, Cloudflare Access, Auth0, Supabase
 * Auth all work with zero backend code of your own) — see README.md.
 *
 * Two roles are supported, each behind its own password:
 *   - "admin"  — full access: upload data, add/remove/rearrange widgets
 *   - "viewer" — read-only: can filter/drill into whatever the admin
 *                has published, but can't upload or edit the dashboard
 */

export type Role = "admin" | "viewer";

const STORAGE_KEY = "bi-insights-auth-v1";

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Hashes baked in at build time via Vite env vars (see .env.example).
 * Never put the plaintext password in source — only its SHA-256 hash,
 * generated with `npm run hash-password -- yourPassword`. */
const ADMIN_HASH = (import.meta.env.VITE_ADMIN_PASSWORD_HASH as string | undefined)?.trim().toLowerCase();
const VIEWER_HASH = (import.meta.env.VITE_VIEWER_PASSWORD_HASH as string | undefined)?.trim().toLowerCase();

/** True when neither password hash has been configured — i.e. the app
 * was built without setting up access control at all. */
export const isAuthConfigured = Boolean(ADMIN_HASH || VIEWER_HASH);

export async function checkPassword(password: string): Promise<Role | null> {
  const hash = await sha256Hex(password);
  if (ADMIN_HASH && hash === ADMIN_HASH) return "admin";
  if (VIEWER_HASH && hash === VIEWER_HASH) return "viewer";
  return null;
}

export function saveSession(role: Role, remember: boolean) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem(STORAGE_KEY, role);
}

export function loadSession(): Role | null {
  const fromSession = sessionStorage.getItem(STORAGE_KEY);
  const fromLocal = localStorage.getItem(STORAGE_KEY);
  const val = fromSession ?? fromLocal;
  return val === "admin" || val === "viewer" ? val : null;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
