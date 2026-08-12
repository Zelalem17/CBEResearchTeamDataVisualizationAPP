/** The list of named user accounts for this app. Each researcher gets
 * their own username + password instead of everyone sharing one "viewer"
 * password. Edit this file to add/remove/change users, then commit and
 * redeploy — see README.md and the in-app "Manage users" panel (admin
 * only) for a form that generates the entry below for you.
 *
 * Roles:
 *   - "admin": full access, plus the "Manage users" panel.
 *   - "editor": full access to data — upload/add datasets, build and
 *     edit dashboards, add/remove/rearrange widgets, filter, drill
 *     down, export — identical to admin for anything data-related, but
 *     without "Manage users" (creating/removing accounts stays
 *     admin-only).
 *   - "viewer": read-only — view, filter, drill down, export.
 *
 * passwordHash is a SHA-256 hex hash — NEVER put a plaintext password
 * here. Generate one with either:
 *   npm run hash-password -- "theirPassword"
 * or the "Manage users" panel in the running app, which does the same
 * hashing in your browser and gives you a ready-to-paste entry.
 *
 * This file ships inside the public JS bundle like everything else in a
 * static site — see the security note at the top of services/auth.ts
 * before treating this as protecting anything sensitive.
 */
// 1. Define the TypeScript type/interface shape
// src/data/users.ts
export interface UserAccount {
  username: string;
  passwordHash: string;
  role: "admin" | "editor" | "viewer";
  displayName?: string;
}
 export const users: UserAccount[] = [
   { 
     username: "zola",
    passwordHash: "67a20ef9ca16dac572541eaa76e742683bf3785db5e52c5ae9a11d29e794e088", 
    role: "admin",
     displayName: "Zelalem Belay" },
export const users: UserAccount[] = [
  {
    username: "bule",
    passwordHash: "d88385afb362d3b8d4fc3783190fe3fe34c32e73516731e428e91b6966c9808c",
    role: "editor",
    displayName: "zola"
  }
];

// Alias export to satisfy files importing USERS in uppercase
export const USERS = users;
