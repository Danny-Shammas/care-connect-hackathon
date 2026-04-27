import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { HeartHandshake, Users, UserCheck, ChevronRight } from "lucide-react";
import { Screen } from "@/components/layout/Screen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareConnect — Stay close, even when you're far" },
      {
        name: "description",
        content:
          "Daily AI-powered check-in calls that help families stay close with the people they love.",
      },
      { property: "og:title", content: "CareConnect — Stay close, even when you're far" },
      {
        property: "og:description",
        content: "Daily AI-powered check-in calls for families.",
      },
    ],
  }),
  component: WelcomeScreen,
});

const ROLE_KEY = "careconnect:preferred-role";

type Role = "guardian" | "elder";

function rememberRole(role: Role) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function RoleCard({
  icon: Icon,
  title,
  subtitle,
  onSelect,
}: {
  icon: typeof Users;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        "group w-full text-left bg-surface rounded-lg p-5 shadow-soft " +
        "border border-transparent transition-[transform,box-shadow,border-color] duration-[120ms] " +
        "hover:border-primary/40 active:scale-[0.98] active:shadow-warm " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      }
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Icon size={24} strokeWidth={2.2} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-foreground leading-snug">
            {title}
          </h3>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed">
            {subtitle}
          </p>
        </div>
        <ChevronRight
          size={20}
          className="text-text-secondary mt-1 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5"
          aria-hidden
        />
      </div>
    </button>
  );
}

function WelcomeScreen() {
  const navigate = useNavigate();

  const choose = (role: Role) => {
    rememberRole(role);
    navigate({ to: "/auth", search: { role } as never });
  };

  return (
    <Screen className="!px-0">
      <div className="flex flex-col min-h-[100dvh]">
        {/* Top 40% — illustration */}
        <section
          className="relative flex items-center justify-center"
          style={{
            flex: "0 0 40%",
            background:
              "radial-gradient(circle at 50% 35%, rgba(232,168,124,0.55) 0%, rgba(232,168,124,0.15) 55%, var(--background) 100%)",
          }}
          aria-hidden
        >
          {/* Soft glow ring */}
          <div className="absolute h-56 w-56 rounded-full bg-primary/10 blur-2xl" />
          <div
            className={
              "relative h-32 w-32 rounded-[36px] bg-surface shadow-warm " +
              "flex items-center justify-center text-primary " +
              "motion-safe:animate-[float_6s_ease-in-out_infinite]"
            }
          >
            <HeartHandshake size={64} strokeWidth={1.8} />
          </div>
        </section>

        {/* Middle — wordmark + tagline */}
        <section className="px-6 pt-6 pb-4 text-center">
          <h1 className="text-[36px] leading-tight font-bold tracking-tight text-foreground">
            CareConnect
          </h1>
          <p className="text-[18px] leading-snug text-text-secondary mt-2">
            Stay close, even when you're far
          </p>
        </section>

        {/* Bottom 40% — choice cards */}
        <section
          className="px-5 pb-2 flex flex-col justify-end"
          style={{ flex: "1 1 40%" }}
        >
          <div className="space-y-3">
            <RoleCard
              icon={Users}
              title="I want to stay connected with a family member"
              subtitle="Set up daily check-ins for someone you love"
              onSelect={() => choose("guardian")}
            />
            <RoleCard
              icon={UserCheck}
              title="A family member set this up for me"
              subtitle="Just enter your phone number to get started"
              onSelect={() => choose("elder")}
            />
          </div>

          <p className="text-center text-sm text-text-secondary mt-5 mb-2">
            Already have an account?{" "}
            <Link
              to="/auth"
              className="text-accent font-medium underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </Screen>
  );
}
