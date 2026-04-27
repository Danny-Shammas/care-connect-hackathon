import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Role = "elder" | "guardian" | null;

const ROLE_KEY = "careconnect:auth-role";
const PAIRED_KEY = "careconnect:paired";

interface AuthState {
  role: Role;
  setRole: (r: Role) => void;
  isAuthenticated: boolean;
  /** Whether the elder/guardian has completed pairing. */
  isPaired: boolean;
  setPaired: (v: boolean) => void;
  /** True once we've read persisted auth from localStorage. Prevents redirect flicker. */
  ready: boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(null);
  const [isPaired, setPairedState] = useState(false);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage AFTER mount (SSR-safe).
  useEffect(() => {
    try {
      const r = localStorage.getItem(ROLE_KEY);
      if (r === "elder" || r === "guardian") setRoleState(r);
      const p = localStorage.getItem(PAIRED_KEY);
      if (p === "1") setPairedState(true);
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  const setRole = (r: Role) => {
    setRoleState(r);
    try {
      if (r) localStorage.setItem(ROLE_KEY, r);
      else localStorage.removeItem(ROLE_KEY);
    } catch { /* ignore */ }
  };

  const setPaired = (v: boolean) => {
    setPairedState(v);
    try {
      if (v) localStorage.setItem(PAIRED_KEY, "1");
      else localStorage.removeItem(PAIRED_KEY);
    } catch { /* ignore */ }
  };

  const signOut = () => {
    setRole(null);
    setPaired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        role,
        setRole,
        isAuthenticated: role !== null,
        isPaired,
        setPaired,
        ready,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
