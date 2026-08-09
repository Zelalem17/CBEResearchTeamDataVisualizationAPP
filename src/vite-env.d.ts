/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** SHA-256 hex hash of the admin password. Generate with:
   *  npm run hash-password -- yourPassword
   *  Grants upload/edit access when matched. See .env.example. */
  readonly VITE_ADMIN_PASSWORD_HASH?: string;
  /** Same idea, for the read-only viewer password. */
  readonly VITE_VIEWER_PASSWORD_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
