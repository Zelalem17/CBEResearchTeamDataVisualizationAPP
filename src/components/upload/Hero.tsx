import { Sparkles, LayoutGrid, DownloadCloud, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.svg";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Instant analysis",
    text: "Drop in a file and the app automatically detects column types, trends, and relationships in your data.",
  },
  {
    icon: LayoutGrid,
    title: "Drag & drop dashboards",
    text: "Move, resize, add, or remove KPI cards, charts, and tables to build the exact view you need.",
  },
  {
    icon: DownloadCloud,
    title: "Export anywhere",
    text: "Download your dashboard as PNG, PDF, or Excel — filtered exactly the way you're viewing it.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    text: "Everything runs in your browser. Your file is never uploaded or sent to a server.",
  },
];

/** The landing hero shown before any dataset has been imported — explains
 * what the app does before asking the user to drop in a file. */
export default function Hero() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-glow">
      <div className="bg-brand-gradient px-6 py-10 sm:px-10 sm:py-14 text-center relative">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_30%)]" />
        <img src={Commercial Bank of Ethiopia Logo} alt="Commercial Bank of Ethiopia" className="relative w-16 h-16 mx-auto mb-4 rounded-2xl shadow-lg object-contain" />
        <span className="relative inline-flex items-center gap-1.5 text-gold-300 text-xs font-semibold uppercase tracking-widest bg-white/10 rounded-full px-3 py-1 mb-4">
          <Sparkles size={12} /> Instant Data Dashboards
        </span>
        <h1 className="relative text-2xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
          Turn financial data into decision-ready insights,<br className="hidden sm:block" /> in seconds.
        </h1>
        <p className="relative text-brand-100 max-w-xl mx-auto text-sm sm:text-base">
         Upload bank reports, macroeconomic datasets, or branch metrics (CSV/Excel) to instantly generate interactive KPI cards, trend lines, and portfolio distributions. No server uploads, zero data leakage, and zero setup required.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-gold-400 flex items-center justify-center">
                <Icon size={18} />
              </div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
