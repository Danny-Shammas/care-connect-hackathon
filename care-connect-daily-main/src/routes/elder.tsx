import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RoleGuard } from "@/auth/RoleGuard";

export const Route = createFileRoute("/elder")({
  component: () => (
    <RoleGuard allow="elder">
      <Outlet />
    </RoleGuard>
  ),
});
