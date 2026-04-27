import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/guardian/")({
  component: () => <Navigate to="/guardian/dashboard" replace />,
});
