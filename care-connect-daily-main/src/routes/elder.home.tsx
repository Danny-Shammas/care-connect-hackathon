import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Phone, Settings } from "lucide-react";
import { Screen } from "@/components/layout/Screen";

export const Route = createFileRoute("/elder/home")({
  head: () => ({
    meta: [
      { title: "CareConnect" },
      { name: "description", content: "Tap to call your family." },
    ],
  }),
  component: ElderHome,
});

/* ──────────────────────────────────────────────────────────────────────────
 * TODO(backend): replace these stubs with Lovable Cloud reads.
 *   - elder profile: { firstName }
 *   - linked guardian: { firstName, relationship, avatarUrl }
 *
 *   const { data: pair } = await supabase
 *     .from('pairings')
 *     .select('elder:elder_id(first_name), guardian:guardian_id(first_name, avatar_url, relationship_label)')
 *     .eq('elder_id', user.id)
 *     .single()
 * ─────────────────────────────────────────────────────────────────────── */
const ELDER = { firstName: "Eleanor" };
const GUARDIAN = {
  firstName: "Sarah",
  relationship: "your daughter",
  avatarUrl: null as string | null,
};

function getGreeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function getSubline(d: Date) {
  const dayName = d.toLocaleDateString(undefined, { weekday: "long" });
  // Calm, varied, date-aware copy. Weather omitted (no cheap source available).
  const adj = ["beautiful", "lovely", "quiet", "warm", "bright", "gentle"];
  // Stable per-day adjective so the line doesn't flicker between renders.
  const idx = (d.getFullYear() + d.getMonth() + d.getDate()) % adj.length;
  return `It's a ${adj[idx]} ${dayName}.`;
}

function ElderHome() {
  const navigate = useNavigate();

  // Compute greeting on the client only — using `new Date()` during SSR
  // would cause a hydration mismatch as time ticks past noon/6pm.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    // Refresh every minute so the greeting updates if they leave the screen open.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const greeting = useMemo(
    () => (now ? `${getGreeting(now)}, ${ELDER.firstName}` : `Hello, ${ELDER.firstName}`),
    [now],
  );
  const subline = useMemo(() => (now ? getSubline(now) : "\u00A0"), [now]);

  const onCall = () => navigate({ to: "/elder/calling" });

  return (
    <Screen ui="elder" className="!px-0">
      {/* Top bar — settings only */}
      <header className="flex justify-end items-center px-4" style={{ height: 40 }}>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => navigate({ to: "/elder/settings" })}
          className={
            "inline-flex items-center justify-center rounded-full " +
            "h-16 w-16 -mr-2 text-text-secondary " +
            "hover:bg-secondary active:scale-95 transition-transform duration-[80ms] " +
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          }
        >
          <Settings size={28} strokeWidth={2} />
        </button>
      </header>

      <div className="flex flex-col flex-1 min-h-0">
        {/* Greeting (top 25%) */}
        <section className="px-6 pt-2 pb-4 flex flex-col justify-center" style={{ minHeight: "25%" }}>
          <h1
            className="font-bold tracking-tight text-foreground"
            style={{ fontSize: 32, lineHeight: 1.2 }}
          >
            {greeting}
          </h1>
          <p
            className="text-text-secondary mt-2"
            style={{ fontSize: 22, lineHeight: 1.45 }}
            aria-live="polite"
          >
            {subline}
          </p>
        </section>

        {/* Call button (middle 50%) */}
        <section
          className="flex items-center justify-center"
          style={{ minHeight: "50%" }}
        >
          <button
            type="button"
            onClick={onCall}
            aria-label={`Call ${GUARDIAN.firstName}`}
            className={
              "relative group rounded-full " +
              // Extend tap target beyond the visual disc with a transparent halo
              "p-4 " +
              "active:scale-[0.97] transition-transform duration-150 " +
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            }
          >
            {/* Soft pulsing halo — disabled under prefers-reduced-motion */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-4 rounded-full bg-primary/30 blur-xl motion-safe:animate-[callPulse_2s_ease-in-out_infinite]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-2 rounded-full bg-primary/20 motion-safe:animate-[callRing_2s_ease-out_infinite]"
            />

            {/* The disc itself */}
            <span
              className={
                "relative flex flex-col items-center justify-center rounded-full " +
                "shadow-warm text-primary-foreground " +
                "bg-[radial-gradient(circle_at_30%_30%,oklch(0.86_0.07_55)_0%,oklch(0.78_0.09_55)_55%,oklch(0.68_0.1_50)_100%)]"
              }
              style={{ width: 280, height: 280 }}
            >
              <Phone size={80} strokeWidth={2} fill="currentColor" />
              <span
                className="mt-3 font-bold"
                style={{ fontSize: 28, letterSpacing: "0.01em" }}
              >
                Call Family
              </span>
            </span>
          </button>
        </section>

        {/* Connection (bottom 25%) */}
        <section className="px-6 pb-8 pt-2 flex items-center justify-center" style={{ minHeight: "25%" }}>
          <div className="flex items-center gap-4 text-center">
            <Avatar name={GUARDIAN.firstName} src={GUARDIAN.avatarUrl} />
            <p
              className="text-text-secondary text-left"
              style={{ fontSize: 22, lineHeight: 1.4 }}
            >
              You're connected with{" "}
              <span className="text-foreground font-semibold">{GUARDIAN.firstName}</span>,{" "}
              {GUARDIAN.relationship}
            </p>
          </div>
        </section>
      </div>
    </Screen>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={56}
        height={56}
        loading="lazy"
        className="h-14 w-14 rounded-full object-cover shadow-soft shrink-0"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="h-14 w-14 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold text-xl shadow-soft shrink-0"
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
