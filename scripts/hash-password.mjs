// Generates the SHA-256 hash used by src/services/auth.ts, so you never
// have to put a plaintext password in .env or source control.
//
// Usage:
//   node scripts/hash-password.mjs "yourPassword"
//   npm run hash-password -- "yourPassword"
//
// Copy the printed hash into VITE_ADMIN_PASSWORD_HASH or
// VITE_VIEWER_PASSWORD_HASH in your .env file.
import { createHash } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error("Usage: node scripts/hash-password.mjs <password>");
  process.exit(1);
}

console.log(createHash("sha256").update(password, "utf8").digest("hex"));
