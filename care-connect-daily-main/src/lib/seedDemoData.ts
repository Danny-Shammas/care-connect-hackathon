/**
 * Demo seed helper — populates localStorage with a believable Eleanor profile,
 * 14 days of calls, one active alert, and one memory flag.
 *
 * Triggered by tapping the version number 5 times on /guardian/profile
 * (see profile route). Safe to call multiple times — it overwrites.
 *
 * When the real backend lands, swap localStorage writes for Lovable Cloud
 * inserts; the shapes below are the source of truth for the demo UI.
 */

const KEY = "careconnect.demo.v1";

export interface DemoCall {
  id: string;
  date: string; // ISO
  durationSec: number;
  mood: number; // 0-100
  answered: boolean;
  topics: string[];
}

export interface DemoSeed {
  elder: { name: string; phone: string; pairedAt: string; photoInitials: string };
  calls: DemoCall[];
  alerts: Array<{ id: string; kind: string; severity: "info" | "warning" | "danger"; title: string; body: string; createdAt: string; resolved: boolean }>;
  memoryFlags: Array<{ id: string; date: string; note: string; severity: "info" | "warning" }>;
  seededAt: string;
}

const TOPIC_BANK = [
  ["garden", "tomatoes", "weather"],
  ["Sarah", "grandkids"],
  ["hip pain", "doctor"],
  ["neighbor", "bridge club"],
  ["recipe", "soup"],
  ["church", "choir"],
  ["news"],
];

export function buildDemoSeed(): DemoSeed {
  const today = new Date();
  const calls: DemoCall[] = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    const answered = !(i === 9 || i === 10); // missed two days mid-week
    const baseMood = 62 + Math.round(Math.sin(i / 2) * 12);
    return {
      id: `call_${i}`,
      date: d.toISOString(),
      durationSec: answered ? 180 + Math.round(Math.random() * 180) : 0,
      mood: answered ? baseMood : 50,
      answered,
      topics: TOPIC_BANK[i % TOPIC_BANK.length],
    };
  });

  return {
    elder: {
      name: "Eleanor Hayes",
      phone: "+1 (415) 555-0142",
      pairedAt: "2026-04-01T10:00:00.000Z",
      photoInitials: "EH",
    },
    calls,
    alerts: [
      {
        id: "alert_no_answer",
        kind: "no-answer",
        severity: "warning",
        title: "Eleanor hasn't answered in 2 days",
        body: "We tried calling 3 times yesterday and twice today.",
        createdAt: new Date(today.getTime() - 18 * 3600 * 1000).toISOString(),
        resolved: false,
      },
    ],
    memoryFlags: [
      {
        id: "mem_repeat",
        date: new Date(today.getTime() - 3 * 86400 * 1000).toISOString(),
        note: "Mentioned the garden plans 3 times in one call.",
        severity: "info",
      },
    ],
    seededAt: new Date().toISOString(),
  };
}

export function seedDemoData(): DemoSeed {
  const seed = buildDemoSeed();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(seed));
  }
  return seed;
}

export function clearDemoData() {
  if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
}

export function readDemoData(): DemoSeed | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoSeed;
  } catch {
    return null;
  }
}
