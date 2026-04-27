import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  PhoneOff,
  WifiOff,
  Plane,
  Pill,
  CloudRain,
  Brain,
  AlertOctagon,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, GhostButton } from "@/components/layout/Buttons";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/notifications")({
  component: NotificationsPage,
});

// --- Types ---------------------------------------------------------------

type AlertKind =
  | "emergency"
  | "no-answer"
  | "network-silence"
  | "roaming"
  | "med-missed"
  | "mood-drop"
  | "memory-flag";

interface Settings {
  noAnswerDays: number; // 1..7
  lastSeenHours: number; // 1..12
  enabled: Record<AlertKind, boolean>;
}

const DEFAULTS: Settings = {
  noAnswerDays: 3,
  lastSeenHours: 4,
  enabled: {
    emergency: true,
    "no-answer": true,
    "network-silence": true,
    roaming: true,
    "med-missed": true,
    "mood-drop": true,
    "memory-flag": true,
  },
};

const KINDS: {
  id: AlertKind;
  title: string;
  desc: string;
  icon: React.ReactNode;
  locked?: boolean;
}[] = [
  {
    id: "emergency",
    title: "Emergency keywords",
    desc: "Always on. We'll alert you immediately if Eleanor mentions distress.",
    icon: <AlertOctagon size={18} />,
    locked: true,
  },
  {
    id: "no-answer",
    title: "Missed check-ins",
    desc: "When Eleanor doesn't answer for the time set above.",
    icon: <PhoneOff size={18} />,
  },
  {
    id: "network-silence",
    title: "Phone offline",
    desc: "When Eleanor's phone hasn't been online for a while.",
    icon: <WifiOff size={18} />,
  },
  {
    id: "roaming",
    title: "Roaming detected",
    desc: "When Eleanor's phone is roaming. We pause calls automatically.",
    icon: <Plane size={18} />,
  },
  {
    id: "med-missed",
    title: "Medication missed",
    desc: "When the same dose is missed multiple times in a few days.",
    icon: <Pill size={18} />,
  },
  {
    id: "mood-drop",
    title: "Mood dip",
    desc: "When Eleanor sounds noticeably quieter or lower for several days.",
    icon: <CloudRain size={18} />,
  },
  {
    id: "memory-flag",
    title: "Memory observations",
    desc: "Gentle observations about consistency. Never marked urgent.",
    icon: <Brain size={18} />,
  },
];

// --- Page ---------------------------------------------------------------

function NotificationsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const savedRef = useRef<Settings>(DEFAULTS);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedRef.current),
    [settings],
  );

  const onSave = () => {
    // TODO(backend): persist notification preferences
    savedRef.current = settings;
    toast.success("Preferences saved");
  };

  const onDiscard = () => {
    setSettings(savedRef.current);
    toast("Changes discarded");
  };

  return (
    <Screen className="pb-32">
      <header className="flex items-center gap-2 mb-4">
        <BackButton fallback="/guardian/alerts" />
        <h1 className="text-2xl font-bold">Notifications</h1>
      </header>

      <div className="flex flex-col gap-5">
        {/* Thresholds */}
        <Card>
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-accent" />
            <h2 className="text-lg font-semibold">When should we alert you?</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Set the patience thresholds before we ping you.
          </p>

          <div className="mt-5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="no-answer" className="text-base font-medium">
                Alert me if no answer for
              </label>
              <span className="text-base font-semibold tabular-nums">
                {settings.noAnswerDays} {settings.noAnswerDays === 1 ? "day" : "days"}
              </span>
            </div>
            <Slider
              id="no-answer"
              min={1}
              max={7}
              step={1}
              value={[settings.noAnswerDays]}
              onValueChange={([v]) =>
                setSettings((s) => ({ ...s, noAnswerDays: v }))
              }
              className="mt-3"
            />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>1 day</span>
              <span>7 days</span>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-baseline justify-between">
              <label htmlFor="last-seen" className="text-base font-medium">
                Alert me if last seen exceeds
              </label>
              <span className="text-base font-semibold tabular-nums">
                {settings.lastSeenHours} {settings.lastSeenHours === 1 ? "hour" : "hours"}
              </span>
            </div>
            <Slider
              id="last-seen"
              min={1}
              max={12}
              step={1}
              value={[settings.lastSeenHours]}
              onValueChange={([v]) =>
                setSettings((s) => ({ ...s, lastSeenHours: v }))
              }
              className="mt-3"
            />
            <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>1 hour</span>
              <span>12 hours</span>
            </div>
          </div>
        </Card>

        {/* Per-type toggles */}
        <Card>
          <h2 className="text-lg font-semibold">Alert types</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which kinds of alerts you want to receive.
          </p>

          <ul className="mt-4 divide-y divide-border">
            {KINDS.map((k) => {
              const on = settings.enabled[k.id];
              return (
                <li key={k.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div
                    className={cn(
                      "h-10 w-10 shrink-0 rounded-full flex items-center justify-center",
                      "bg-muted text-muted-foreground",
                    )}
                  >
                    {k.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-medium">{k.title}</p>
                      {k.locked && (
                        <span className="rounded-pill bg-danger/10 text-danger px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                          Always on
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{k.desc}</p>
                  </div>
                  <Switch
                    checked={on}
                    disabled={k.locked}
                    onCheckedChange={(v) =>
                      setSettings((s) => ({
                        ...s,
                        enabled: { ...s.enabled, [k.id]: v },
                      }))
                    }
                    aria-label={`Toggle ${k.title}`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur",
            "px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]",
            "shadow-[0_-4px_12px_rgba(0,0,0,0.06)]",
            "animate-in slide-in-from-bottom-4 duration-200",
          )}
        >
          <div className="mx-auto max-w-2xl flex items-center gap-2">
            <GhostButton type="button" onClick={onDiscard} className="flex-1">
              Discard
            </GhostButton>
            <PrimaryButton type="button" onClick={onSave} className="flex-[2]">
              Save preferences
            </PrimaryButton>
          </div>
        </div>
      )}
    </Screen>
  );
}
