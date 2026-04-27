import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type Role } from "./AuthContext";

interface RoleGuardProps {
  allow: Exclude<Role, null>;
  /** When true (default), also requires that the user has completed pairing. */
  requirePaired?: boolean;
  children: ReactNode;
}

/**
 * Redirects users hitting the wrong role group.
 * - Not yet hydrated → render nothing (prevents flicker / wrong redirect)
 * - Unauthenticated → /auth
 * - Wrong role → their own home
 * - Authenticated but not paired → /pair
 */
export function RoleGuard({ allow, requirePaired = true, children }: RoleGuardProps) {
  const { role, isAuthenticated, isPaired, ready } = useAuth();

  if (!ready) return null;
  if (!isAuthenticated) return <Navigate to="/auth" search={{ role: allow } as never} />;
  if (role !== allow) {
    return <Navigate to={role === "elder" ? "/elder" : "/guardian"} />;
  }
  if (requirePaired && !isPaired) {
    return <Navigate to="/pair" search={{ role: allow } as never} />;
  }
  return <>{children}</>;
}
