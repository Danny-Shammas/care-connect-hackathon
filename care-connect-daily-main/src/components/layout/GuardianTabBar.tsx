import { Link, useLocation } from "@tanstack/react-router";
import { Home, PhoneCall, HeartPulse, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  icon: typeof Home;
  to: string;
  /** Highlight when location.pathname starts with any of these prefixes. */
  match: string[];
};

const TABS: Tab[] = [
  { label: "Home", icon: Home, to: "/guardian/dashboard", match: ["/guardian/dashboard"] },
  {
    label: "Calls",
    icon: PhoneCall,
    to: "/guardian/calls",
    match: ["/guardian/calls"],
  },
  {
    label: "Care",
    icon: HeartPulse,
    to: "/guardian/medications",
    // Care groups together the day-to-day care surfaces.
    match: ["/guardian/medications", "/guardian/memory", "/guardian/personalize", "/guardian/reports"],
  },
  { label: "Profile", icon: User, to: "/guardian/profile", match: ["/guardian/profile"] },
];

export function GuardianTabBar() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-screen-sm grid grid-cols-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
          return (
            <Link
              key={t.label}
              to={t.to}
              aria-current={active ? "page" : undefined}
              aria-label={t.label}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 min-h-14 active:scale-[0.96] transition-transform",
                active ? "text-accent" : "text-text-secondary",
              )}
            >
              <Icon
                size={22}
                fill={active ? "currentColor" : "none"}
                strokeWidth={active ? 2 : 1.8}
              />
              <span className="text-[11px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
