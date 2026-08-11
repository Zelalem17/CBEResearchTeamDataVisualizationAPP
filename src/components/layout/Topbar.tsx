import { useState } from "react";
import { LogOut, ShieldCheck, Eye, Users, PenLine } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import logo from "@/assets/logo.svg";
import { useAuthStore } from "@/store/authStore";
import UserManagementPanel from "@/components/auth/UserManagementPanel";

const ROLE_META = {
  admin: { icon: ShieldCheck, label: "Full access: upload, edit, rearrange, and manage users" },
  editor: { icon: PenLine, label: "Full data access: upload, edit, and rearrange (no user management)" },
  viewer: { icon: Eye, label: "Read-only: view and filter" },
} as const;

export default function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [showUsers, setShowUsers] = useState(false);
  const isAdmin = user?.role === "admin";
  const roleMeta = user ? ROLE_META[user.role] : null;
  const RoleIcon = roleMeta?.icon;

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
        <div className="flex items-center gap-3">
          {user && roleMeta && RoleIcon && (
            <span
              title={roleMeta.label}
              className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-white/90 border border-white/20 rounded-full px-2 py-0.5"
            >
              <RoleIcon size={12} />
              {user.displayName}
            </span>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowUsers(true)}
              title="Manage users"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
              <Users size={16} />
            </button>
          )}
          <ThemeToggle />
          {user && (
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-gold-500" />
      {showUsers && <UserManagementPanel onClose={() => setShowUsers(false)} />}
    </header>
  );
}
