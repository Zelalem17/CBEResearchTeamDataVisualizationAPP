import ThemeToggle from "./ThemeToggle";
import logo from "@/assets/logo.svg";

export default function Topbar() {
  return (
    <header className="shrink-0">
      <div className="h-14 flex items-center justify-between px-4 bg-brand-gradient">
        <div className="flex items-center gap-2 font-bold text-white">
          {/* Drop your logo file at src/assets/logo.svg (or .png) with this
              same filename and it appears here automatically — no code
              changes needed. Keep it roughly square for best results. */}
          <img src={logo} alt="Commercial Bank of Ethiopia" className="w-7 h-7 rounded-lg object-contain" />
          <span>BI Insights</span>
          <span className="ml-2 hidden sm:inline text-[10px] font-medium text-brand-100 border border-white/20 rounded-full px-2 py-0.5">
            runs 100% in your browser
          </span>
        </div>
        <ThemeToggle />
      </div>
      <div className="h-0.5 bg-gold-500" />
    </header>
  );
}
