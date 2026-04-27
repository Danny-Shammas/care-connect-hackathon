import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Play,
  Pause,
  Download,
  Check,
  X as XIcon,
  Share2,
  Flag,
  PhoneCall,
  Clock,
  PhoneOff,
} from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { GhostButton, PrimaryButton } from "@/components/layout/Buttons";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/calls/$callId")({
  head: () => ({ meta: [{ title: "Call details — CareConnect" }] }),
  component: CallDetailScreen,
});

// TODO(backend): fetch real call by id from Lovable Cloud
interface Turn {
  speaker: "ai" | "elder";
  text: string;
  /** seconds from start */
  ts: number;
  highlights?: { term: string; tone: "med" | "mood" }[];
}
function getMockCall(callId: string) {
  const missed = callId.endsWith("0");
  return {
    id: callId,
    missed,
    dateLabel: "Tuesday, April 21",
    timeLabel: "9:14 AM",
    duration: 252, // seconds
    audioUrl: "",
    summary:
      "Eleanor was in good spirits this morning. She talked at length about her garden and the neighbor's visit. She took her morning meds but plans to take her noon dose 'after lunch'.",
    topics: ["garden", "medication", "neighbor"],
    mood: { emoji: "🙂", label: "Cheerful" },
    moodHistory: [2, 3, 3, 2, 4, 3, 4],
    meds: [
      { name: "Lisinopril (morning)", taken: true },
      { name: "Vitamin D", taken: true },
      { name: "Metformin (noon)", taken: false },
    ],
    memory: { ok: true, note: "Consistent with previous answers" },
    turns: [
      {
        speaker: "ai",
        ts: 2,
        text: "Good morning, Eleanor! How are you feeling today?",
      },
      {
        speaker: "elder",
        ts: 8,
        text: "Oh, I'm doing well, thank you. I had a lovely chat with the neighbor this morning.",
        highlights: [{ term: "lovely", tone: "mood" }],
      },
      {
        speaker: "ai",
        ts: 18,
        text: "That sounds wonderful. Did you get a chance to take your morning Lisinopril and Vitamin D?",
        highlights: [
          { term: "Lisinopril", tone: "med" },
          { term: "Vitamin D", tone: "med" },
        ],
      },
      {
        speaker: "elder",
        ts: 30,
        text: "Yes, I took both with breakfast. I'll take the Metformin after lunch.",
        highlights: [{ term: "Metformin", tone: "med" }],
      },
      {
        speaker: "ai",
        ts: 42,
        text: "Perfect. And how's the garden coming along?",
      },
      {
        speaker: "elder",
        ts: 50,
        text: "The tomatoes are doing well! I think I'll skip my walk today, my hip is sore.",
        highlights: [{ term: "sore", tone: "mood" }],
      },
    ] as Turn[],
  };
}

function CallDetailScreen() {
  const { callId } = Route.useParams();
  const call = useMemo(() => getMockCall(callId), [callId]);

  return (
    <Screen ui="guardian">
      {/* Top bar */}
      <header className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-background/95 backdrop-blur shadow-soft">
        <div className="flex items-start gap-2">
          <BackButton fallback="/guardian/calls" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight">{call.dateLabel}</h1>
            <p className="text-sm text-text-secondary">
              {call.timeLabel} • {formatDuration(call.duration)}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 pt-4 pb-32">
        {call.missed ? (
          <MissedCard />
        ) : (
          <AudioPlayer duration={call.duration} />
        )}

        {/* Summary */}
        <Card>
          <h2 className="text-base font-bold mb-2">What happened</h2>
          <p className="text-[15px] leading-relaxed text-foreground/90">{call.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {call.topics.map((t) => (
              <span
                key={t}
                className="px-3 py-1 rounded-pill text-xs font-medium bg-accent/10 text-accent"
              >
                #{t}
              </span>
            ))}
          </div>
        </Card>

        {/* Mood + signals */}
        <Card>
          <h2 className="text-base font-bold mb-3">Mood &amp; signals</h2>

          <div className="flex items-center gap-3">
            <span className="text-3xl">{call.mood.emoji}</span>
            <div className="flex-1">
              <p className="font-semibold">{call.mood.label}</p>
              <p className="text-xs text-text-secondary">Last 7 days</p>
            </div>
            <Sparkline values={call.moodHistory} />
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-wide font-semibold text-text-secondary mb-2">
              Medications
            </p>
            <ul className="flex flex-col gap-1.5">
              {call.meds.map((m) => (
                <li key={m.name} className="flex items-center gap-2 text-[15px]">
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                      m.taken ? "bg-success/20 text-success" : "bg-warning/20 text-warning",
                    )}
                  >
                    {m.taken ? <Check size={14} /> : <XIcon size={14} />}
                  </span>
                  <span className={cn(!m.taken && "text-warning font-medium")}>{m.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-md bg-secondary/60 px-3 py-2.5">
            <span
              className={cn(
                "h-2 w-2 rounded-full mt-2 shrink-0",
                call.memory.ok ? "bg-success" : "bg-warning",
              )}
            />
            <div>
              <p className="text-xs uppercase tracking-wide font-semibold text-text-secondary">
                Memory check
              </p>
              <p className="text-[15px]">{call.memory.note}</p>
            </div>
          </div>
        </Card>

        {/* Transcript */}
        {!call.missed && <Transcript turns={call.turns} />}
      </div>

      {/* Sticky bottom actions */}
      <BottomActions missed={call.missed} />
    </Screen>
  );
}

/* ----------------------- Audio player ----------------------- */
function AudioPlayer({ duration }: { duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Simulate playback (TODO(backend): wire to real audio element)
  useEffect(() => {
    if (!playing) return;
    lastTickRef.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setPos((p) => {
        const next = p + dt * speed;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, duration]);

  return (
    <Card className="sticky top-[68px] z-20 p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? "Pause" : "Play"}
          className="h-12 w-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-soft active:scale-[0.95] transition shrink-0"
        >
          {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={Math.floor(pos)}
            onChange={(e) => setPos(Number(e.target.value))}
            aria-label="Scrub"
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-xs text-text-secondary tabular-nums mt-0.5">
            <span>{formatDuration(Math.floor(pos))}</span>
            <span>{formatDuration(duration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex gap-1 bg-secondary rounded-pill p-0.5">
          {[1, 1.5, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s as 1 | 1.5 | 2)}
              className={cn(
                "px-3 py-1 text-xs font-semibold rounded-pill transition",
                speed === s
                  ? "bg-card text-accent shadow-soft"
                  : "text-text-secondary hover:text-foreground",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Download recording"
          onClick={() => {
            // TODO(backend): download recording
          }}
          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center text-text-secondary"
        >
          <Download size={18} />
        </button>
      </div>
    </Card>
  );
}

function MissedCard() {
  const navigate = useNavigate();
  return (
    <Card className="bg-warning/5 border border-warning/30">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0">
          <PhoneOff size={22} />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-base">Eleanor didn't pick up</h2>
          <p className="text-[15px] text-foreground/80 mt-1 flex items-center gap-1.5">
            <Clock size={14} className="text-text-secondary" />
            We tried 3 times between 9:00 and 9:30.
          </p>
        </div>
      </div>
      <GhostButton
        onClick={() => navigate({ to: "/elder/calling" })}
        className="mt-4 w-full"
      >
        <PhoneCall size={18} />
        Call her now
      </GhostButton>
    </Card>
  );
}

/* ----------------------- Transcript ----------------------- */
function Transcript({ turns }: { turns: Turn[] }) {
  const [showTs, setShowTs] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">Full transcript</h2>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <span>Show timestamps</span>
          <span
            role="switch"
            aria-checked={showTs}
            onClick={() => setShowTs((v) => !v)}
            className={cn(
              "relative h-5 w-9 rounded-full transition",
              showTs ? "bg-accent" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-card shadow-soft transition-transform",
                showTs ? "translate-x-4" : "translate-x-0.5",
              )}
            />
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {turns.map((turn, i) => (
          <div key={i} className="flex gap-2.5">
            <div className="w-16 shrink-0">
              <p
                className={cn(
                  "text-[11px] uppercase font-semibold tracking-wide",
                  turn.speaker === "ai" ? "text-accent" : "text-primary",
                )}
              >
                {turn.speaker === "ai" ? "Care" : "Eleanor"}
              </p>
              {showTs && (
                <p className="text-[11px] text-text-secondary tabular-nums mt-0.5">
                  {formatDuration(turn.ts)}
                </p>
              )}
            </div>
            <div
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-[15px] leading-relaxed",
                turn.speaker === "ai"
                  ? "bg-accent/10 text-foreground"
                  : "bg-primary/10 text-foreground",
              )}
            >
              {renderHighlighted(turn.text, turn.highlights)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function renderHighlighted(
  text: string,
  highlights?: { term: string; tone: "med" | "mood" }[],
) {
  if (!highlights || highlights.length === 0) return text;
  const parts: React.ReactNode[] = [text];
  highlights.forEach(({ term, tone }, hIdx) => {
    const next: React.ReactNode[] = [];
    parts.forEach((p, pIdx) => {
      if (typeof p !== "string") return next.push(p);
      const segments = p.split(new RegExp(`(${escapeRegExp(term)})`, "i"));
      segments.forEach((seg, sIdx) => {
        if (seg.toLowerCase() === term.toLowerCase()) {
          next.push(
            <span
              key={`h-${hIdx}-${pIdx}-${sIdx}`}
              className={cn(
                "underline underline-offset-4 decoration-2",
                tone === "med" ? "decoration-warning" : "decoration-success",
              )}
            >
              {seg}
            </span>,
          );
        } else if (seg) {
          next.push(seg);
        }
      });
    });
    parts.splice(0, parts.length, ...next);
  });
  return parts;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ----------------------- Sparkline (no recharts dep needed) ----------------------- */
function Sparkline({ values }: { values: number[] }) {
  const w = 80;
  const h = 28;
  const max = Math.max(...values, 4);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = w / Math.max(values.length - 1, 1);
  const points = values
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
    </svg>
  );
}

/* ----------------------- Bottom actions + Flag modal ----------------------- */
function BottomActions({ missed }: { missed: boolean }) {
  const [flagOpen, setFlagOpen] = useState(false);
  const [note, setNote] = useState("");

  if (missed) return null;

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
      >
        <div className="mx-auto max-w-screen-sm px-4 pt-3 pb-2 flex gap-2">
          <GhostButton
            className="flex-1"
            onClick={() => {
              // TODO(backend): generate PDF of summary + transcript and share
            }}
          >
            <Share2 size={18} />
            Share with doctor
          </GhostButton>
          <GhostButton className="flex-1" onClick={() => setFlagOpen(true)}>
            <Flag size={18} />
            Flag this call
          </GhostButton>
        </div>
      </div>

      {flagOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="flag-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 px-4"
          style={{
            animation: "fadeInUp 200ms ease-out",
            paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
            paddingTop: "max(env(safe-area-inset-top), 1rem)",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFlagOpen(false);
          }}
        >
          <div
            className="w-full max-w-screen-sm bg-card rounded-2xl p-5 shadow-warm"
            style={{ animation: "scaleIn 200ms ease-out" }}
          >
            <h2 id="flag-title" className="text-lg font-bold">
              Flag this call
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Add a note for the AI to consider on future calls.
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder="e.g. She seemed more confused than usual — please check in on her memory tomorrow."
              className="mt-3 w-full rounded-md border border-input bg-background p-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="mt-4 flex gap-2">
              <GhostButton className="flex-1" onClick={() => setFlagOpen(false)}>
                Cancel
              </GhostButton>
              <PrimaryButton
                className="flex-1"
                onClick={() => {
                  // TODO(backend): persist flag note
                  setFlagOpen(false);
                  setNote("");
                }}
              >
                Save flag
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}
