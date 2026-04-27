import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Info,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  Quote,
} from "lucide-react";
import {
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  PolarAngleAxis,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { GhostButton, PrimaryButton } from "@/components/layout/Buttons";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/memory")({
  component: MemoryPage,
});

// --- Mock data ----------------------------------------------------------

const SCORE = 87;
const ANSWERS_COUNT = 47;
const DAYS_COLLECTED = 14;
const DAYS_NEEDED = 14;

// Toggle to preview the empty state
const HAS_ENOUGH_DATA = DAYS_COLLECTED >= DAYS_NEEDED;

const TREND: { week: string; score: number }[] = [
  { week: "W1", score: 92 },
  { week: "W2", score: 90 },
  { week: "W3", score: 91 },
  { week: "W4", score: 88 },
  { week: "W5", score: 89 },
  { week: "W6", score: 86 },
  { week: "W7", score: 88 },
  { week: "W8", score: 87 },
];

type Severity = "low" | "medium" | "high";

interface Theme {
  id: string;
  label: string;
  mentions: number;
  driftDays: number;
  severity: Severity;
  examples: { date: string; quote: string }[];
  explainer: string;
}

const THEMES: Theme[] = [
  {
    id: "morning-routine",
    label: "Morning routine",
    mentions: 5,
    driftDays: 14,
    severity: "medium",
    examples: [
      { date: "Apr 7", quote: "I had toast and tea, same as always." },
      { date: "Apr 14", quote: "I think I had something for breakfast." },
      { date: "Apr 21", quote: "I'm not sure if I had breakfast yet today." },
    ],
    explainer:
      "Eleanor's answers to questions about her morning routine have become less specific over the past two weeks. This is a small pattern, not a verdict — many things affect short-term recall, including sleep and mood. It might be worth a gentle mention at her next visit with her doctor.",
  },
  {
    id: "neighbor-name",
    label: "Neighbor's name",
    mentions: 3,
    driftDays: 10,
    severity: "low",
    examples: [
      { date: "Apr 11", quote: "Margaret stopped by with some cookies." },
      { date: "Apr 17", quote: "The lady next door — what's her name again?" },
      { date: "Apr 22", quote: "My neighbor came over today, she's lovely." },
    ],
    explainer:
      "Word-finding hiccups are very common and often don't mean anything on their own. We're flagging it only because it's the same name across multiple calls — keep an eye, no need to worry.",
  },
];

// --- Helpers ------------------------------------------------------------

function scoreTone(score: number) {
  if (score >= 80)
    return {
      label: "On track",
      sub: "Things look steady right now.",
      color: "var(--success)",
      bg: "bg-success/10",
      text: "text-success",
    };
  if (score >= 60)
    return {
      label: "Worth watching",
      sub: "A few small patterns to keep an eye on.",
      color: "var(--warning)",
      bg: "bg-warning/10",
      text: "text-warning",
    };
  return {
    label: "Worth a chat",
    sub: "Consider mentioning at her next doctor's visit.",
    color: "var(--danger)",
    bg: "bg-danger/10",
    text: "text-danger",
  };
}

function severityTone(s: Severity) {
  if (s === "low")
    return { dot: "bg-success", label: "Mild", text: "text-success", bg: "bg-success/10" };
  if (s === "medium")
    return { dot: "bg-warning", label: "Notable", text: "text-warning", bg: "bg-warning/10" };
  return { dot: "bg-danger", label: "Persistent", text: "text-danger", bg: "bg-danger/10" };
}

// --- Page --------------------------------------------------------------

function MemoryPage() {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const tone = scoreTone(SCORE);

  return (
    <Screen className="pb-24">
      <header className="flex items-center gap-2 mb-4">
        <BackButton fallback="/guardian/dashboard" />
        <h1 className="text-2xl font-bold">Memory</h1>
      </header>

      {!HAS_ENOUGH_DATA ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-5">
          <HeroCard tone={tone} onInfo={() => setExplainerOpen(true)} />
          <TrendCard />
          <ThemesSection />
          <DoctorCard />
        </div>
      )}

      <Sheet open={explainerOpen} onOpenChange={setExplainerOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="text-accent" size={20} /> How this works
            </SheetTitle>
            <SheetDescription className="text-base text-foreground/80 leading-relaxed pt-2">
              We compare Eleanor's answers to similar questions across different
              days. Big shifts can be a normal part of aging — but persistent
              patterns are sometimes worth mentioning at her next doctor's
              visit.
              <br />
              <br />
              <strong className="text-foreground">
                We are not a medical diagnosis.
              </strong>{" "}
              Think of this as a friendly second pair of ears.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
          <GuardianTabBar />
    </Screen>
  );
}

// --- Hero card ---------------------------------------------------------

function HeroCard({
  tone,
  onInfo,
}: {
  tone: ReturnType<typeof scoreTone>;
  onInfo: () => void;
}) {
  const data = [{ name: "score", value: SCORE, fill: tone.color }];

  return (
    <Card className="!p-6 relative overflow-hidden">
      {/* soft background wash */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          background: `radial-gradient(120% 80% at 50% 0%, color-mix(in oklab, ${tone.color} 18%, transparent), transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative h-56 w-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="78%"
              outerRadius="100%"
              data={data}
              startAngle={90}
              endAngle={-270}
              barSize={18}
            >
              <PolarAngleAxis
                type="number"
                domain={[0, 100]}
                angleAxisId={0}
                tick={false}
              />
              <RadialBar
                dataKey="value"
                cornerRadius={12}
                background={{ fill: "var(--muted)" }}
                angleAxisId={0}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-1">
              <span className="text-6xl font-bold tabular-nums tracking-tight">
                {SCORE}
              </span>
              <span className="text-xl text-muted-foreground tabular-nums">
                /100
              </span>
            </div>
            <span className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
              Consistency
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-sm font-semibold",
              tone.bg,
              tone.text,
            )}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: tone.color }}
              aria-hidden
            />
            Memory consistency: {tone.label}
          </span>
          <button
            type="button"
            onClick={onInfo}
            aria-label="How this works"
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Info size={18} />
          </button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground max-w-xs">
          {tone.sub} Based on{" "}
          <strong className="text-foreground">{ANSWERS_COUNT} answers</strong>{" "}
          across <strong className="text-foreground">{DAYS_COLLECTED} days</strong>.
        </p>
      </div>
    </Card>
  );
}

// --- Trend card --------------------------------------------------------

function TrendCard() {
  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">Consistency over time</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Weekly average over the last 8 weeks.
        </p>
      </div>
      <div className="mt-4 h-48 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={TREND}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              domain={[60, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              width={28}
            />
            <ReferenceLine
              y={80}
              stroke="var(--text-secondary)"
              strokeDasharray="4 4"
              opacity={0.4}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
              }}
              formatter={(v: number) => [`${v}/100`, "Consistency"]}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="var(--accent)"
              strokeWidth={3}
              dot={{ fill: "var(--accent)", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// --- Themes ------------------------------------------------------------

function ThemesSection() {
  if (THEMES.length === 0) {
    return (
      <Card className="text-center !py-8">
        <div className="mx-auto h-12 w-12 rounded-full bg-success/10 text-success flex items-center justify-center">
          <Heart size={22} />
        </div>
        <h2 className="mt-3 text-lg font-semibold">All looking good!</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nothing to flag this period. We'll let you know if a pattern emerges.
        </p>
      </Card>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <h2 className="text-lg font-semibold">Themes worth watching</h2>
        <span className="text-xs text-muted-foreground">{THEMES.length} themes</span>
      </div>
      <div className="flex flex-col gap-3">
        {THEMES.map((t) => (
          <ThemeCard key={t.id} theme={t} />
        ))}
      </div>
    </section>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  const [expanded, setExpanded] = useState(false);
  const sev = severityTone(theme.severity);

  return (
    <Card className="!p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn("h-2.5 w-2.5 rounded-full shrink-0", sev.dot)}
              aria-hidden
            />
            <h3 className="text-[18px] font-semibold leading-tight">
              {theme.label}
            </h3>
            <span
              className={cn(
                "rounded-pill px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                sev.bg,
                sev.text,
              )}
            >
              {sev.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {theme.mentions} mentions • drift detected over {theme.driftDays} days
          </p>
        </div>
      </div>

      {/* Quote timeline */}
      <ol className="mt-4 relative pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-px before:bg-border">
        {theme.examples.map((ex, i) => (
          <li key={i} className="relative pb-3 last:pb-0">
            <span
              className={cn(
                "absolute -left-[10px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-card",
                i === theme.examples.length - 1 ? sev.dot : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {ex.date}
              </span>
            </div>
            <blockquote className="mt-1 rounded-lg bg-muted/60 px-3 py-2 text-[15px] leading-snug text-foreground/90 relative">
              <Quote
                size={12}
                className="absolute top-2 left-2 text-muted-foreground/50"
                aria-hidden
              />
              <span className="pl-4">{ex.quote}</span>
            </blockquote>
          </li>
        ))}
      </ol>

      <div className="mt-3 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full inline-flex items-center justify-between text-sm font-medium text-accent hover:text-accent/80"
          aria-expanded={expanded}
        >
          <span>What does this mean?</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expanded && (
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">
            {theme.explainer}
          </p>
        )}
      </div>
    </Card>
  );
}

// --- Doctor share card -------------------------------------------------

function DoctorCard() {
  return (
    <Card className="bg-accent/5 border border-accent/15">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-full bg-accent/15 text-accent flex items-center justify-center">
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold">
            Share these observations with Eleanor's doctor
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generates a one-page summary of recent themes and example quotes —
            something to bring along, not a diagnosis.
          </p>
          <PrimaryButton
            type="button"
            className="mt-3 !min-h-11 !text-sm"
            onClick={() => {
              // TODO(backend): generate PDF from observations
              toast.success("Generating doctor's summary…");
            }}
          >
            <FileText size={16} /> Create doctor's summary
          </PrimaryButton>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground italic leading-relaxed">
        These are observations, not diagnoses. Many things affect memory —
        sleep, mood, medications, even the time of day.
      </p>
    </Card>
  );
}

// --- Empty state -------------------------------------------------------

function EmptyState() {
  const pct = Math.round((DAYS_COLLECTED / DAYS_NEEDED) * 100);
  return (
    <Card className="!py-10 text-center">
      <div className="mx-auto h-20 w-20 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        <Sparkles size={32} />
      </div>
      <h2 className="mt-5 text-xl font-semibold">
        We're still getting to know Eleanor
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
        Memory insights become available after about two weeks of regular
        check-ins. Until then, every call helps build the picture.
      </p>

      <div className="mt-6 max-w-xs mx-auto">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{DAYS_COLLECTED} of {DAYS_NEEDED} days collected</span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <GhostButton
        type="button"
        className="mt-6 !min-h-11 !text-sm"
        onClick={() => toast("We'll keep listening")}
      >
        Got it
      </GhostButton>
    </Card>
  );
}
