import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sprout } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { PrimaryButton } from "@/components/layout/Buttons";
import { BackButton } from "@/components/layout/BackButton";
import { StickyBottomBar } from "@/components/layout/StickyBars";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────────
 * TODO(backend): replace with real Lovable Cloud lookup.
 *   - Call an edge function `claim_pairing_code({ code })`.
 *   - The function:
 *       1. SELECT * FROM pairing_codes WHERE code = $1
 *          AND expires_at > now() AND claimed_by_elder_id IS NULL
 *       2. UPDATE … SET claimed_by_elder_id = auth.uid()
 *       3. Return { guardianName: profiles.full_name }
 *   - Throws on not-found / expired / already-claimed → caller shows the
 *     calm inline error message below.
 *
 * Stub accepts "111111" as a quick happy-path; everything else "fails".
 * ─────────────────────────────────────────────────────────────────────── */
async function claimPairingCode(
  code: string,
): Promise<{ guardianName: string }> {
  await new Promise((r) => setTimeout(r, 1100));
  if (code === "111111") return { guardianName: "Sarah" };
  throw new Error("invalid_code");
}

const LEN = 6;

export function ElderPairScreen() {
  const navigate = useNavigate();
  const { setRole, setPaired } = useAuth();
  const [digits, setDigits] = useState<string[]>(() => Array(LEN).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ guardianName: string } | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const complete = code.length === LEN && digits.every((d) => /\d/.test(d));

  // Focus first empty box on mount
  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const setDigitAt = (i: number, value: string) => {
    setError(null);
    // Strip non-digits and handle paste of multiple digits at once
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      // empty (deletion handled in keydown)
      setDigits((prev) => {
        const next = [...prev];
        next[i] = "";
        return next;
      });
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      let cursor = i;
      for (const ch of cleaned) {
        if (cursor >= LEN) break;
        next[cursor] = ch;
        cursor++;
      }
      // Auto-advance focus
      const focusTarget = Math.min(cursor, LEN - 1);
      requestAnimationFrame(() => inputs.current[focusTarget]?.focus());
      return next;
    });
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        // Clear current
        setDigits((prev) => {
          const next = [...prev];
          next[i] = "";
          return next;
        });
      } else if (i > 0) {
        // Move to previous and clear
        const prevIdx = i - 1;
        setDigits((prev) => {
          const next = [...prev];
          next[prevIdx] = "";
          return next;
        });
        requestAnimationFrame(() => inputs.current[prevIdx]?.focus());
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && i < LEN - 1) {
      inputs.current[i + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Enter" && complete) {
      void handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!complete || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await claimPairingCode(code);
      // Mark this device as the elder, paired with a guardian.
      setRole("elder");
      setPaired(true);
      setSuccess(result);
      setTimeout(() => navigate({ to: "/elder" }), 2000);
    } catch {
      setError(
        "That code didn't work. Please check with your family and try again.",
      );
      setSubmitting(false);
      // Clear digits and refocus first box for an easy retry
      setDigits(Array(LEN).fill(""));
      requestAnimationFrame(() => inputs.current[0]?.focus());
    }
  };

  return (
    <Screen ui="elder" hasBottomBar>
      <div className="pt-2"><BackButton fallback="/" label="Back" /></div>

      <div className="pt-4 pb-8">
        <h1 className="text-[32px] leading-[1.2] font-bold tracking-tight">
          Enter the code your family gave you
        </h1>
        <p className="text-[20px] leading-relaxed text-text-secondary mt-4">
          They'll have a 6-digit code on their phone.
        </p>
      </div>

      {/* Digit boxes */}
      <div
        role="group"
        aria-label="6-digit pairing code"
        className="flex justify-between gap-2 sm:gap-3 my-2"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            disabled={submitting || !!success}
            onChange={(e) => setDigitAt(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Digit ${i + 1} of 6`}
            className={cn(
              "flex-1 min-w-0 max-w-[56px] h-[72px]",
              "rounded-md border-2 bg-surface text-center font-semibold",
              "text-[36px] leading-none tabular-nums",
              "caret-accent shadow-soft",
              "transition-[border-color,background-color,transform] duration-150",
              "focus:outline-none focus:border-accent focus:bg-secondary",
              error
                ? "border-danger/60"
                : d
                  ? "border-accent/50"
                  : "border-border",
              "disabled:opacity-60",
            )}
          />
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-5 text-[18px] leading-relaxed text-danger"
        >
          {error}
        </p>
      ) : (
        <p className="mt-6 text-[18px] leading-relaxed text-text-secondary">
          If you don't have a code yet, ask them to open the app.
        </p>
      )}

      <StickyBottomBar>
        <PrimaryButton
          onClick={handleSubmit}
          disabled={!complete || submitting || !!success}
          className="w-full !min-h-16 !text-[22px]"
        >
          {submitting ? (
            <>
              <Spinner /> Connecting…
            </>
          ) : (
            "Connect"
          )}
        </PrimaryButton>
      </StickyBottomBar>

      {/* Success overlay */}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/95 backdrop-blur-sm motion-safe:animate-[fadeInUp_300ms_ease-out]"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="text-center px-8 max-w-md">
            <div className="mx-auto h-28 w-28 rounded-full bg-success/15 text-success flex items-center justify-center motion-safe:animate-[scaleIn_400ms_ease-out]">
              <Sprout size={56} strokeWidth={1.8} />
            </div>
            <h2 className="mt-8 text-[36px] leading-tight font-bold">
              You're all set! 🌿
            </h2>
            <p className="mt-4 text-[22px] leading-relaxed text-text-secondary">
              You're connected with{" "}
              <span className="text-foreground font-semibold">{success.guardianName}</span>.
            </p>
          </div>
        </div>
      )}
    </Screen>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
