import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pencil,
  Trash2,
  GripVertical,
  Plus,
  Play,
  Check,
  Clock,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { BackButton } from "@/components/layout/BackButton";
import { Card } from "@/components/layout/Card";
import { PrimaryButton, SecondaryButton, GhostButton } from "@/components/layout/Buttons";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/guardian/personalize")({
  component: PersonalizePage,
});

// --- Types ---------------------------------------------------------------

type Frequency = "daily" | "alternate" | "weekdays" | "custom";
type Tone = "warm" | "playful" | "brief";
type Category = "Pet" | "Hobby" | "Health" | "Family";
type Cadence = "Every call" | "Weekly" | "Random";

interface Question {
  id: string;
  text: string;
  category: Category;
  cadence: Cadence;
}

interface Voice {
  id: string;
  name: string;
  description: string;
}

interface Settings {
  time: string; // "HH:MM"
  frequency: Frequency;
  customDays: number[]; // 0=Sun..6=Sat
  tone: Tone;
  voiceId: string;
  questions: Question[];
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const TONES: { id: Tone; title: string; desc: string; emoji: string }[] = [
  { id: "warm", title: "Warm & gentle", desc: "Soothing, patient pace", emoji: "🤍" },
  { id: "playful", title: "Playful & chatty", desc: "Light, curious, upbeat", emoji: "✨" },
  { id: "brief", title: "Brief & to the point", desc: "Short and respectful", emoji: "🎯" },
];

const VOICES: Voice[] = [
  { id: "chirp3-aoede", name: "Aoede", description: "Warm female, mid-range" },
  { id: "chirp3-charon", name: "Charon", description: "Calm male, low-mid" },
  { id: "chirp3-kore", name: "Kore", description: "Bright female, expressive" },
  { id: "chirp3-puck", name: "Puck", description: "Friendly male, conversational" },
  { id: "chirp3-fenrir", name: "Fenrir", description: "Steady male, reassuring" },
];

const SUGGESTIONS: { text: string; category: Category }[] = [
  { text: "How is Max today?", category: "Pet" },
  { text: "Did you water the tomatoes?", category: "Hobby" },
  { text: "Have you heard from your sister Marie?", category: "Family" },
];

const CATEGORY_TONE: Record<Category, string> = {
  Pet: "bg-accent/10 text-accent",
  Hobby: "bg-success/10 text-success",
  Health: "bg-warning/10 text-warning",
  Family: "bg-primary/10 text-primary",
};

const DEFAULT_SETTINGS: Settings = {
  time: "09:00",
  frequency: "daily",
  customDays: [1, 2, 3, 4, 5],
  tone: "warm",
  voiceId: "chirp3-aoede",
  questions: [
    { id: "q1", text: "How is Max today?", category: "Pet", cadence: "Every call" },
    { id: "q2", text: "Did you water the tomatoes?", category: "Hobby", cadence: "Weekly" },
  ],
};

// --- Helpers -------------------------------------------------------------

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${period}`;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// --- Page ---------------------------------------------------------------

function PersonalizePage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const savedRef = useRef<Settings>(DEFAULT_SETTINGS);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedRef.current),
    [settings],
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [prefill, setPrefill] = useState<string>("");

  const onSave = () => {
    // TODO(backend): persist to Lovable Cloud
    savedRef.current = settings;
    toast.success("Personalization saved");
  };

  const onDiscard = () => {
    setSettings(savedRef.current);
    toast("Changes discarded");
  };

  const openAdd = (text = "") => {
    setEditing(null);
    setPrefill(text);
    setModalOpen(true);
  };

  const openEdit = (q: Question) => {
    setEditing(q);
    setPrefill("");
    setModalOpen(true);
  };

  const upsertQuestion = (q: Question) => {
    setSettings((s) => {
      const exists = s.questions.some((x) => x.id === q.id);
      return {
        ...s,
        questions: exists
          ? s.questions.map((x) => (x.id === q.id ? q : x))
          : [...s.questions, q],
      };
    });
  };

  const deleteQuestion = (id: string) => {
    setSettings((s) => ({ ...s, questions: s.questions.filter((q) => q.id !== id) }));
  };

  const moveQuestion = (id: string, dir: -1 | 1) => {
    setSettings((s) => {
      const idx = s.questions.findIndex((q) => q.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= s.questions.length) return s;
      const arr = [...s.questions];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return { ...s, questions: arr };
    });
  };

  return (
    <Screen className="pb-32">
      {/* Top bar */}
      <header className="flex items-center gap-2 mb-4">
        <BackButton fallback="/guardian/dashboard" />
        <h1 className="text-2xl font-bold">Personalize</h1>
      </header>

      <div className="flex flex-col gap-5">
        {/* 1) Schedule ------------------------------------------------- */}
        <Card>
          <SectionHeading
            icon={<Clock size={18} />}
            title="When should we call?"
            subtitle="Pick a time and how often"
          />

          <div className="mt-4">
            <label className="text-sm text-muted-foreground" htmlFor="call-time">
              Call time
            </label>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="call-time"
                type="time"
                value={settings.time}
                onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                className={cn(
                  "h-14 rounded-md border border-input bg-background px-4 text-2xl font-semibold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              />
              <span className="text-lg text-muted-foreground">
                Every day at <strong className="text-foreground">{formatTime(settings.time)}</strong>
              </span>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm text-muted-foreground mb-2">Frequency</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  ["daily", "Daily"],
                  ["alternate", "Every other day"],
                  ["weekdays", "Weekdays"],
                  ["custom", "Custom"],
                ] as [Frequency, string][]
              ).map(([id, label]) => {
                const active = settings.frequency === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSettings({ ...settings, frequency: id })}
                    className={cn(
                      "h-12 rounded-md text-sm font-medium border transition-colors",
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {settings.frequency === "custom" && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">Days of the week</p>
              <div className="flex gap-2">
                {DAYS.map((d, i) => {
                  const on = settings.customDays.includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={FULL_DAYS[i]}
                      aria-pressed={on}
                      onClick={() =>
                        setSettings((s) => ({
                          ...s,
                          customDays: on
                            ? s.customDays.filter((x) => x !== i)
                            : [...s.customDays, i].sort(),
                        }))
                      }
                      className={cn(
                        "h-11 w-11 rounded-full text-sm font-semibold border transition-colors",
                        on
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background text-foreground border-border hover:bg-muted",
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* 2) Tone ----------------------------------------------------- */}
        <Card>
          <SectionHeading
            title="What kind of conversation?"
            subtitle="Set the mood of every call"
          />

          <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto pb-2 px-1 snap-x snap-mandatory">
            {TONES.map((t) => {
              const active = settings.tone === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSettings({ ...settings, tone: t.id })}
                  className={cn(
                    "snap-start shrink-0 w-56 text-left rounded-lg border p-4 transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-warm"
                      : "border-border bg-background hover:bg-muted",
                  )}
                  aria-pressed={active}
                >
                  <div className="text-3xl mb-2">{t.emoji}</div>
                  <div className="font-semibold text-base">{t.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t.desc}</div>
                  {active && (
                    <div className="mt-3 inline-flex items-center gap-1 text-xs text-primary font-medium">
                      <Check size={14} /> Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <SecondaryButton
              type="button"
              onClick={() => {
                // TODO(tts): wire preview to selected voice + tone
                toast("Playing preview…");
              }}
            >
              <Play size={18} /> Preview voice (5s)
            </SecondaryButton>
          </div>
        </Card>

        {/* 3) Personal questions -------------------------------------- */}
        <Card>
          <SectionHeading
            title="Personal questions"
            subtitle="The AI will weave these into calls"
          />

          {settings.questions.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-center">
              <p className="text-base">
                Add 2–3 personal questions to make the calls feel like home.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => openAdd(s.text)}
                    className="rounded-pill bg-muted px-3 py-2 text-sm hover:bg-accent/20"
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {settings.questions.map((q, i) => (
                <li
                  key={q.id}
                  className="flex items-start gap-2 rounded-lg border border-border bg-background p-3"
                >
                  <div className="flex flex-col -gap-1 pt-1">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={i === 0}
                      onClick={() => moveQuestion(q.id, -1)}
                      className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <GripVertical size={16} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[18px] leading-snug">{q.text}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className={cn(
                          "rounded-pill px-2 py-0.5 text-xs font-medium",
                          CATEGORY_TONE[q.category],
                        )}
                      >
                        {q.category}
                      </span>
                      <span className="rounded-pill px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
                        {q.cadence}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      aria-label="Edit"
                      onClick={() => openEdit(q)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={() => deleteQuestion(q.id)}
                      className="h-9 w-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => openAdd()}
            className={cn(
              "mt-3 w-full rounded-lg border-2 border-dashed border-border p-4",
              "flex items-center justify-center gap-2 text-base font-medium text-muted-foreground",
              "hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors",
            )}
          >
            <Plus size={20} /> Add a question
          </button>
        </Card>

        {/* 4) Voice --------------------------------------------------- */}
        <Card>
          <SectionHeading
            icon={<Volume2 size={18} />}
            title="Voice"
            subtitle="Choose how CareConnect sounds"
          />
          <ul className="mt-4 flex flex-col gap-2">
            {VOICES.map((v) => {
              const active = settings.voiceId === v.id;
              return (
                <li
                  key={v.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border bg-background",
                  )}
                >
                  <button
                    type="button"
                    aria-label={`Preview ${v.name}`}
                    onClick={() => {
                      // TODO(tts): preview this voice
                      toast(`Previewing ${v.name}…`);
                    }}
                    className="h-11 w-11 rounded-full bg-accent/10 text-accent flex items-center justify-center hover:bg-accent/20"
                  >
                    <Play size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, voiceId: v.id })}
                    className="flex-1 text-left"
                  >
                    <div className="font-semibold text-base">{v.name}</div>
                    <div className="text-sm text-muted-foreground">{v.description}</div>
                  </button>
                  {active && (
                    <span className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check size={16} />
                    </span>
                  )}
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
              Save changes
            </PrimaryButton>
          </div>
        </div>
      )}

      <QuestionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editing={editing}
        prefill={prefill}
        onSubmit={(q) => {
          upsertQuestion(q);
          setModalOpen(false);
        }}
      />
    </Screen>
  );
}

// --- Section heading -----------------------------------------------------

function SectionHeading({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        {icon && <span className="text-accent">{icon}</span>}
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

// --- Add/Edit question modal --------------------------------------------

function QuestionModal({
  open,
  onOpenChange,
  editing,
  prefill,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Question | null;
  prefill: string;
  onSubmit: (q: Question) => void;
}) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState<Category>("Family");
  const [cadence, setCadence] = useState<Cadence>("Every call");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setText(editing.text);
      setCategory(editing.category);
      setCadence(editing.cadence);
    } else {
      setText(prefill ?? "");
      setCategory("Family");
      setCadence("Every call");
    }
  }, [open, editing, prefill]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Please enter a question");
      return;
    }
    onSubmit({
      id: editing?.id ?? uid(),
      text: trimmed,
      category,
      cadence,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit question" : "Add a question"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="q-text">What would you like us to ask?</Label>
            <Input
              id="q-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. How is Max today?"
              className="mt-1.5 h-11 text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Pet", "Hobby", "Health", "Family"] as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                <SelectTrigger className="mt-1.5 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Every call", "Weekly", "Random"] as Cadence[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!editing && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Suggested examples</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.text}
                    type="button"
                    onClick={() => {
                      setText(s.text);
                      setCategory(s.category);
                    }}
                    className="rounded-pill bg-muted px-3 py-1.5 text-sm hover:bg-accent/20"
                  >
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <GhostButton type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </GhostButton>
          <PrimaryButton type="button" onClick={submit}>
            {editing ? "Save question" : "Add question"}
          </PrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
