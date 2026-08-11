import { useState } from "react";
import { X, UserPlus, Copy, Check, ShieldCheck, Eye, PenLine } from "lucide-react";
import { sha256Hex } from "@/services/auth";
import { USERS } from "@/data/users";

interface UserManagementPanelProps {
  onClose: () => void;
}

const ROLE_ICON = { admin: ShieldCheck, editor: PenLine, viewer: Eye } as const;

/** Admin-only panel for creating researcher accounts. Everything here
 * runs in the browser — hashing the chosen password, building the
 * exact line to add to src/data/users.ts — but because this is a fully
 * static site, a new account only actually works once that file is
 * updated and the site is redeployed. This panel gets you the text to
 * paste; it can't write to the repo or take effect on its own. */
export default function UserManagementPanel({ onClose }: UserManagementPanelProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [snippet, setSnippet] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!username.trim() || !password) return;
    setGenerating(true);
    const hash = await sha256Hex(password);
    const line =
      `  { username: "${username.trim()}", passwordHash: "${hash}", role: "${role}"` +
      (displayName.trim() ? `, displayName: "${displayName.trim()}"` : "") +
      ` },`;
    setSnippet(line);
    setCopied(false);
    setGenerating(false);
  };

  const handleCopy = async () => {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-lg flex items-center gap-2"><UserPlus size={18} /> Manage users</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          New accounts need a redeploy to take effect — this generates the line to paste
          into <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-1 rounded">src/data/users.ts</code>, it doesn't create the account by itself.
        </p>

        {/* Current accounts */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current accounts ({USERS.length})</p>
          {USERS.length === 0 ? (
            <p className="text-xs text-gray-400">No named accounts yet — only the master admin login works.</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {USERS.map((u) => {
                const RoleIcon = ROLE_ICON[u.role];
                return (
                  <div key={u.username} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-gray-50 dark:bg-gray-800">
                    <span className="font-medium text-gray-700 dark:text-gray-200">{u.displayName || u.username}</span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <RoleIcon size={11} />
                      {u.role}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-1.5">
            To remove someone, delete their line from that file and redeploy.
          </p>
        </div>

        {/* New account form */}
        <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Create a new account</p>
          <input
            className="input w-full text-sm"
            placeholder="Username (e.g. selam.t)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="input w-full text-sm"
            placeholder="Display name (optional, e.g. Selam T.)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <input
            type="text"
            className="input w-full text-sm"
            placeholder="Password to give them"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <select className="input w-full text-sm" value={role} onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}>
            <option value="viewer">Viewer — read-only (view, filter, export)</option>
            <option value="editor">Editor — full data access (upload, edit, rearrange), no user management</option>
            <option value="admin">Admin — everything, including Manage users</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={!username.trim() || !password || generating}
            className="btn-primary w-full text-sm"
          >
            Generate account entry
          </button>
        </div>

        {snippet && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Paste this into the USERS array in src/data/users.ts
            </p>
            <div className="relative">
              <pre className="text-[11px] bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{snippet}</pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                title="Copy"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
            <p className="text-xs text-gray-400">
              Commit that file and redeploy — then tell {displayName.trim() || username.trim()} their username and password
              (<span className="font-mono">{username.trim()}</span> / the password you typed above). This app never stores or
              emails it for you.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
