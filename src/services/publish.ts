/** Closes the gap login alone can't: without a backend, one admin's
 * uploaded data only ever lives in *their own browser's* storage — a
 * viewer opening the link on a different device sees nothing, because
 * there's no shared database to deliver it from.
 *
 * The fix that works on a fully static site: the admin exports the
 * current dashboard(s) to a JSON file, commits it into the repo at
 * public/data/published.json, and redeploys. From then on, every
 * visitor's browser — regardless of device — fetches that same file on
 * first load and gets the same dashboard automatically, no upload step
 * required on their end. It's still not "live" (a new upload still
 * needs a redeploy to reach everyone), but it's the static-site
 * equivalent of "publish."
 */
import type { DatasetTab } from "@/store/dashboardStore";

export interface PublishedBundle {
  publishedAt: string;
  tabs: Record<string, DatasetTab>;
}

/** Where the published bundle is fetched from at runtime. Files under
 * `public/` are copied to the build output as-is, so this path just
 * needs to match where the file lives in the repo: public/data/published.json.
 * BASE_URL respects Vite's `base` config, so this resolves correctly
 * whether the site is hosted at a domain root or a GitHub Pages subpath. */
const PUBLISHED_URL = `${import.meta.env.BASE_URL}data/published.json`;

export function buildPublishedBundle(tabs: Record<string, DatasetTab>): PublishedBundle {
  return { publishedAt: new Date().toISOString(), tabs };
}

/** Triggers a browser download of the bundle as published.json. The
 * admin still has to add this file to the repo themselves — a static
 * site has no way to write to its own source from the running app. */
export function downloadPublishedBundle(bundle: PublishedBundle) {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "published.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Fetches whatever's currently published, if anything. Returns null
 * (never throws) when the file doesn't exist yet — a brand new site
 * with nothing published is an expected, normal state, not an error. */
export async function fetchPublishedBundle(): Promise<PublishedBundle | null> {
  try {
    const res = await fetch(PUBLISHED_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === "object" && data.tabs && typeof data.tabs === "object") {
      return data as PublishedBundle;
    }
    return null;
  } catch {
    return null;
  }
}
