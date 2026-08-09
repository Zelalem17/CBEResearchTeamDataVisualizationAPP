/** The list of named user accounts for this app. Each researcher gets
 * their own username + password instead of everyone sharing one "viewer"
 * password. Edit this file to add/remove/change users, then commit and
 * redeploy — see README.md and the in-app "Manage users" panel (admin
 * only) for a form that generates the entry below for you.
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
export interface UserAccount {
  /** Case-insensitive; what the person types into the username field. */
  username: string;
  /** SHA-256 hex hash of their password — never the plaintext. */
  passwordHash: string;
  role: "admin" | "viewer";
  /** Optional friendly name shown in the top bar instead of the raw
   * username (e.g. "Selam T." instead of "selam.t"). */
  displayName?: string;
}
  { username: "Selam Kiros", passwordHash: "54ad97ca46fb8810b518a47c8bc0e0dff4e9cb10c703b2bedc42d1146eba8d9e", role: "admin", displayName: "Selam" },

export const USERS: UserAccount[] = [
  // Example — replace with real accounts, or delete this line entirely:
  // { username: "selam", passwordHash: "…", role: "viewer", displayName: "Selam T." },
];
  { username: "Belay", passwordHash: "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4", role: "viewer", displayName: "Belay" },
