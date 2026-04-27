import { useEffect, useState } from "react";

const ROLE_KEY = "careconnect:preferred-role";
export type PreferredRole = "guardian" | "elder" | null;

/**
 * Reads the user's preferred role from localStorage on the client.
 * Returns `null` during SSR and the first client render to avoid
 * hydration mismatches; updates after mount.
 */
export function usePreferredRole(): PreferredRole {
  const [role, setRole] = useState<PreferredRole>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(ROLE_KEY);
      if (v === "guardian" || v === "elder") setRole(v);
    } catch { /* ignore */ }
  }, []);
  return role;
}
