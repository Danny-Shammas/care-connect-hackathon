import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Share2,
  ChevronLeft,
  ChevronRight,
  Send,
  FileDown,
  TrendingUp,
  Phone,
  Clock,
  Pill,
  Quote,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, GhostButton } from "@/components/layout/Buttons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/reports/weekly")({
  component: WeeklyReportPage,
});

// --- Types & data -------------------------------------------------------

interface WeeklyReport {
  id: string;
  startISO: string; // Monday
  endISO: string; // Sunday
  summary: string;
  stats: {
    callsAnswered: { value: number; total: number };
    avgLength: string;
    medAdherence: number; // 0-100
    moodTrend: { label: string; direction: "up" | "down" | "flat" };
  };
  mood: { day: string; score: number }[];
  topics: { label: string; weight: number }[];
  highlights: { date: string; quote: string }[];
}

const REPORTS: WeeklyReport[] = [
  {
    id: "w-apr-15",
    startISO: "2025-04-15",
    endISO: "2025-04-21",
    summary:
      "Eleanor had a quiet but cheerful week. She took 19 of her 21 scheduled medications and her mood was steady — slightly higher than last week. She mentioned her hip a few times early in the week but seemed better by Friday. She's been talking a lot about preparing the garden.",
    stats: {
      callsAnswered: { value: 6, total: 7 },
      avgLength: "3m 42s",
      medAdherence: 90,
      moodTrend: { label: "Steady, slightly up", direction: "up" },
    },
    mood: [
      { day: "Mon", score: 68 },
      { day: "Tue", score: 64 },
      { day: "Wed", score: 70 },
      { day: "Thu", score: 72 },
      { day: "Fri", score: 78 },
      { day: "Sat", score: 80 },
      { day: "Sun", score: 76 },
    ],
    topics: [
      { label: "garden", weight: 12 },
      { label: "Sarah", weight: 9 },
      { label: "tomatoes", weight: 7 },
      { label: "neighbor", weight: 6 },
      { label: "hip pain", weight: 5 },
      { label: "weather", weight: 4 },
      { label: "tea", weight: 3 },
      { label: "church", weight: 2 },
    ],
    highlights: [
      {
        date: "Apr 15",
        quote:
          "I had a lovely chat with the neighbor this morning. She brought over her grandson.",
      },
      {
        date: "Apr 17",
        quote:
          "I think I'll skip my walk today, my hip is sore — but tomorrow, definitely.",
      },
      {
        date: "Apr 19",
        quote:
          "The tomato seedlings are doing beautifully. I might have too many for the planters.",
      },
      {
        date: "Apr 21",
        quote: "Sarah called yesterday. We talked for almost an hour about the kids.",
      },
    ],
  },
  {
    id: "w-apr-08",
    startISO: "2025-04-08",
    endISO: "2025-04-14",
    summary:
      "A slower week. Eleanor mentioned feeling tired on Tuesday and Wednesday but bounced back. Medication adherence dipped on the days she napped in the afternoon — worth a gentle check.",
    stats: {
      callsAnswered: { value: 5, total: 7 },
      avgLength: "3m 12s",
      medAdherence: 81,
      moodTrend: { label: "Slightly down", direction: "down" },
    },
    mood: [
      { day: "Mon", score: 72 },
      { day: "Tue", score: 60 },
      { day: "Wed", score: 58 },
      { day: "Thu", score: 66 },
      { day: "Fri", score: 70 },
      { day: "Sat", score: 71 },
      { day: "Sun", score: 68 },
    ],
    topics: [
      { label: "tired", weight: 8 },
      { label: "tea", weight: 6 },
      { label: "Sarah", weight: 6 },
      { label: "garden", weight: 5 },
      { label: "rain", weight: 4 },
      { label: "doctor", weight: 3 },
    ],
    highlights: [
      { date: "Apr 9", quote: "I just feel a bit tired today, that's all. Nothing to fuss over." },
      { date: "Apr 11", quote: "I forgot to take my evening pill again. I'll set the kitchen timer." },
      { date: "Apr 13", quote: "The rain finally stopped. I sat on the porch and watched the birds." },
    ],
  },
];

// --- Helpers ------------------------------------------------------------

function fmtRange(startISO: string, endISO: string) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// --- Page --------------------------------------------------------------

function WeeklyReportPage() {
  const [index, setIndex] = useState(0);
  const report = REPORTS[index];
  const hasNewer = index > 0;
  const hasOlder = index < REPORTS.length - 1;

  return (
    <Screen className="pb-24">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-2 mb-3">
        <BackButton fallback="/guardian/dashboard" />
        <button
          type="button"
          aria-label="Share"
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.share) {
              navigator.share({ title: "Eleanor's week", text: report.summary }).catch(() => {});
            } else {
              toast.success("Link copied");
            }
          }}
          className="h-11 w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Share2 size={20} />
        </button>
      </header>

      {/* Week pager */}
      <div className="flex items-center justify-between gap-2 mb-5 rounded-pill bg-muted px-2 py-1.5">
        <button
          type="button"
          aria-label="Previous week"
          disabled={!hasOlder}
          onClick={() => setIndex((i) => Math.min(i + 1, REPORTS.length - 1))}
          className="h-9 w-9 rounded-full flex items-center justify-center text-foreground hover:bg-background/70 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-sm font-medium tabular-nums">
          Week of {fmtShort(report.startISO)}
        </div>
        <button
          type="button"
          aria-label="Next week"
          disabled={!hasNewer}
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          className="h-9 w-9 rounded-full flex items-center justify-center text-foreground hover:bg-background/70 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Title */}
      <div className="mb-5 px-1">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight">
          Eleanor's week
        </h1>
        <p className="mt-1 text-base text-muted-foreground tabular-nums">
          {fmtRange(report.startISO, report.endISO)}
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <SummaryCard summary={report.summary} />
        <StatsGrid stats={report.stats} />
        <MoodCard data={report.mood} />
        <TopicsCard topics={report.topics} />
        <HighlightsCard highlights={report.highlights} />
        <ActionFooter report={report} />
      </div>
          <GuardianTabBar />
    </Screen>
  );
}

// --- Hero summary -------------------------------------------------------

function SummaryCard({ summary }: { summary: string }) {
  return (
    <Card className="!p-6 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 65%)",
        }}
      />
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">
          A note on her week
        </p>
        <p
          className="mt-3 text-[18px] leading-[1.65] text-foreground/90"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          {summary}
        </p>
      </div>
    </Card>
  );
}

// --- Stats grid ---------------------------------------------------------

function StatsGrid({ stats }: { stats: WeeklyReport["stats"] }) {
  const items = [
    {
      icon: <Phone size={16} />,
      label: "Calls answered",
      value: `${stats.callsAnswered.value} of ${stats.callsAnswered.total}`,
      tone: "text-foreground",
    },
    {
      icon: <Clock size={16} />,
      label: "Avg call length",
      value: stats.avgLength,
      tone: "text-foreground",
    },
    {
      icon: <Pill size={16} />,
      label: "Med adherence",
      value: `${stats.medAdherence}%`,
      tone: stats.medAdherence >= 85 ? "text-success" : "text-warning",
    },
    {
      icon: <TrendingUp size={16} />,
      label: "Mood trend",
      value: stats.moodTrend.label,
      tone:
        stats.moodTrend.direction === "up"
          ? "text-success"
          : stats.moodTrend.direction === "down"
            ? "text-warning"
            : "text-foreground",
      arrow: stats.moodTrend.direction,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((it) => (
        <Card key={it.label} className="!p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{it.icon}</span>
            <span className="text-xs font-medium uppercase tracking-wide">
              {it.label}
            </span>
          </div>
          <div className={cn("mt-2 text-xl font-semibold leading-tight", it.tone)}>
            {"arrow" in it && it.arrow === "up" && <span aria-hidden>↑ </span>}
            {"arrow" in it && it.arrow === "down" && <span aria-hidden>↓ </span>}
            {it.value}
          </div>
        </Card>
      ))}
    </div>
  );
}

// --- Mood chart ---------------------------------------------------------

function MoodCard({ data }: { data: WeeklyReport["mood"] }) {
  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">Mood through the week</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Daily average score</p>
      </div>
      <div className="mt-4 h-48 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="moodFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
              }}
              formatter={(v: number) => [`${v}/100`, "Mood"]}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="var(--primary)"
              strokeWidth={3}
              fill="url(#moodFill)"
              dot={{ fill: "var(--primary)", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// --- Topics word-cloud --------------------------------------------------

function TopicsCard({ topics }: { topics: WeeklyReport["topics"] }) {
  const max = useMemo(() => Math.max(...topics.map((t) => t.weight)), [topics]);

  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">What she talked about</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Topics across this week's calls
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {topics.map((t) => {
          const ratio = t.weight / max; // 0..1
          // Map ratio → font size 14..28 and opacity tier
          const fontSize = 14 + Math.round(ratio * 14);
          const strong = ratio > 0.66;
          const mid = ratio > 0.33 && !strong;
          return (
            <span
              key={t.label}
              className={cn(
                "rounded-pill px-3 py-1.5 font-medium leading-none",
                strong && "bg-primary/15 text-primary",
                mid && "bg-accent/10 text-accent",
                !strong && !mid && "bg-muted text-muted-foreground",
              )}
              style={{ fontSize }}
              title={`${t.weight} mentions`}
            >
              {t.label}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

// --- Highlights ---------------------------------------------------------

function HighlightsCard({ highlights }: { highlights: WeeklyReport["highlights"] }) {
  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold">Moments from the week</h2>
        <p className="text-sm text-muted-foreground mt-0.5">In her own words</p>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {highlights.map((h, i) => (
          <li key={i} className="flex gap-3">
            <div className="shrink-0 w-14 pt-2 text-xs font-medium text-muted-foreground tabular-nums">
              {h.date}
            </div>
            <blockquote className="flex-1 rounded-lg bg-muted/60 px-3 py-2.5 text-[15px] leading-snug text-foreground/90 relative">
              <Quote
                size={12}
                className="absolute top-2 left-2 text-muted-foreground/50"
                aria-hidden
              />
              <span className="pl-4">{h.quote}</span>
            </blockquote>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// --- Action footer ------------------------------------------------------

function ActionFooter({ report }: { report: WeeklyReport }) {
  const onShare = () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: `Eleanor's week — ${fmtRange(report.startISO, report.endISO)}`,
          text: report.summary,
        })
        .catch(() => {});
    } else {
      // TODO(backend): open a share sheet with email/SMS options
      toast.success("Share link copied");
    }
  };

  return (
    <Card className="!p-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <PrimaryButton type="button" onClick={onShare} className="flex-1">
          <Send size={18} /> Send this to family
        </PrimaryButton>
        <GhostButton
          type="button"
          onClick={() => {
            // TODO(backend): generate weekly report PDF
            toast.success("Saving as PDF…");
          }}
          className="flex-1"
        >
          <FileDown size={18} /> Save as PDF
        </GhostButton>
      </div>
    </Card>
  );
}
