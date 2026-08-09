import { create } from "zustand";
import { checkPassword, saveSession, loadSession, clearSession, type Role } from "@/services/auth";

interface AuthState {
  role: Role | null;
  error: string | null;
  loading: boolean;
  login: (password: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  role: loadSession(),
  error: null,
  loading: false,

  login: async (password, remember) => {
    set({ loading: true, error: null });
    const role = await checkPassword(password);
    if (role) {
      saveSession(role, remember);
      set({ role, loading: false, error: null });
      return true;
    }
    set({ loading: false, error: "Incorrect password." });
    return false;
  },

  logout: () => {
    clearSession();
    set({ role: null });
  },
}));
