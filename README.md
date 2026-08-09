# BI Insights — Static (No Backend)

A fully client-side Business Intelligence dashboard. Drop in a CSV or Excel
file, it auto-detects column types and relationships, builds an interactive
drag-and-drop dashboard, and lets you export to PNG, PDF, or Excel — **all
in the browser**. No server, no database, no API keys. Deployable straight
to GitHub Pages (or Netlify, Vercel, S3, any static host).

## How it works

| Backend step (in the full-stack version) | Here, done in the browser with |
|---|---|
| Parse CSV/XLSX upload | `papaparse` + `xlsx` (SheetJS) — `src/services/fileParser.ts` |
| Auto-detect column types & relationships | `src/services/dataAnalysis.ts` |
| Suggest dashboard widgets | `src/services/dashboardGenerator.ts` |
| Render charts | Apache ECharts — `src/components/charts/` |
| Drag/resize/add/remove widgets | react-grid-layout — `src/components/dashboard/` |
| Export PNG / PDF / Excel | html2canvas + jsPDF + SheetJS — `src/utils/exportUtils.ts` |
| Persist dashboards between visits | `localStorage`, via zustand's `persist` middleware |

Your data never leaves your machine — there's no upload, no network call.
That also means: closing the tab or clearing site data clears your
dashboards (up to ~2,000 rows per dataset are cached to `localStorage` so a
reload doesn't lose your layout; the full row set stays in memory for the
current session).

## Run locally
```bash
npm install
npm run dev
```
Visit http://localhost:5173, drop in a CSV or Excel file.

## Deploy to GitHub Pages

**Option A — GitHub Actions (recommended, already set up):**
1. Push this repo to GitHub.
2. In the repo settings → **Pages**, set "Source" to **GitHub Actions**.
3. Push to `main` — `.github/workflows/deploy.yml` builds and deploys automatically.
4. Your site is live at `https://<username>.github.io/<repo-name>/`.

**Option B — manual, via the `gh-pages` package:**
```bash
npm install
npm run build
npm run deploy
```
This pushes the `dist/` folder to a `gh-pages` branch. Then in repo settings
→ Pages, set the source branch to `gh-pages`.

Either way, `vite.config.ts` uses `base: "./"` (relative asset paths), so it
works whether the site is served from the domain root or a `/repo-name/`
subpath — no config changes needed.

## Project structure
```
src/
├── services/
│   ├── fileParser.ts        CSV/XLSX parsing (papaparse / SheetJS)
│   ├── dataAnalysis.ts      column type/role detection + relationships
│   └── dashboardGenerator.ts profile → suggested widgets
├── components/
│   ├── charts/               ChartRenderer + ECharts option builders
│   │                         (bar, line, area, pie, scatter, histogram,
│   │                          heatmap, treemap, gauge)
│   ├── dashboard/             DashboardGrid (drag/resize), WidgetCard,
│   │                         WidgetLibraryModal
│   ├── filters/               GlobalFilters (search + filter chips)
│   ├── kpi/, tables/          KpiCard, DataTable
│   ├── upload/                FileUpload (drag-and-drop + multi-sheet picker)
│   └── layout/                Topbar, Sidebar, ThemeToggle
├── store/                     zustand: dashboard state (persisted), theme
├── utils/                     exportUtils.ts, filterUtils.ts
└── App.tsx                    single-page workspace
```

## Access control (login gate)

The whole app sits behind a password screen (`src/components/auth/`).
There are two roles, each with its own password:

| Role | Can do |
|---|---|
| **admin** | Everything: upload data, add/remove/rearrange widgets, switch chart types |
| **viewer** | Read-only: view whatever's loaded, use filters and drill-down, export — no upload/edit |

**Setup:**
```bash
npm run hash-password -- "yourAdminPassword"    # copy the printed hash
npm run hash-password -- "yourViewerPassword"   # copy the printed hash
cp .env.example .env
# paste the two hashes into .env as VITE_ADMIN_PASSWORD_HASH / VITE_VIEWER_PASSWORD_HASH
npm run build
```
Vite only reads `.env` at build time, so redeploy after changing it. Leave
one role's hash blank to disable that role entirely. If you deploy with
neither hash set, the production build shows a "not configured" screen
instead of silently letting everyone in; `npm run dev` skips the gate
locally so you're never locked out while developing.

**Please read this before trusting it:** this is a fully static site with
no backend, so the password check runs in the visitor's own browser
against a hash baked into the JavaScript bundle. It stops casual visitors
and search engines from wandering into a link you don't want indexed — it
does **not** stop a determined, technically inclined person, who can read
the hash from devtools, brute-force it offline, or patch the running app.
Don't use it to gate anything genuinely sensitive. For real authentication
on a static site, put it behind a hosted provider instead — Netlify
Identity, Cloudflare Access, Auth0, or Supabase Auth all work with no
backend code of your own, and Cloudflare Access in particular can protect
a static site with zero app changes (it gates the URL itself).

**One more limitation worth knowing:** roles only control what a given
browser *session* is allowed to do — they don't create shared storage.
Because there's no backend, each visitor's uploaded data lives only in
their own browser's `localStorage`; an admin uploading a dataset does
**not** make it appear for a viewer opening the same link on a different
device. If you want "admin curates a dashboard once, everyone with the
link sees it," the practical static-site pattern is: have the admin
export the finished dataset (or its dashboard config) to a JSON/CSV file,
commit it under `public/data/`, and have the app auto-load it for every
visitor on startup — that part isn't wired up yet, but the role split
above is exactly the seam to hang it on.


## Limitations vs. the full-stack version
- Password gate is a static-JS check, not real auth (see above) — no
  multi-user data sharing, since there's no backend/database.
- No live database connections (MySQL/Postgres/etc.) — those need a server
  to hold credentials and run queries; a static site can't do that safely.
- Large files: everything is parsed and aggregated in-browser, so very
  large spreadsheets (hundreds of thousands of rows) may be slow. Consider
  the full-stack version (with Pandas + Postgres) for that.
- `localStorage` has a small quota (~5MB); large datasets only have their
  first 2,000 rows cached for reload — the rest recomputes if you re-upload.

## Extending
- New chart type: add a `build<Type>Option()` to
  `src/components/charts/chartConfigBuilders.ts`, wire it into
  `buildOptionForWidget`, and add it to `WIDGET_TYPES` in
  `WidgetLibraryModal.tsx`.
- New auto-suggested widget rule: edit `src/services/dashboardGenerator.ts`.
