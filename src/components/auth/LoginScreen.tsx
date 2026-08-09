import { useState } from "react";
import { Lock, Loader2, User, ShieldCheck, Sparkles, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import logo from "@/assets/logo.svg";

/** Full-screen gate shown until the visitor signs in. Each researcher
 * has their own username + password (see data/users.ts); an admin can
 * also sign in with the break-glass master account if configured.
 *
 * Split into a CBE-branded welcome panel (left, full-height on desktop)
 * and the sign-in form (right) — this is the very first thing anyone
 * using the app sees, so it carries the same purple/gold identity and
 * "instant insight" framing as the post-login dashboard, rather than a
 * bare gray box. */
export default function LoginScreen() {
  const { login, error, loading } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await login(username, password, remember);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col md:flex-row">
      {/* Welcome panel */}
      <div className="relative shrink-0 md:flex-[1.15] bg-brand-gradient flex flex-col justify-center px-8 py-10 sm:px-14 md:py-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_15%_18%,white,transparent_35%),radial-gradient(circle_at_85%_78%,white,transparent_32%)]" />
        <div className="absolute -top-28 -right-20 w-72 h-72 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-white/5 blur-3xl" />

        <div className="relative">
          <img src={logo} alt="Commercial Bank of Ethiopia" className="w-14 h-14 rounded-2xl shadow-lg object-contain mb-6" />
          <span className="inline-flex items-center gap-1.5 text-gold-300 text-xs font-semibold uppercase tracking-widest bg-white/10 rounded-full px-3 py-1 mb-5">
            <Sparkles size={12} /> CBE Research Team
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
            Welcome back.
          </h1>
          <p className="text-brand-100 max-w-md text-sm sm:text-base leading-relaxed mb-8">
            Sign in to explore live dashboards, benchmark CBE against industry figures, and turn raw
            research data into decisions — instantly.
          </p>
          <div className="hidden sm:flex items-center gap-2 text-brand-100/80 text-xs">
            <ShieldCheck size={15} className="text-gold-300 shrink-0" />
            Private, role-based access for CBE Research Team members only.
          </div>
        </div>
      </div>

      {/* Sign-in panel */}
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-10">
        <form onSubmit={handleSubmit} className="card w-full max-w-sm p-7 space-y-4">
          <div className="flex flex-col items-center gap-2 text-center mb-1">
            <div className="w-11 h-11 rounded-full bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center">
              <Lock size={20} className="text-brand-600 dark:text-gold-400" />
            </div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Sign in to continue</h2>
            <p className="text-sm text-gray-400">Enter your username and password to access the dashboard.</p>
          </div>

          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input w-full pl-9"
            />
          </div>

          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full pl-9 pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}

          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-brand-600"
            />
            Remember me on this device
          </label>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-gold w-full flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Checking…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
