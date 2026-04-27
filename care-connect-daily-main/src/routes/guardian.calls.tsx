import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, CalendarClock } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { cn } from "@/lib/utils";

type Filter = "all" | "ai" | "family" | "missed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ai", label: "AI check-ins" },
  { id: "family", label: "Family calls" },
  { id: "missed", label: "Missed" },
];

type CallStatus = "answered" | "declined" | "ai" | "missed";
interface CallEntry {
  id: string;
  /** ISO date-time */
  at: string;
  durationSec: number;
  status: CallStatus;
  kind: "ai" | "family";
  mood: string;
  summary: string;
}

export const Route = createFileRoute("/guardian/calls")({
  validateSearch: (s: Record<string, unknown>): { filter: Filter } => {
    const f = s.filter;
    return {
      filter: f === "ai" || f === "family" || f === "missed" ? f : "all",
    };
  },
  head: () => ({ meta: [{ title: "Call history — CareConnect" }] }),
  component: CallsScreen,
});

// TODO(backend): replace with paginated query from Lovable Cloud
function generateMockBatch(offset: number, count: number): CallEntry[] {
  const base = Date.now();
  const moods = ["😊", "🙂", "😐", "😟"];
  const summaries = [
    "Cheerful, talked about garden",
    "Quiet, mentioned sore hip",
    "Bright morning, took meds on time",
    "Reminisced about old neighborhood",
    "Seemed tired, brief check-in",
  ];
  const statuses: CallStatus[] = ["answered", "ai", "missed", "declined", "answered", "ai"];
  return Array.from({ length: count }, (_, i) => {
    const idx = offset + i;
    const at = new Date(base - idx * 1000 * 60 * 60 * 11).toISOString();
    const status = statuses[idx % statuses.length];
    return {
      id: `call_${idx}`,
      at,
      durationSec: status === "missed" ? 0 : 60 + ((idx * 47) % 540),
      status,
      kind: status === "ai" ? "ai" : "family",
      mood: moods[idx % moods.length],
      summary: status === "missed" ? "No answer" : summaries[idx % summaries.length],
    };
  });
}

function CallsScreen() {
  const { filter } = Route.useSearch();
  const navigate = useNavigate();

  const [calls, setCalls] = useState<CallEntry[]>(() => generateMockBatch(0, 12));
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading) {
          setLoading(true);
          // TODO(backend): fetch next page
          setTimeout(() => {
            setCalls((prev) => {
              const next = generateMockBatch(prev.length, 8);
              const stop = prev.length >= 40;
              if (stop) setHasMore(false);
              return [...prev, ...next];
            });
            setLoading(false);
          }, 600);
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (filter === "all") return true;
      if (filter === "ai") return c.kind === "ai";
      if (filter === "family") return c.kind === "family";
      if (filter === "missed") return c.status === "missed";
      return true;
    });
  }, [calls, filter]);

  const grouped = useMemo(() => groupByDay(filtered), [filtered]);

  const setFilter = (f: Filter) => {
    navigate({ to: "/guardian/calls", search: { filter: f } });
  };

  return (
    <Screen ui="guardian" className="pb-24">
      {/* Top bar */}
      <header className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <BackButton fallback="/guardian/dashboard" />
          <h1 className="text-xl font-bold">Call history</h1>
        </div>

        {/* Filter pills */}
        <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 whitespace-nowrap">
            {FILTERS.map((f) => {
              const active = f.id === filter;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-pill text-sm font-medium transition active:scale-[0.97]",
                    active
                      ? "bg-accent text-accent-foreground shadow-soft"
                      : "bg-secondary text-text-secondary hover:bg-muted",
                  )}
                  aria-pressed={active}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="pb-8">
        {grouped.length === 0 ? (
          <EmptyState />
        ) : (
          grouped.map((group) => (
            <section key={group.label}>
              <h2 className="sticky top-[112px] z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                {group.label}
              </h2>
              <ul className="flex flex-col gap-2 mt-2">
                {group.calls.map((c) => (
                  <CallRow
                    key={c.id}
                    call={c}
                    onOpen={() =>
                      navigate({
                        to: "/guardian/calls/$callId",
                        params: { callId: c.id },
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))
        )}

        {/* Infinite scroll sentinel */}
        {grouped.length > 0 && (
          <div ref={sentinelRef} className="flex items-center justify-center py-6">
            {loading && <Loader2 size={22} className="animate-spin text-accent" />}
            {!hasMore && !loading && (
              <p className="text-sm text-text-secondary">No more calls</p>
            )}
          </div>
        )}
      </div>
          <GuardianTabBar />
    </Screen>
  );
}

function CallRow({ call, onOpen }: { call: CallEntry; onOpen: () => void }) {
  const accent: Record<CallStatus, string> = {
    answered: "bg-success",
    declined: "bg-muted-foreground/40",
    ai: "bg-primary",
    missed: "bg-danger",
  };
  const time = new Date(call.at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const dur = formatDuration(call.durationSec);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full flex items-stretch gap-3 bg-card rounded-lg shadow-soft overflow-hidden text-left active:scale-[0.99] transition"
      >
        <span aria-hidden className={cn("w-1 shrink-0", accent[call.status])} />
        <div className="flex-1 min-w-0 py-3 pr-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text-secondary">
              {time} • {dur}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl leading-none" aria-hidden>
                {call.mood}
              </span>
              <p className="text-[15px] truncate text-foreground">{call.summary}</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-text-secondary shrink-0" />
        </div>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center text-center px-6 py-16">
      <div className="h-24 w-24 rounded-full bg-primary/15 flex items-center justify-center mb-5">
        <CalendarClock size={44} className="text-accent" />
      </div>
      <p className="text-base text-foreground max-w-xs leading-relaxed">
        No calls yet. Eleanor's first check-in is scheduled for tomorrow at 9 AM.
      </p>
    </div>
  );
}

function formatDuration(s: number) {
  if (s <= 0) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

function groupByDay(calls: CallEntry[]): { label: string; calls: CallEntry[] }[] {
  const today = startOfDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const map = new Map<string, { label: string; calls: CallEntry[]; sortKey: number }>();
  for (const c of calls) {
    const d = startOfDay(new Date(c.at));
    const key = d.toISOString();
    let label: string;
    if (d.getTime() === today.getTime()) label = "Today";
    else if (d.getTime() === yesterday.getTime()) label = "Yesterday";
    else label = d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    if (!map.has(key)) map.set(key, { label, calls: [], sortKey: -d.getTime() });
    map.get(key)!.calls.push(c);
  }
  return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
