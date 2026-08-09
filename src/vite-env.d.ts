/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** SHA-256 hex hash of the break-glass master admin password (always
   * logs in as username "admin"). Optional once data/users.ts has its
   * own admin account — generate with:
   *  npm run hash-password -- yourPassword
   *  See .env.example. */
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
