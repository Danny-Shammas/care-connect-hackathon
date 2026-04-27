import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, SecondaryButton } from "@/components/layout/Buttons";
import { BackButton } from "@/components/layout/BackButton";
import { GuardianPairScreen } from "@/components/pair/GuardianPairScreen";
import { ElderPairScreen } from "@/components/pair/ElderPairScreen";
import { usePreferredRole, type PreferredRole } from "@/hooks/usePreferredRole";
import { useAuth } from "@/auth/AuthContext";

export const Route = createFileRoute("/pair")({
  validateSearch: (s: Record<string, unknown>) => {
    const r = s.role;
    return { role: (r === "guardian" || r === "elder" ? r : undefined) as PreferredRole };
  },
  head: () => ({
    meta: [
      { title: "Pair your devices · CareConnect" },
      { name: "description", content: "Connect your CareConnect accounts." },
    ],
  }),
  component: PairRouter,
});

function PairRouter() {
  const { role: queryRole } = Route.useSearch();
  const stored = usePreferredRole();
  const { isAuthenticated, isPaired, role: authRole, ready } = useAuth();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || !ready) {
    return <Screen><div className="pt-2"><BackButton fallback="/" /></div></Screen>;
  }

  // Must sign in / pick a role first.
  if (!isAuthenticated) {
    return <Navigate to="/auth" search={{ role: queryRole ?? stored ?? undefined } as never} />;
  }

  // Already paired? Send them to their home.
  if (isPaired) {
    return <Navigate to={authRole === "elder" ? "/elder" : "/guardian"} />;
  }

  // Prefer the authenticated role, then query string, then stored.
  const role: PreferredRole = authRole ?? queryRole ?? stored;

  if (role === "elder") return <ElderPairScreen />;
  if (role === "guardian") return <GuardianPairScreen />;

  return <RoleChooser />;
}

function RoleChooser() {
  return (
    <Screen>
      <div className="pt-2"><BackButton fallback="/" /></div>
      <div className="flex min-h-[70dvh] items-center">
        <Card className="w-full">
          <h1 className="text-2xl font-bold mb-2">Who's pairing?</h1>
          <p className="text-text-secondary mb-6">
            Tell us which side of the pair you are so we can show the right
            screen.
          </p>
          <div className="flex flex-col gap-3">
            <a href="/pair?role=guardian">
              <PrimaryButton className="w-full">
                I'm the family member
              </PrimaryButton>
            </a>
            <a href="/pair?role=elder">
              <SecondaryButton className="w-full">
                I'm the parent
              </SecondaryButton>
            </a>
          </div>
        </Card>
      </div>
    </Screen>
  );
}
