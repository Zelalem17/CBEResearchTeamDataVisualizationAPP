/** Lightweight client-side access gate for this fully static app.
 *
 * READ THIS BEFORE RELYING ON IT: there is no backend, so every check
 * below runs entirely in the visitor's browser against data baked into
 * the built JavaScript. Anyone who opens devtools can read the stored
 * hashes, brute-force them offline, or simply patch the running app to
 * skip the check. This is enough to keep casual visitors and search
 * engines out of a link you don't want indiscriminately shared — it is
 * NOT real security and should never guard anything sensitive. For
 * genuine authentication on a static site, put it behind a hosted auth
 * provider instead (Netlify Identity, Cloudflare Access, Auth0, Supabase
 * Auth all work with zero backend code of your own) — see README.md.
 *
 * Two ways to sign in:
 *   1. A named account from data/users.ts — one username + password per
 *      researcher, each with their own role. This is what "admin gives
 *      each researcher their own username and password" refers to.
 *      Three roles:
 *        - "admin": everything, including the "Manage users" panel
 *          (creating/removing accounts).
 *        - "editor": full data privileges — upload/add datasets, build
 *          and edit dashboards, add/remove/rearrange/resize widgets,
 *          filter, drill down, export — same as admin for anything data
 *          related. Cannot open "Manage users"; account creation stays
 *          admin-only.
 *        - "viewer": read-only — view, filter, drill down, export. No
 *          upload or edit controls.
 *   2. A single break-glass master admin account (username "admin"),
 *      configured via VITE_ADMIN_PASSWORD_HASH at build time — always
 *      available so you can never be fully locked out even if
 *      data/users.ts is empty or misconfigured.
 *
 * Adding/removing a user means editing data/users.ts and redeploying —
 * there's no live backend to persist changes instantly for everyone
 * else, same limitation as the rest of this app. See the "Manage users"
 * panel (admin only, in the app) for a form that generates the exact
 * line to paste into that file.
 */

import { USERS } from "@/data/users";

export type Role = "admin" | "editor" | "viewer";

export interface AuthedUser {
  role: Role;
  username: string;
  displayName: string;
}

const STORAGE_KEY = "bi-insights-auth-v2";
const MASTER_USERNAME = "admin";

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Break-glass master admin hash, baked in at build time (see
 * .env.example). Optional — leave unset once data/users.ts has at least
 * one admin account of its own. */
const MASTER_ADMIN_HASH = (import.meta.env.VITE_ADMIN_PASSWORD_HASH as string | undefined)?.trim().toLowerCase();

export const isAuthConfigured = Boolean(MASTER_ADMIN_HASH) || USERS.length > 0;

export async function checkCredentials(username: string, password: string): Promise<AuthedUser | null> {
  const uname = username.trim().toLowerCase();
  if (!uname || !password) return null;
  const hash = await sha256Hex(password);

  if (MASTER_ADMIN_HASH && uname === MASTER_USERNAME && hash === MASTER_ADMIN_HASH) {
    return { role: "admin", username: MASTER_USERNAME, displayName: "Admin" };
  }

  const user = USERS.find((u) => u.username.trim().toLowerCase() === uname);
  if (user && hash === user.passwordHash.trim().toLowerCase()) {
    return { role: user.role, username: user.username, displayName: user.displayName || user.username };
  }
  return null;
}

export function saveSession(user: AuthedUser, remember: boolean) {
  const store = remember ? localStorage : sessionStorage;
  store.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function loadSession(): AuthedUser | null {
  const raw = sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.role === "admin" || parsed.role === "editor" || parsed.role === "viewer") && typeof parsed.username === "string") {
      return parsed as AuthedUser;
    }
  } catch { /* corrupt/old-format session — treat as logged out */ }
  return null;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
}
