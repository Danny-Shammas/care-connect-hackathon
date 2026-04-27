import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  AlertTriangle,
  ChevronRight,
  Settings2,
  Pill,
  Brain,
  TrendingUp,
  Quote,
} from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { Card } from "@/components/layout/Card";
import { StatusPill } from "@/components/layout/StatusPill";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { GhostButton } from "@/components/layout/Buttons";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — CareConnect" },
      { name: "description", content: "Today's check-in, mood, meds and recent calls." },
    ],
  }),
  component: GuardianDashboard,
});

// TODO(backend): replace mock data with Lovable Cloud queries
const elder = { name: "Eleanor", avatarUrl: "" };
const alert = {
  active: false,
  message: "Eleanor hasn't answered in 2 days. Consider giving her a call or visit.",
};
const todaysCheckIn = {
  time: "9:14 AM",
  duration: "4 min 12 sec",
  moodIndex: 3, // 0..4
  moodLabel: "Eleanor seemed cheerful",
  meds: { taken: 2, total: 3, ok: false },
  mood: "Cheerful",
  memory: "Consistent",
  summary:
    "Eleanor talked about her garden and mentioned the tomatoes are doing well. She remembered to take her morning meds but said she'd take her noon dose 'after lunch' — worth a follow-up tomorrow.",
  quotes: [
    "I had a lovely chat with the neighbor this morning",
    "I think I'll skip my walk today, my hip is sore",
  ],
};
const recentCalls = [
  { id: "1", date: "Today", time: "9:14 AM", mood: "🙂", duration: "4:12" },
  { id: "2", date: "Yesterday", time: "9:08 AM", mood: "😊", duration: "5:30" },
  { id: "3", date: "Mon", time: "9:11 AM", mood: "😐", duration: "3:45" },
];
const moodEmojis = ["😢", "😟", "😐", "🙂", "😊"];

function GuardianDashboard() {
  const [scrolled, setScrolled] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const showAlert = alert.active && !dismissed;
  const hasUnread = true;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Screen ui="guardian" hasBottomBar>
      {/* Sticky status header */}
      <header
        className={cn(
          "sticky top-0 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur transition-shadow",
          scrolled && "shadow-soft",
        )}
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.75rem)" }}
      >
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={elder.avatarUrl} alt={elder.name} />
            <AvatarFallback className="bg-primary/20 text-accent font-semibold">
              {elder.name[0]}
            </AvatarFallback>
          </Avatar>
          <p className="font-semibold text-base">{elder.name}</p>

          <div className="flex-1 overflow-x-auto scrollbar-none -mx-1 px-1">
            <div className="flex gap-2 whitespace-nowrap">
              <StatusPill tone="success" label="Connected" />
              <StatusPill tone="neutral" label="Last seen 12 min ago" />
              <StatusPill tone="warning" label="Last call: today 9:14 AM" />
            </div>
          </div>

          <Link
            to="/guardian/alerts"
            aria-label="Alerts"
            className="relative shrink-0 h-11 w-11 -mr-2 rounded-full inline-flex items-center justify-center hover:bg-muted active:scale-[0.95] transition"
          >
            <Bell size={22} className="text-foreground" />
            {hasUnread && (
              <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-background" />
            )}
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-5 pt-4 pb-6">
        {/* Alert banner */}
        {showAlert && (
          <Link
            to="/guardian/alerts"
            className="text-left flex gap-3 items-start rounded-lg p-4 bg-warning/10 border border-warning/30 active:scale-[0.99] transition"
          >
            <AlertTriangle className="text-warning shrink-0 mt-0.5" size={22} />
            <div className="flex-1">
              <p className="text-[15px] leading-snug text-foreground">{alert.message}</p>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDismissed(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setDismissed(true);
                }
              }}
              className="text-sm text-text-secondary underline shrink-0 cursor-pointer min-h-11 inline-flex items-center"
            >
              Dismiss
            </span>
          </Link>
        )}

        {/* Today's check-in */}
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold">Today's check-in</h2>
            <span className="text-sm text-text-secondary">
              {todaysCheckIn.time} · {todaysCheckIn.duration}
            </span>
          </div>

          {/* Mood emojis */}
          <div className="mt-5 flex items-center justify-between gap-2">
            {moodEmojis.map((e, i) => (
              <span
                key={i}
                className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center text-2xl transition",
                  i === todaysCheckIn.moodIndex
                    ? "bg-primary/20 ring-2 ring-primary scale-110"
                    : "opacity-40",
                )}
              >
                {e}
              </span>
            ))}
          </div>
          <p className="mt-3 text-center text-base font-medium text-foreground">
            {todaysCheckIn.moodLabel}
          </p>

          {/* Quick stats */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <Stat
              label="Meds"
              value={`${todaysCheckIn.meds.taken} of ${todaysCheckIn.meds.total}`}
              tone={todaysCheckIn.meds.ok ? "good" : "warn"}
            />
            <Stat label="Mood" value={todaysCheckIn.mood} tone="good" />
            <Stat label="Memory" value={todaysCheckIn.memory} tone="good" />
          </div>

          {/* AI summary */}
          <p className="mt-5 text-base leading-relaxed text-foreground/90">
            {todaysCheckIn.summary}
          </p>

          {/* Quotes */}
          <div className="mt-4 flex flex-col gap-2">
            {todaysCheckIn.quotes.map((q, i) => (
              <div
                key={i}
                className="flex gap-2 rounded-md bg-secondary/70 px-3 py-2 text-[15px] italic text-foreground/85"
              >
                <Quote size={16} className="text-accent shrink-0 mt-1" />
                <p>{q}</p>
              </div>
            ))}
          </div>

          <GhostButton className="mt-5 w-full">Read full transcript</GhostButton>
        </Card>

        {/* Quick nav tiles */}
        <div className="grid grid-cols-2 gap-3">
          <Tile to="/guardian/personalize" icon={Settings2} label="Personalize" stat="5 questions active" />
          <Tile to="/guardian/medications" icon={Pill} label="Medications" stat="92% adherence this week" />
          <Tile to="/guardian/memory" icon={Brain} label="Memory" stat="On track" />
          <Tile to="/guardian/reports/weekly" icon={TrendingUp} label="Weekly report" stat="View Sun's summary" />
        </div>

        {/* Recent calls */}
        <section>
          <SectionHeader>Recent calls</SectionHeader>
          <Card className="p-2">
            <ul className="divide-y divide-border">
              {recentCalls.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/guardian/calls/$callId"
                    params={{ callId: c.id }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-md hover:bg-muted active:scale-[0.99] transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.date}</p>
                      <p className="text-sm text-text-secondary">{c.time}</p>
                    </div>
                    <span className="text-2xl">{c.mood}</span>
                    <span className="text-sm text-text-secondary tabular-nums w-12 text-right">
                      {c.duration}
                    </span>
                    <ChevronRight size={18} className="text-text-secondary shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <div className="mt-3 text-center">
            <Link
              to="/guardian/calls"
              className="text-accent text-sm font-medium underline-offset-4 hover:underline"
            >
              See all calls
            </Link>
          </div>
        </section>
      </div>

      <GuardianTabBar />
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" }) {
  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2 text-center">
      <p className="text-[11px] uppercase tracking-wide text-text-secondary font-semibold">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-semibold mt-0.5",
          tone === "good" ? "text-accent" : "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  stat,
  to,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  stat: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="text-left bg-card rounded-lg p-4 shadow-soft active:scale-[0.98] transition flex flex-col gap-2 min-h-[110px]"
    >
      <div className="h-10 w-10 rounded-md bg-primary/15 flex items-center justify-center">
        <Icon size={22} className="text-accent" />
      </div>
      <p className="font-semibold text-[15px]">{label}</p>
      <p className="text-xs text-text-secondary leading-snug">{stat}</p>
    </Link>
  );
}
