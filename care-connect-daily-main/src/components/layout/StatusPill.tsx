import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const tones: Record<Tone, { bg: string; text: string; dot: string }> = {
  success: { bg: "bg-success/10", text: "text-success", dot: "bg-success" },
  warning: { bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
  danger: { bg: "bg-danger/10", text: "text-danger", dot: "bg-danger" },
  info: { bg: "bg-accent/10", text: "text-accent", dot: "bg-accent" },
  neutral: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

interface StatusPillProps {
  label: string;
  tone?: Tone;
  className?: string;
}

export function StatusPill({ label, tone = "neutral", className }: StatusPillProps) {
  const t = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-3 py-1 text-sm font-medium",
        t.bg,
        t.text,
        className,
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", t.dot)} aria-hidden />
      {label}
    </span>
  );
}
