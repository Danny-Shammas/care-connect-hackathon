import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Pill,
  Plus,
  MoreVertical,
  AlertTriangle,
  Check,
  X,
  Pencil,
  PauseCircle,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GuardianTabBar } from "@/components/layout/GuardianTabBar";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, GhostButton } from "@/components/layout/Buttons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/medications")({
  component: MedicationsPage,
});

// --- Types ---------------------------------------------------------------

type LastStatus =
  | { kind: "taken"; at: string; label: string }
  | { kind: "missed"; at: string; label: string };

interface Medication {
  id: string;
  name: string;
  dose: string;
  times: string[]; // "HH:MM"
  instructions?: string;
  askOnCalls: boolean;
  paused?: boolean;
  last: LastStatus;
  recentMisses: number; // last 3 days
}

interface DayBar {
  day: string;
  taken: number;
  scheduled: number;
}

const COMMON_TIMES = ["8:00 AM", "12:00 PM", "6:00 PM", "8:00 PM", "10:00 PM"];

// --- Mock data -----------------------------------------------------------

const WEEK: DayBar[] = [
  { day: "Mon", taken: 3, scheduled: 3 },
  { day: "Tue", taken: 3, scheduled: 3 },
  { day: "Wed", taken: 2, scheduled: 3 },
  { day: "Thu", taken: 3, scheduled: 3 },
  { day: "Fri", taken: 1, scheduled: 3 },
  { day: "Sat", taken: 3, scheduled: 3 },
  { day: "Sun", taken: 0, scheduled: 3 },
];

const INITIAL_MEDS: Medication[] = [
  {
    id: "m1",
    name: "Lisinopril 10mg",
    dose: "1 tablet",
    times: ["08:00", "20:00"],
    askOnCalls: true,
    last: { kind: "missed", at: "Yesterday at 8:00 PM", label: "Missed" },
    recentMisses: 2,
  },
  {
    id: "m2",
    name: "Vitamin D 1000 IU",
    dose: "1 capsule",
    times: ["08:00"],
    instructions: "Take with food",
    askOnCalls: true,
    last: { kind: "taken", at: "Today at 8:14 AM", label: "Taken" },
    recentMisses: 0,
  },
  {
    id: "m3",
    name: "Metformin 500mg",
    dose: "1 tablet",
    times: ["08:00", "20:00"],
    instructions: "With breakfast and dinner",
    askOnCalls: true,
    last: { kind: "taken", at: "Today at 8:14 AM", label: "Taken" },
    recentMisses: 0,
  },
];

// --- Helpers -------------------------------------------------------------

function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function barColor(d: DayBar): string {
  if (d.scheduled === 0 || d.taken === 0) return "var(--muted-foreground)";
  if (d.taken >= d.scheduled) return "var(--success)";
  return "var(--warning)";
}

// --- Page ---------------------------------------------------------------

function MedicationsPage() {
  const [meds, setMeds] = useState<Medication[]>(INITIAL_MEDS);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const adherence = useMemo(() => {
    const taken = WEEK.reduce((s, d) => s + d.taken, 0);
    const scheduled = WEEK.reduce((s, d) => s + d.scheduled, 0);
    return scheduled === 0 ? 0 : Math.round((taken / scheduled) * 100);
  }, []);

  const flagged = meds.find((m) => m.recentMisses >= 2 && !m.paused);
  const showBanner = !!flagged && !bannerDismissed;

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (m: Medication) => {
    setEditing(m);
    setModalOpen(true);
  };

  const upsert = (m: Medication) => {
    setMeds((arr) => {
      const exists = arr.some((x) => x.id === m.id);
      return exists ? arr.map((x) => (x.id === m.id ? m : x)) : [...arr, m];
    });
    toast.success(editing ? "Medication updated" : "Medication added");
  };

  const togglePause = (id: string) => {
    setMeds((arr) => arr.map((m) => (m.id === id ? { ...m, paused: !m.paused } : m)));
  };

  const remove = (id: string) => {
    setMeds((arr) => arr.filter((m) => m.id !== id));
    toast("Medication removed");
  };

  return (
    <Screen className="pb-24">
      <header className="flex items-center gap-2 mb-4">
        <BackButton fallback="/guardian/dashboard" />
        <h1 className="text-2xl font-bold">Medications</h1>
      </header>

      {/* Alert banner ------------------------------------------------- */}
      {showBanner && flagged && (
        <div
          className={cn(
            "mb-4 rounded-lg border border-warning/30 bg-warning/10 p-4",
            "flex items-start gap-3",
          )}
          role="alert"
        >
          <AlertTriangle className="text-warning shrink-0 mt-0.5" size={20} />
          <div className="flex-1 min-w-0">
            <p className="text-base">
              Eleanor missed her evening <strong>{flagged.name}</strong> twice this week.
              Want to add a reminder call at 8:30 PM?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton
                type="button"
                onClick={() => {
                  // TODO(backend): create reminder call schedule
                  toast.success("Reminder call added at 8:30 PM");
                  setBannerDismissed(true);
                }}
                className="!min-h-10 !px-4 !text-sm"
              >
                Add reminder
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="text-sm text-muted-foreground hover:text-foreground px-2"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setBannerDismissed(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Adherence card ------------------------------------------- */}
        <Card>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">This week's adherence</p>
              <p className="mt-1 text-5xl font-bold tabular-nums">
                {adherence}
                <span className="text-2xl text-muted-foreground">%</span>
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>
                <span className="text-success font-medium">All taken</span>
              </p>
              <p>
                <span className="text-warning font-medium">Partial</span>
              </p>
              <p>
                <span className="text-muted-foreground font-medium">None</span>
              </p>
            </div>
          </div>

          <div className="mt-4 h-44 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEK} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis hide domain={[0, "dataMax"]} />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(_v, _n, p) => {
                    const d = p.payload as DayBar;
                    return [`${d.taken} of ${d.scheduled} taken`, d.day];
                  }}
                  labelFormatter={() => ""}
                />
                <Bar dataKey="scheduled" fill="var(--muted)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="taken" radius={[6, 6, 0, 0]}>
                  {WEEK.map((d, i) => (
                    <Cell key={i} fill={barColor(d)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Active meds --------------------------------------------- */}
        <section>
          <h2 className="text-lg font-semibold mb-3 px-1">Active medications</h2>
          <ul className="flex flex-col gap-3">
            {meds.map((m) => (
              <li key={m.id}>
                <Card className={cn("!p-4", m.paused && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 shrink-0 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                      <Pill size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[20px] font-semibold leading-tight">
                          {m.name}
                          {m.paused && (
                            <span className="ml-2 align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Paused
                            </span>
                          )}
                        </h3>
                        <MedMenu
                          onEdit={() => openEdit(m)}
                          onPause={() => togglePause(m.id)}
                          paused={!!m.paused}
                          onDelete={() => remove(m.id)}
                        />
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.times.map((t) => (
                          <span
                            key={t}
                            className="rounded-pill bg-muted px-2.5 py-1 text-xs font-medium"
                          >
                            {fmtTime(t)}
                          </span>
                        ))}
                      </div>

                      <p
                        className={cn(
                          "mt-2 text-sm font-medium flex items-center gap-1.5",
                          m.last.kind === "taken" ? "text-success" : "text-warning",
                        )}
                      >
                        {m.last.kind === "taken" ? (
                          <Check size={16} />
                        ) : (
                          <AlertTriangle size={16} />
                        )}
                        {m.last.kind === "taken" ? "Taken " : "Missed "}
                        {m.last.at}
                      </p>

                      {m.instructions && (
                        <p className="mt-1 text-sm text-muted-foreground italic">
                          {m.instructions}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          onClick={openAdd}
          className={cn(
            "w-full rounded-lg border-2 border-dashed border-border p-4",
            "flex items-center justify-center gap-2 text-base font-medium text-muted-foreground",
            "hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors",
          )}
        >
          <Plus size={20} /> Add medication
        </button>

        <p className="text-xs text-muted-foreground text-center px-4 pt-2">
          CareConnect helps you track medication reminders. Always follow your
          doctor's guidance for medical decisions.
        </p>
      </div>

      <MedModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        onSubmit={(m) => {
          upsert(m);
          setModalOpen(false);
        }}
      />
          <GuardianTabBar />
    </Screen>
  );
}

// --- Kebab menu ---------------------------------------------------------

function MedMenu({
  onEdit,
  onPause,
  paused,
  onDelete,
}: {
  onEdit: () => void;
  onPause: () => void;
  paused: boolean;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Medication options"
          className="h-9 w-9 -mr-1 -mt-1 shrink-0 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MoreVertical size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil size={16} className="mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPause}>
          <PauseCircle size={16} className="mr-2" /> {paused ? "Resume" : "Pause"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onDelete}
          className="text-danger focus:text-danger"
        >
          <Trash2 size={16} className="mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Add/Edit modal -----------------------------------------------------

function MedModal({
  open,
  onOpenChange,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Medication | null;
  onSubmit: (m: Medication) => void;
}) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [times, setTimes] = useState<string[]>([]);
  const [customTime, setCustomTime] = useState("");
  const [instructions, setInstructions] = useState("");
  const [askOnCalls, setAskOnCalls] = useState(true);

  // Reset form when modal opens
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDose(editing.dose);
      setTimes(editing.times);
      setInstructions(editing.instructions ?? "");
      setAskOnCalls(editing.askOnCalls);
    } else {
      setName("");
      setDose("");
      setTimes([]);
      setInstructions("");
      setAskOnCalls(true);
    }
    setCustomTime("");
  }, [open, editing]);

  const toggleTime = (t: string) => {
    setTimes((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t].sort()));
  };

  const addCustom = () => {
    if (!customTime) return;
    if (!times.includes(customTime)) setTimes([...times, customTime].sort());
    setCustomTime("");
  };

  const submit = () => {
    if (!name.trim()) return toast.error("Please enter a medication name");
    if (times.length === 0) return toast.error("Add at least one time");
    onSubmit({
      id: editing?.id ?? uid(),
      name: name.trim(),
      dose: dose.trim(),
      times,
      instructions: instructions.trim() || undefined,
      askOnCalls,
      paused: editing?.paused,
      last: editing?.last ?? { kind: "taken", at: "Just added", label: "New" },
      recentMisses: editing?.recentMisses ?? 0,
    });
  };

  // Convert "8:00 AM" labels back to "HH:MM" for the chip toggle
  const labelToHHMM = (label: string) => {
    const m = label.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!m) return label;
    let h = parseInt(m[1], 10) % 12;
    if (m[3].toUpperCase() === "PM") h += 12;
    return `${h.toString().padStart(2, "0")}:${m[2]}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit medication" : "Add medication"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="med-name">Name</Label>
            {/* TODO(backend): autocomplete from common drug DB */}
            <Input
              id="med-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lisinopril 10mg"
              className="mt-1.5 h-11 text-base"
              autoComplete="off"
            />
          </div>

          <div>
            <Label htmlFor="med-dose">Dose</Label>
            <Input
              id="med-dose"
              value={dose}
              onChange={(e) => setDose(e.target.value)}
              placeholder="e.g. 1 tablet"
              className="mt-1.5 h-11 text-base"
            />
          </div>

          <div>
            <Label>Time(s)</Label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {COMMON_TIMES.map((label) => {
                const value = labelToHHMM(label);
                const on = times.includes(value);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleTime(value)}
                    className={cn(
                      "rounded-pill border px-3 py-1.5 text-sm font-medium transition-colors",
                      on
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="time"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              />
              <GhostButton
                type="button"
                onClick={addCustom}
                className="!min-h-10 !px-3 !text-sm"
              >
                Add time
              </GhostButton>
            </div>
            {times.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {times.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 rounded-pill bg-accent/10 text-accent px-2.5 py-1 text-xs font-medium"
                  >
                    {fmtTime(t)}
                    <button
                      type="button"
                      onClick={() => toggleTime(t)}
                      aria-label={`Remove ${fmtTime(t)}`}
                      className="hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="med-instr">Instructions (optional)</Label>
            <Textarea
              id="med-instr"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Take with food"
              className="mt-1.5 min-h-[72px]"
            />
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="flex-1">
              <Label htmlFor="ask-toggle" className="text-base">
                Ask about it on every call?
              </Label>
              <p className="text-sm text-muted-foreground mt-0.5">
                CareConnect will gently confirm this dose during calls.
              </p>
            </div>
            <Switch id="ask-toggle" checked={askOnCalls} onCheckedChange={setAskOnCalls} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <GhostButton type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </GhostButton>
          <PrimaryButton type="button" onClick={submit}>
            {editing ? "Save" : "Add medication"}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
