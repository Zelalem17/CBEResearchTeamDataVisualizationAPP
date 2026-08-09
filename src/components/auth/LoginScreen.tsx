import { useState } from "react";
import { Lock, Loader2, User } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import logo from "@/assets/logo.svg";

/** Full-screen gate shown until the visitor signs in. Each researcher
 * has their own username + password (see data/users.ts); an admin can
 * also sign in with the break-glass master account if configured. */
export default function LoginScreen() {
  const { login, error, loading } = useAuthStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    await login(username, password, remember);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <form onSubmit={handleSubmit} className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={logo} alt="" className="w-10 h-10 rounded-lg object-contain" />
          <div className="w-11 h-11 -mt-1 rounded-full bg-brand-50 dark:bg-brand-900/40 flex items-center justify-center">
            <Lock size={20} className="text-brand-600 dark:text-gold-400" />
          </div>
          <h1 className="font-bold text-lg text-gray-900 dark:text-white">Sign in required</h1>
          <p className="text-sm text-gray-400">This dashboard is private. Enter your username and password to continue.</p>
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

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input w-full"
        />

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
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
