import { create } from "zustand";
import { checkCredentials, saveSession, loadSession, clearSession, type AuthedUser } from "@/services/auth";

interface AuthState {
  user: AuthedUser | null;
  error: string | null;
  loading: boolean;
  login: (username: string, password: string, remember: boolean) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadSession(),
  error: null,
  loading: false,

  login: async (username, password, remember) => {
    set({ loading: true, error: null });
    const user = await checkCredentials(username, password);
    if (user) {
      saveSession(user, remember);
      set({ user, loading: false, error: null });
      return true;
    }
    set({ loading: false, error: "Incorrect username or password." });
    return false;
  },

  logout: () => {
    clearSession();
    set({ user: null });
  },
}));
