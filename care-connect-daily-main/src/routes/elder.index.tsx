import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/elder/")({
  beforeLoad: () => {
    throw redirect({ to: "/elder/home" });
  },
});
