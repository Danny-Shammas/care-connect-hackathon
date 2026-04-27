import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Settings,
  PhoneOff,
  WifiOff,
  Plane,
  Pill,
  CloudRain,
  Brain,
  AlertOctagon,
  Phone,
  Check,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, GhostButton } from "@/components/layout/Buttons";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/alerts")({
  component: AlertsPage,
});

// --- Types ---------------------------------------------------------------

type Severity = "danger" | "warning" | "info";

type AlertKind =
  | "emergency"
  | "no-answer"
  | "network-silence"
  | "roaming"
  | "med-missed"
  | "mood-drop"
  | "memory-flag";

interface AttemptLog {
  at: string;
  outcome: "no-answer" | "voicemail" | "declined" | "completed";
}

interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  triggeredAt: string;
  resolved: boolean;
  attempts?: AttemptLog[];
}

// --- Mock data -----------------------------------------------------------

const INITIAL_ALERTS: AlertItem[] = [
  {
    id: "a-em-1",
    kind: "emergency",
    title: "Possible distress mentioned during call",
    body: "Eleanor said \"I fell\" at 3:42 PM today. The AI ended the check-in early and flagged this for you.",
    triggeredAt: "Today at 3:42 PM",
    resolved: false,
    attempts: [{ at: "Today 3:40 PM", outcome: "completed" }],
  },
  {
    id: "a-na-1",
    kind: "no-answer",
    title: "Eleanor hasn't answered in 2 days",
    body: "We tried calling 3 times yesterday and twice today.",
    triggeredAt: "Yesterday 9:35 AM",
    resolved: false,
    attempts: [
      { at: "Yesterday 9:00 AM", outcome: "no-answer" },
      { at: "Yesterday 1:00 PM", outcome: "no-answer" },
      { at: "Yesterday 6:00 PM", outcome: "voicemail" },
      { at: "Today 9:00 AM", outcome: "no-answer" },
      { at: "Today 1:00 PM", outcome: "no-answer" },
    ],
  },
  {
    id: "a-net-1",
    kind: "network-silence",
    title: "Eleanor's phone hasn't been online in 4 hours",
    body: "Could be a dead battery or weak signal. We'll keep trying.",
    triggeredAt: "Today 11:20 AM",
    resolved: false,
  },
  {
    id: "a-med-1",
    kind: "med-missed",
    title: "Lisinopril missed twice this week",
    body: "Eleanor's evening dose was missed Wednesday and Friday.",
    triggeredAt: "Friday 9:00 PM",
    resolved: false,
  },
  {
    id: "a-mood-1",
    kind: "mood-drop",
    title: "Mood has dipped over the last 3 days",
    body: "Eleanor sounded quieter than usual on her last three calls. Often passes on its own.",
    triggeredAt: "Today 9:18 AM",
    resolved: false,
  },
  {
    id: "a-mem-1",
    kind: "memory-flag",
    title: "A small memory pattern to watch",
    body: "Eleanor's answers about her morning routine have drifted slightly. Nothing urgent — just an observation.",
    triggeredAt: "Yesterday 9:14 AM",
    resolved: false,
  },
  {
    id: "a-roam-1",
    kind: "roaming",
    title: "Phone is roaming — calls paused",
    body: "We detected international roaming and paused calls to avoid fees. Resume when she's home.",
    triggeredAt: "Apr 18, 7:02 AM",
    resolved: true,
  },
  {
    id: "a-na-old",
    kind: "no-answer",
    title: "Missed morning check-in",
    body: "She picked up later that afternoon and was fine.",
    triggeredAt: "Apr 16, 9:30 AM",
    resolved: true,
  },
];

// --- Visuals -------------------------------------------------------------

const KIND_META: Record<
  AlertKind,
  { icon: React.ReactNode; severity: Severity; sortRank: number }
> = {
  emergency: { icon: <AlertOctagon size={18} />, severity: "danger", sortRank: 0 },
  "no-answer": { icon: <PhoneOff size={18} />, severity: "warning", sortRank: 1 },
  "med-missed": { icon: <Pill size={18} />, severity: "warning", sortRank: 2 },
  "mood-drop": { icon: <CloudRain size={18} />, severity: "warning", sortRank: 3 },
  "network-silence": { icon: <WifiOff size={18} />, severity: "info", sortRank: 4 },
  roaming: { icon: <Plane size={18} />, severity: "info", sortRank: 5 },
  "memory-flag": { icon: <Brain size={18} />, severity: "info", sortRank: 6 },
};

function severityStyles(s: Severity) {
  switch (s) {
    case "danger":
      return {
        bar: "bg-danger",
        ring: "ring-danger/20",
        iconBg: "bg-danger/10 text-danger",
        glow: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--danger)_25%,transparent)]",
      };
    case "warning":
      return {
        bar: "bg-warning",
        ring: "ring-warning/15",
        iconBg: "bg-warning/10 text-warning",
        glow: "",
      };
    case "info":
      return {
        bar: "bg-accent",
        ring: "ring-accent/15",
        iconBg: "bg-accent/10 text-accent",
        glow: "",
      };
  }
}

// --- Page ---------------------------------------------------------------

function AlertsPage() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS);
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const [open, setOpen] = useState<AlertItem | null>(null);

  const visible = useMemo(() => {
    const filtered = alerts.filter((a) => a.resolved === (tab === "resolved"));
    return [...filtered].sort(
      (a, b) => KIND_META[a.kind].sortRank - KIND_META[b.kind].sortRank,
    );
  }, [alerts, tab]);

  const activeCount = alerts.filter((a) => !a.resolved).length;
  const resolvedCount = alerts.length - activeCount;

  const resolve = (id: string) => {
    setAlerts((arr) => arr.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    toast.success("Alert marked as resolved");
  };

  const callNow = (a: AlertItem) => {
    // TODO(backend): trigger an in-app call to Eleanor
    toast.success(`Calling Eleanor…`);
  };

  return (
    <Screen className="pb-24">
      <header className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback="/guardian/dashboard" />
          <h1 className="text-2xl font-bold truncate">Alerts</h1>
        </div>
        <Link
          to="/guardian/notifications"
          aria-label="Notification settings"
          className="h-11 w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings size={20} />
        </Link>
      </header>

      {/* Tabs */}
      <div className="mb-5 inline-flex w-full rounded-pill bg-muted p-1">
        {(
          [
            ["active", "Active", activeCount],
            ["resolved", "Resolved", resolvedCount],
          ] as const
        ).map(([id, label, count]) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={on}
              className={cn(
                "flex-1 h-10 rounded-pill text-sm font-semibold transition-colors",
                "flex items-center justify-center gap-2",
                on
                  ? "bg-background text-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              <span
                className={cn(
                  "rounded-pill px-2 py-0.5 text-[11px] font-bold tabular-nums",
                  on ? "bg-muted text-foreground" : "bg-background/60 text-muted-foreground",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((a) => (
            <li key={a.id}>
              <AlertCard
                alert={a}
                onOpen={() => setOpen(a)}
                onCall={() => callNow(a)}
                onResolve={() => resolve(a.id)}
              />
            </li>
          ))}
        </ul>
      )}

      <DetailSheet
        alert={open}
        onOpenChange={(v) => !v && setOpen(null)}
        onCall={() => open && callNow(open)}
        onResolve={() => {
          if (open) resolve(open.id);
          setOpen(null);
        }}
      />
          <GuardianTabBar />
    </Screen>
  );
}

// --- Alert card ---------------------------------------------------------

function AlertCard({
  alert,
  onOpen,
  onCall,
  onResolve,
}: {
  alert: AlertItem;
  onOpen: () => void;
  onCall: () => void;
  onResolve: () => void;
}) {
  const meta = KIND_META[alert.kind];
  const s = severityStyles(meta.severity);
  const isEmergency = alert.kind === "emergency";

  return (
    <Card
      className={cn(
        "!p-0 overflow-hidden relative",
        isEmergency && s.glow,
      )}
    >
      <div className="flex">
        {/* Severity bar */}
        <div className={cn("w-1 shrink-0", s.bar)} aria-hidden />

        <div className="flex-1 min-w-0">
          {/* Tappable body */}
          <button
            type="button"
            onClick={onOpen}
            className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "h-10 w-10 shrink-0 rounded-full flex items-center justify-center",
                  s.iconBg,
                )}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className={cn(
                      "text-[17px] font-semibold leading-snug",
                      isEmergency && "text-danger",
                    )}
                  >
                    {alert.title}
                  </h3>
                  <ChevronRight
                    size={18}
                    className="text-muted-foreground shrink-0 mt-1"
                    aria-hidden
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  Triggered {alert.triggeredAt}
                </p>
                <p className="mt-2 text-sm text-foreground/85 leading-relaxed">
                  {alert.body}
                </p>
              </div>
            </div>
          </button>

          {/* Actions */}
          {!alert.resolved && (
            <div className="px-4 pb-4 flex flex-col sm:flex-row gap-2">
              <PrimaryButton
                type="button"
                onClick={onCall}
                className="flex-1 !min-h-11 !text-sm"
              >
                <Phone size={16} /> Call her now
              </PrimaryButton>
              <GhostButton
                type="button"
                onClick={onResolve}
                className="flex-1 !min-h-11 !text-sm"
              >
                <Check size={16} /> Mark as resolved
              </GhostButton>
            </div>
          )}

          {alert.resolved && (
            <div className="px-4 pb-3 -mt-1 flex items-center gap-1.5 text-xs text-success font-medium">
              <Check size={14} /> Resolved
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// --- Detail sheet ------------------------------------------------------

function DetailSheet({
  alert,
  onOpenChange,
  onCall,
  onResolve,
}: {
  alert: AlertItem | null;
  onOpenChange: (v: boolean) => void;
  onCall: () => void;
  onResolve: () => void;
}) {
  const open = !!alert;
  const meta = alert ? KIND_META[alert.kind] : null;
  const s = meta ? severityStyles(meta.severity) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        {alert && meta && s && (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "h-11 w-11 shrink-0 rounded-full flex items-center justify-center",
                    s.iconBg,
                  )}
                >
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-lg leading-snug">
                    {alert.title}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    Triggered {alert.triggeredAt}
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="mt-4">
              <p className="text-sm leading-relaxed text-foreground/85">{alert.body}</p>
            </div>

            {alert.attempts && alert.attempts.length > 0 && (
              <div className="mt-5">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Call attempts
                </h4>
                <ul className="mt-2 rounded-lg border border-border divide-y divide-border">
                  {alert.attempts.map((a, i) => (
                    <li key={i} className="flex items-center justify-between p-3 text-sm">
                      <span className="tabular-nums text-foreground">{a.at}</span>
                      <span
                        className={cn(
                          "rounded-pill px-2 py-0.5 text-xs font-medium",
                          a.outcome === "completed" && "bg-success/10 text-success",
                          a.outcome === "no-answer" && "bg-warning/10 text-warning",
                          a.outcome === "voicemail" && "bg-muted text-muted-foreground",
                          a.outcome === "declined" && "bg-danger/10 text-danger",
                        )}
                      >
                        {a.outcome.replace("-", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!alert.resolved && (
              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <PrimaryButton type="button" onClick={onCall} className="flex-1">
                  <Phone size={18} /> Call her now
                </PrimaryButton>
                <GhostButton type="button" onClick={onResolve} className="flex-1">
                  <Check size={18} /> Mark as resolved
                </GhostButton>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// --- Empty state -------------------------------------------------------

function EmptyState({ tab }: { tab: "active" | "resolved" }) {
  return (
    <Card className="!py-10 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-success/10 text-success flex items-center justify-center">
        <Sparkles size={26} />
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {tab === "active" ? "All clear" : "No resolved alerts yet"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
        {tab === "active"
          ? "We'll let you know if anything needs your attention."
          : "Resolved alerts will appear here for your records."}
      </p>
    </Card>
  );
}
