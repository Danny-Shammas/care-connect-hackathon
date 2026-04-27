import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Copy, Share2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Screen } from "@/components/layout/Screen";
import { GhostButton, SecondaryButton } from "@/components/layout/Buttons";
import { StickyBottomBar } from "@/components/layout/StickyBars";
import { BackButton } from "@/components/layout/BackButton";
import { Skeleton } from "@/components/layout/Skeleton";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

const CODE_TTL_SECONDS = 10 * 60; // 10 minutes

/* ──────────────────────────────────────────────────────────────────────────
 * TODO(backend): Replace these stubs with Lovable Cloud calls.
 *
 *   generatePairingCode():
 *     - Edge function inserts into `pairing_codes`
 *       { code, guardian_id, expires_at, claimed_by_elder_id (null) }
 *
 *   subscribeToPairingStatus(code, onClaim):
 *     - supabase.channel('pairing:' + code).on('postgres_changes',
 *         { event: 'UPDATE', schema: 'public', table: 'pairing_codes',
 *           filter: `code=eq.${code}` }, …).subscribe()
 *     - Fallback: poll every 3s.
 *     - Fire onClaim({ elderName }) when claimed_by_elder_id becomes non-null.
 * ─────────────────────────────────────────────────────────────────────── */

type PairingCode = { code: string; expiresAt: number };

async function generatePairingCode(): Promise<PairingCode> {
  await new Promise((r) => setTimeout(r, 600));
  const code = String(Math.floor(100000 + Math.random() * 900000));
  return { code, expiresAt: Date.now() + CODE_TTL_SECONDS * 1000 };
}

function subscribeToPairingStatus(
  _code: string,
  _onClaim: (info: { elderName: string }) => void,
): () => void {
  return () => {};
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function GuardianPairScreen() {
  const navigate = useNavigate();
  const { setRole, setPaired } = useAuth();
  const [pairing, setPairing] = useState<PairingCode | null>(null);
  const [generating, setGenerating] = useState(true);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const claimedRef = useRef(false);

  const regenerate = async () => {
    setGenerating(true);
    setPairing(null);
    try {
      const next = await generatePairingCode();
      setPairing(next);
    } catch {
      toast.error("Couldn't generate a code. Try again.");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    void regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!pairing) return;
    claimedRef.current = false;
    const unsub = subscribeToPairingStatus(pairing.code, ({ elderName }) => {
      if (claimedRef.current) return;
      claimedRef.current = true;
      setRole("guardian");
      setPaired(true);
      toast.success(`Connected with ${elderName}!`, {
        description: "Taking you to the dashboard…",
        duration: 1500,
      });
      setTimeout(() => navigate({ to: "/guardian" }), 1500);
    });
    return unsub;
  }, [pairing, navigate, setRole, setPaired]);

  const remainingMs = pairing ? pairing.expiresAt - now : 0;
  const expired = !!pairing && remainingMs <= 0;

  const handleCopy = async () => {
    if (!pairing) return;
    try {
      await navigator.clipboard.writeText(pairing.code);
      setCopied(true);
      toast("Code copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy. Long-press to copy manually.");
    }
  };

  const handleShare = async () => {
    if (!pairing) return;
    const text = `Hi! I'm setting up CareConnect for us. Use this code on your phone: ${pairing.code}`;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "CareConnect pairing code", text });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast("Message copied — paste it into a text or email");
    } catch {
      toast.error("Couldn't share on this device.");
    }
  };

  return (
    <Screen hasBottomBar>
      <div className="pt-2"><BackButton fallback="/" /></div>

      <div className="pt-2 pb-6">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Connect with your family member
        </h1>
        <p className="text-base text-text-secondary mt-3 leading-relaxed">
          Share this code with the person you want to check in on. Open
          CareConnect on their phone, tap{" "}
          <span className="font-medium text-foreground">
            "A family member set this up for me,"
          </span>{" "}
          and enter the code.
        </p>
      </div>

      <div
        className={cn(
          "relative rounded-2xl p-6 text-center shadow-warm",
          "bg-gradient-to-br from-primary/90 to-primary",
          expired && "opacity-70",
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-foreground/80">
          Your pairing code
        </p>

        <div className="mt-4 mb-3 min-h-[72px] flex items-center justify-center">
          {generating || !pairing ? (
            <Skeleton className="h-[60px] w-[280px] !bg-white/30" />
          ) : (
            <div
              className="font-mono font-bold text-primary-foreground tabular-nums select-text selectable"
              style={{ fontSize: 56, letterSpacing: "0.18em", lineHeight: 1 }}
              aria-label={`Pairing code ${pairing.code.split("").join(" ")}`}
            >
              {pairing.code}
            </div>
          )}
        </div>

        <p className="text-sm text-primary-foreground/85 tabular-nums">
          {generating
            ? "Generating…"
            : expired
              ? "Code expired"
              : `Code expires in ${formatCountdown(remainingMs)}`}
        </p>

        {expired && (
          <button
            type="button"
            onClick={regenerate}
            className="mt-4 inline-flex items-center gap-2 rounded-pill bg-white/20 hover:bg-white/30 active:scale-[0.97] transition-all duration-[120ms] px-4 py-2 text-sm font-semibold text-primary-foreground min-h-11"
          >
            <RefreshCw size={16} /> Generate new code
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <GhostButton onClick={handleCopy} disabled={!pairing || expired}>
          <span className="relative inline-flex h-5 w-5 items-center justify-center">
            <Copy
              size={18}
              className={cn(
                "absolute transition-all duration-200",
                copied ? "scale-50 opacity-0" : "scale-100 opacity-100",
              )}
            />
            <Check
              size={18}
              className={cn(
                "absolute text-success transition-all duration-200",
                copied ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
            />
          </span>
          {copied ? "Copied" : "Copy code"}
        </GhostButton>
        <GhostButton onClick={handleShare} disabled={!pairing || expired}>
          <Share2 size={18} /> Share
        </GhostButton>
      </div>

      <section className="mt-8 mb-8 rounded-lg bg-surface p-5 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent mb-4">
          What happens on their phone
        </p>
        <ol className="space-y-4">
          {[
            "Open the CareConnect app",
            "Choose \"A family member set this up\"",
            "Enter this 6-digit code",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="shrink-0 h-8 w-8 rounded-full border-2 border-accent text-accent font-semibold flex items-center justify-center text-sm">
                {i + 1}
              </span>
              <span className="text-sm leading-relaxed pt-1">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <StickyBottomBar>
        <SecondaryButton
          className="w-full"
          onClick={() => {
            // Allow them into the dashboard with a "needs pairing" hint.
            setRole("guardian");
            setPaired(true);
            navigate({ to: "/guardian", search: { needsPairing: 1 } as never });
          }}
        >
          I'll do this later
        </SecondaryButton>
      </StickyBottomBar>
    </Screen>
  );
}
