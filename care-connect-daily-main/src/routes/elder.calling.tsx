import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Phone, PhoneOff, X, HeartHandshake } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Mode = "outgoing" | "incoming";
type Phase = "ringing" | "connected" | "ended";

export const Route = createFileRoute("/elder/calling")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s.mode === "incoming" ? "incoming" : "outgoing",
  }),
  component: CallingScreen,
});

// TODO(backend): replace with real pairing fetch
const guardian = {
  name: "Sarah Mitchell",
  avatarUrl: "",
};

function CallingScreen() {
  const { mode = "outgoing" } = Route.useSearch();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>(mode === "outgoing" ? "ringing" : "ringing");
  const [seconds, setSeconds] = useState(0);
  const startedRef = useRef<number | null>(null);

  // Outgoing: simulate auto-connect after 2.5s. Incoming waits for user to answer.
  useEffect(() => {
    if (mode !== "outgoing" || phase !== "ringing") return;
    const t = setTimeout(() => setPhase("connected"), 2500);
    return () => clearTimeout(t);
  }, [mode, phase]);

  // Duration counter while connected
  useEffect(() => {
    if (phase !== "connected") return;
    startedRef.current = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - (startedRef.current ?? Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const endCall = () => {
    // TODO(backend): hang up call via Lovable Cloud / telephony provider
    setPhase("ended");
    setTimeout(() => navigate({ to: "/elder/home" }), 250);
  };

  const answer = () => setPhase("connected");

  const isIncoming = mode === "incoming";
  const statusTop = isIncoming
    ? phase === "connected"
      ? "Call in progress"
      : "Incoming call from CareConnect"
    : phase === "connected"
      ? "On the call"
      : "Calling…";

  const displayName = isIncoming ? "Your CareConnect check-in" : guardian.name;
  const subText =
    phase === "connected"
      ? `Connected • ${formatDuration(seconds)}`
      : isIncoming
        ? "Saying hello…"
        : "Connecting…";

  return (
    <div
      data-ui="elder"
      className="fixed inset-0 flex flex-col text-foreground"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.82 0.11 60) 0%, oklch(0.9 0.07 70) 45%, var(--background) 100%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Top status */}
      <div className="pt-6 text-center">
        <p className="text-[18px] font-medium text-foreground/80 tracking-wide">
          {statusTop}
        </p>
      </div>

      {/* Avatar + name */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative">
          {/* Pulse rings while ringing or gently while connected */}
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full bg-primary/40 motion-safe:animate-[callRing_1.8s_ease-out_infinite]",
              phase === "ended" && "hidden",
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-[callRing_1.8s_ease-out_infinite]",
              phase === "ended" && "hidden",
            )}
            style={{ animationDelay: "0.6s" }}
          />
          <Avatar
            className={cn(
              "relative h-[180px] w-[180px] shadow-warm ring-4 ring-white/60",
              phase === "connected" &&
                "motion-safe:animate-[callPulse_2.4s_ease-in-out_infinite]",
            )}
          >
            {isIncoming ? (
              <AvatarFallback className="bg-primary text-primary-foreground">
                <HeartHandshake size={88} strokeWidth={1.6} />
              </AvatarFallback>
            ) : (
              <>
                <AvatarImage src={guardian.avatarUrl} alt={guardian.name} />
                <AvatarFallback className="text-5xl bg-primary/30 text-accent">
                  {guardian.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </>
            )}
          </Avatar>
        </div>

        <h1 className="mt-8 text-[32px] font-bold text-center leading-tight">
          {displayName}
        </h1>
        <p className="mt-3 text-[22px] text-foreground/70 text-center">{subText}</p>
      </div>

      {/* Voice waveform — visible during connected calls */}
      {phase === "connected" && <Waveform />}

      {/* Action buttons */}
      <div
        className="px-6 pb-10 pt-6 flex items-center justify-center"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2.5rem)" }}
      >
        {isIncoming && phase === "ringing" ? (
          <div className="flex items-center justify-between w-full max-w-sm mx-auto">
            <CallBtn
              variant="decline"
              label="Decline"
              onClick={endCall}
              icon={<X size={44} strokeWidth={2.5} />}
            />
            <CallBtn
              variant="answer"
              label="Answer"
              onClick={answer}
              icon={<Phone size={40} strokeWidth={2.4} />}
            />
          </div>
        ) : (
          <CallBtn
            variant="decline"
            label="End call"
            onClick={endCall}
            icon={<PhoneOff size={40} strokeWidth={2.4} />}
          />
        )}
      </div>
    </div>
  );
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

interface CallBtnProps {
  variant: "answer" | "decline";
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}
function CallBtn({ variant, label, icon, onClick }: CallBtnProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "h-24 w-24 rounded-full flex items-center justify-center shadow-warm",
          "transition-transform duration-[80ms] active:scale-[0.94]",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/70",
          variant === "decline"
            ? "bg-danger text-danger-foreground hover:brightness-105"
            : "bg-success text-success-foreground hover:brightness-105",
        )}
      >
        {icon}
      </button>
      <span className="text-[18px] font-medium text-foreground/80">{label}</span>
    </div>
  );
}

/** Subtle audio-level waveform shown while the AI/agent is speaking. */
function Waveform() {
  const bars = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div
      aria-hidden
      className="flex items-end justify-center gap-1.5 h-10 mb-2"
    >
      {bars.map((i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-accent/70 motion-safe:animate-[wave_1.1s_ease-in-out_infinite]"
          style={{
            animationDelay: `${i * 0.09}s`,
            height: "30%",
          }}
        />
      ))}
    </div>
  );
}
