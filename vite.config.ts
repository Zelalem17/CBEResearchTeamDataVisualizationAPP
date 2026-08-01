import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// `base: "./"` makes the build use relative asset paths, so it works
// whether it's hosted at the root of a domain (username.github.io) or in
// a project subpath (username.github.io/repo-name) — no config needed
// either way. If you deploy to a custom domain at the root, "./" still
// works fine.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
  },
});
