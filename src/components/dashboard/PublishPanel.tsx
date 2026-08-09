import { useState } from "react";
import { X, UploadCloud, CheckCircle2 } from "lucide-react";
import { useDashboardStore } from "@/store/dashboardStore";
import { buildPublishedBundle, downloadPublishedBundle } from "@/services/publish";

interface PublishPanelProps {
  onClose: () => void;
}

/** Admin-only panel that exports every currently loaded dataset (data +
 * widgets + layout + filters + chart-type choice) into a single
 * published.json file for download. That file then has to be added to
 * the repo and redeployed — this panel can't do that last part itself,
 * since a static site has no way to write to its own source. Once it's
 * live at public/data/published.json, every visitor's browser picks it
 * up automatically on first load — see services/publish.ts. */
export default function PublishPanel({ onClose }: PublishPanelProps) {
  const tabs = useDashboardStore((s) => s.tabs);
  const [downloaded, setDownloaded] = useState(false);
  const datasetList = Object.values(tabs);

  const handleDownload = () => {
    const bundle = buildPublishedBundle(tabs);
    downloadPublishedBundle(bundle);
    setDownloaded(true);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-lg flex items-center gap-2"><UploadCloud size={18} /> Publish dashboard</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Makes what's currently loaded here visible to every viewer, on any device — without them uploading anything.
          Since this is a static site, that still means one manual step: download the file below, then add it to the repo.
        </p>

        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Will include ({datasetList.length} dataset{datasetList.length === 1 ? "" : "s"})
          </p>
          {datasetList.length === 0 ? (
            <p className="text-xs text-gray-400">Nothing loaded yet — add a dataset first.</p>
          ) : (
            <div className="space-y-1">
              {datasetList.map((t) => (
                <div key={t.dataset.dataset_id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{t.dataset.name}</span>
                  <span className="text-gray-400">{t.dataset.row_count.toLocaleString()} rows · {t.widgets.length} widgets</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleDownload}
          disabled={datasetList.length === 0}
          className="btn-primary w-full text-sm flex items-center justify-center gap-2"
        >
          <UploadCloud size={15} /> Download published.json
        </button>

        {downloaded && (
          <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-400">
            <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={14} /> Downloaded to your device.
            </p>
            <p className="font-semibold text-gray-600 dark:text-gray-300">Now add it to your repo:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>On GitHub, go to the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">public/data/</code> folder (create it if it doesn't exist yet)</li>
              <li>Click <strong>Add file → Upload files</strong></li>
              <li>Drag in the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">published.json</code> you just downloaded — let it overwrite the old one if it asks</li>
              <li>Commit directly to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">main</code></li>
            </ol>
            <p>
              Uploading the whole file (rather than pasting its contents into GitHub's text editor) avoids any
              copy-paste mistakes — it's valid JSON either way, but upload is safer for a file this size.
            </p>
            <p>Once it redeploys, every fresh visitor sees this automatically — no upload needed on their end.</p>
          </div>
        )}
      </div>
    </div>
  );
}
