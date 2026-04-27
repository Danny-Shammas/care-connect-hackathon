import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import { Screen } from "@/components/layout/Screen";
import { PrimaryButton } from "@/components/layout/Buttons";
import { BackButton } from "@/components/layout/BackButton";
import { StickyBottomBar } from "@/components/layout/StickyBars";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";

const ROLE_KEY = "careconnect:preferred-role";
type Role = "guardian" | "elder";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => {
    const r = search.role;
    return { role: (r === "guardian" || r === "elder" ? r : undefined) as Role | undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in · CareConnect" },
      { name: "description", content: "Sign in to CareConnect with your phone number." },
    ],
  }),
  component: AuthPage,
});

/* ──────────────────────────────────────────────────────────────────────────
 * Country codes — short, curated list. Add more as needed.
 * ─────────────────────────────────────────────────────────────────────── */
type Country = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
  /** Visual format mask: 'X' = digit, ' ' / '-' / '(' / ')' literal. */
  mask: string;
  /** Locales that should default to this country. */
  locales?: string[];
};

const COUNTRIES: Country[] = [
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸", mask: "(XXX) XXX-XXXX", locales: ["en-US"] },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", mask: "(XXX) XXX-XXXX", locales: ["en-CA", "fr-CA"] },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧", mask: "XXXX XXXXXX", locales: ["en-GB"] },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺", mask: "XXX XXX XXX", locales: ["en-AU"] },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪", mask: "XXX XXXXXXXX", locales: ["de-DE", "de"] },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷", mask: "X XX XX XX XX", locales: ["fr-FR", "fr"] },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸", mask: "XXX XXX XXX", locales: ["es-ES", "es"] },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹", mask: "XXX XXX XXXX", locales: ["it-IT", "it"] },
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱", mask: "X XXXX XXXX", locales: ["nl-NL", "nl"] },
  { iso: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪", mask: "XX XXX XX XX", locales: ["sv-SE", "sv"] },
  { iso: "NO", name: "Norway", dial: "+47", flag: "🇳🇴", mask: "XXX XX XXX", locales: ["nb-NO", "no"] },
  { iso: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰", mask: "XX XX XX XX", locales: ["da-DK", "da"] },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷", mask: "(XX) XXXXX-XXXX", locales: ["pt-BR"] },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽", mask: "XX XXXX XXXX", locales: ["es-MX"] },
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳", mask: "XXXXX XXXXX", locales: ["en-IN", "hi-IN"] },
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵", mask: "XX XXXX XXXX", locales: ["ja-JP", "ja"] },
];

const DEFAULT_COUNTRY = COUNTRIES[0];

function detectCountry(): Country {
  if (typeof navigator === "undefined") return DEFAULT_COUNTRY;
  const locale = navigator.language ?? "";
  const exact = COUNTRIES.find((c) => c.locales?.includes(locale));
  if (exact) return exact;
  const region = locale.split("-")[1]?.toUpperCase();
  if (region) {
    const byRegion = COUNTRIES.find((c) => c.iso === region);
    if (byRegion) return byRegion;
  }
  return DEFAULT_COUNTRY;
}

/** Strip non-digits and apply the country's mask. */
function formatPhone(digits: string, mask: string): string {
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (i >= digits.length) break;
    if (ch === "X") {
      out += digits[i];
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

function maskMaxDigits(mask: string): number {
  return (mask.match(/X/g) ?? []).length;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Firebase Auth — TODO(backend) wire up.
 *
 *   import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult }
 *     from "firebase/auth";
 *
 *   const auth = getAuth();
 *   const verifier = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
 *   const confirmation: ConfirmationResult =
 *     await signInWithPhoneNumber(auth, e164, verifier);
 *   // ...
 *   await confirmation.confirm(otp); // -> UserCredential
 *
 * For now we stub send + verify with a small delay so the UI flows cleanly.
 * Demo: any 6-digit code works EXCEPT "000000" (which simulates a wrong code).
 * ─────────────────────────────────────────────────────────────────────── */
type SendResult = { verificationId: string };

async function sendVerificationCode(_e164: string): Promise<SendResult> {
  await new Promise((r) => setTimeout(r, 900));
  // Simulate a transient failure for numbers ending in "0000"
  if (_e164.endsWith("0000")) throw new Error("send_failed");
  return { verificationId: `stub-${Date.now()}` };
}

async function confirmVerificationCode(_id: string, code: string): Promise<{ uid: string }> {
  await new Promise((r) => setTimeout(r, 700));
  if (code === "000000") throw new Error("invalid_code");
  return { uid: `stub-user-${Date.now()}` };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Component
 * ─────────────────────────────────────────────────────────────────────── */
type Step = "phone" | "otp";
const OTP_LEN = 6;
const RESEND_SECONDS = 30;

function AuthPage() {
  const { setRole, isPaired } = useAuth();
  const navigate = useNavigate();
  const { role: queryRole } = Route.useSearch();

  // Resolve role: query string > localStorage. This drives the post-auth route.
  const [storedRole, setStoredRole] = useState<Role | null>(null);
  useEffect(() => {
    if (queryRole) {
      try { localStorage.setItem(ROLE_KEY, queryRole); } catch { /* ignore */ }
      setStoredRole(queryRole);
      return;
    }
    try {
      const v = localStorage.getItem(ROLE_KEY);
      if (v === "guardian" || v === "elder") setStoredRole(v);
    } catch { /* ignore */ }
  }, [queryRole]);
  const role: Role = queryRole ?? storedRole ?? "guardian";

  // ── shared step state ──────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("phone");
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect country once on mount (locale is a client-only signal)
  useEffect(() => { setCountry(detectCountry()); }, []);

  const maxDigits = useMemo(() => maskMaxDigits(country.mask), [country.mask]);
  const formatted = useMemo(() => formatPhone(phoneDigits, country.mask), [phoneDigits, country.mask]);
  const phoneValid = phoneDigits.length === maxDigits;
  const e164 = `${country.dial}${phoneDigits}`;

  const handleSendCode = async () => {
    if (!phoneValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { verificationId } = await sendVerificationCode(e164);
      setVerificationId(verificationId);
      setStep("otp");
    } catch {
      setError("We couldn't send the code. Check the number and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (code: string) => {
    if (!verificationId) return;
    setSubmitting(true);
    setError(null);
    try {
      await confirmVerificationCode(verificationId, code);
      // Success — set role and route per pairing state.
      setRole(role);
      if (isPaired) {
        navigate({ to: role === "elder" ? "/elder/home" : "/guardian/dashboard" });
      } else {
        navigate({ to: "/pair", search: { role } as never });
      }
    } catch {
      setError("That code didn't match. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Screen hasBottomBar>
      <div className="pt-2">
        {step === "otp" ? (
          <button
            type="button"
            onClick={() => { setError(null); setStep("phone"); }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-foreground transition-colors min-h-11 px-2 -ml-2"
            aria-label="Back to phone number"
          >
            <span aria-hidden>←</span> Back
          </button>
        ) : (
          <BackButton fallback="/" label="Back" />
        )}
      </div>

      {step === "phone" ? (
        <PhoneStep
          country={country}
          onCountryChange={setCountry}
          phoneDigits={phoneDigits}
          formatted={formatted}
          maxDigits={maxDigits}
          onPhoneChange={(d) => { setPhoneDigits(d); setError(null); }}
          phoneValid={phoneValid}
          submitting={submitting}
          error={error}
          onSubmit={handleSendCode}
        />
      ) : (
        <OtpStep
          e164={e164}
          country={country}
          phoneDigits={phoneDigits}
          submitting={submitting}
          error={error}
          onChangeNumber={() => { setStep("phone"); setError(null); }}
          onResend={handleSendCode}
          onConfirm={handleConfirm}
          onClearError={() => setError(null)}
        />
      )}
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* STEP 1 — phone entry                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

function PhoneStep({
  country, onCountryChange,
  phoneDigits, formatted, maxDigits, onPhoneChange,
  phoneValid, submitting, error, onSubmit,
}: {
  country: Country;
  onCountryChange: (c: Country) => void;
  phoneDigits: string;
  formatted: string;
  maxDigits: number;
  onPhoneChange: (digits: string) => void;
  phoneValid: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <div className="pt-4 pb-6">
        <h1 className="text-[28px] leading-[1.2] font-bold tracking-tight">
          Enter your phone number
        </h1>
        <p className="text-base text-text-secondary mt-2 leading-relaxed">
          We'll text you a code to sign in.
        </p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="space-y-4"
        noValidate
      >
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
            aria-label={`Country code: ${country.name} ${country.dial}`}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3 h-14 rounded-md",
              "bg-surface border border-border shadow-soft",
              "text-base font-medium tabular-nums",
              "transition-colors hover:border-accent/50 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            <span aria-hidden className="text-xl leading-none">{country.flag}</span>
            <span>{country.dial}</span>
            <ChevronDown size={16} className="text-text-secondary" aria-hidden />
          </button>

          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            autoFocus
            placeholder={country.mask.replace(/X/g, "•")}
            value={formatted}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, "").slice(0, maxDigits);
              onPhoneChange(next);
            }}
            disabled={submitting}
            aria-invalid={!!error}
            aria-label="Phone number"
            className={cn(
              "flex-1 min-w-0 h-14 px-4 rounded-md bg-surface border border-border shadow-soft",
              "text-lg tabular-nums tracking-wide",
              "transition-colors",
              "focus:outline-none focus:border-accent focus:ring-2 focus:ring-ring/40",
              "disabled:opacity-60",
              error && "border-danger/60",
            )}
          />
        </div>

        {pickerOpen && (
          <CountryPicker
            current={country}
            onSelect={(c) => { onCountryChange(c); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        )}

        {error && (
          <InlineAlert>{error}</InlineAlert>
        )}

        <p className="text-xs text-text-secondary leading-relaxed pt-1">
          By continuing you agree to our{" "}
          <a href="#" className="text-accent underline-offset-4 hover:underline">Terms</a>.
        </p>
      </form>

      <StickyBottomBar>
        <PrimaryButton
          onClick={onSubmit}
          disabled={!phoneValid || submitting}
          loading={submitting}
          className="w-full"
        >
          Send code
        </PrimaryButton>
      </StickyBottomBar>
    </>
  );
}

function CountryPicker({
  current, onSelect, onClose,
}: {
  current: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(s) || c.dial.includes(s) || c.iso.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div
      role="listbox"
      aria-label="Select country"
      className="relative -mt-1 rounded-md border border-border bg-surface shadow-warm overflow-hidden"
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search country"
        aria-label="Search country"
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
        className="w-full h-11 px-3 border-b border-border bg-transparent text-base focus:outline-none"
      />
      <ul className="max-h-64 overflow-auto">
        {filtered.length === 0 ? (
          <li className="px-3 py-4 text-sm text-text-secondary">No matches</li>
        ) : filtered.map((c) => {
          const active = c.iso === current.iso;
          return (
            <li key={c.iso}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                aria-selected={active}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left",
                  "hover:bg-secondary active:bg-muted transition-colors min-h-11",
                  active && "bg-secondary",
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span aria-hidden className="text-xl leading-none">{c.flag}</span>
                  <span className="truncate text-sm">{c.name}</span>
                </span>
                <span className="text-sm tabular-nums text-text-secondary">{c.dial}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* STEP 2 — OTP                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

function maskedPhoneDisplay(country: Country, digits: string) {
  if (digits.length < 4) return `${country.dial} ${digits}`;
  const last4 = digits.slice(-4);
  const head = digits.slice(0, Math.min(3, digits.length - 4));
  return `${country.dial} ${head} ••• ${last4}`;
}

function OtpStep({
  e164: _e164, country, phoneDigits,
  submitting, error,
  onChangeNumber, onResend, onConfirm, onClearError,
}: {
  e164: string;
  country: Country;
  phoneDigits: string;
  submitting: boolean;
  error: string | null;
  onChangeNumber: () => void;
  onResend: () => void;
  onConfirm: (code: string) => void;
  onClearError: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LEN).fill(""));
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const submittedRef = useRef(false);

  const code = digits.join("");
  const complete = code.length === OTP_LEN && digits.every((d) => /\d/.test(d));

  // Focus first box on mount
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  // When error arrives, clear digits + refocus
  useEffect(() => {
    if (error) {
      setDigits(Array(OTP_LEN).fill(""));
      submittedRef.current = false;
      requestAnimationFrame(() => inputs.current[0]?.focus());
    }
  }, [error]);

  // Auto-submit when complete
  useEffect(() => {
    if (complete && !submitting && !submittedRef.current) {
      submittedRef.current = true;
      onConfirm(code);
    }
  }, [complete, submitting, code, onConfirm]);

  const setDigitAt = (i: number, value: string) => {
    onClearError();
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      setDigits((prev) => { const n = [...prev]; n[i] = ""; return n; });
      return;
    }
    setDigits((prev) => {
      const next = [...prev];
      let cursor = i;
      for (const ch of cleaned) {
        if (cursor >= OTP_LEN) break;
        next[cursor] = ch;
        cursor++;
      }
      const focusTarget = Math.min(cursor, OTP_LEN - 1);
      requestAnimationFrame(() => inputs.current[focusTarget]?.focus());
      return next;
    });
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[i]) {
        setDigits((p) => { const n = [...p]; n[i] = ""; return n; });
      } else if (i > 0) {
        const prevIdx = i - 1;
        setDigits((p) => { const n = [...p]; n[prevIdx] = ""; return n; });
        requestAnimationFrame(() => inputs.current[prevIdx]?.focus());
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus(); e.preventDefault();
    } else if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
      inputs.current[i + 1]?.focus(); e.preventDefault();
    }
  };

  const handleResend = () => {
    if (cooldown > 0 || submitting) return;
    setCooldown(RESEND_SECONDS);
    onResend();
  };

  return (
    <>
      <div className="pt-4 pb-6">
        <h1 className="text-[28px] leading-[1.2] font-bold tracking-tight">
          Enter the 6-digit code
        </h1>
        <p className="text-base text-text-secondary mt-2 leading-relaxed">
          We sent it to{" "}
          <span className="text-foreground font-medium tabular-nums">
            {maskedPhoneDisplay(country, phoneDigits)}
          </span>
          .{" "}
          <button
            type="button"
            onClick={onChangeNumber}
            className="text-accent underline-offset-4 hover:underline font-medium min-h-11"
          >
            Change
          </button>
        </p>
      </div>

      <div
        role="group"
        aria-label="6-digit verification code"
        className="flex justify-between gap-2 sm:gap-3 my-2"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            disabled={submitting}
            onChange={(e) => setDigitAt(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={`Digit ${i + 1} of 6`}
            className={cn(
              "flex-1 min-w-0 max-w-[52px] h-[60px]",
              "rounded-md border-2 bg-surface text-center font-semibold",
              "text-[28px] leading-none tabular-nums",
              "caret-accent shadow-soft",
              "transition-[border-color,background-color]",
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

      {error && <div className="mt-4"><InlineAlert>{error}</InlineAlert></div>}

      <p className="mt-6 text-sm text-text-secondary text-center">
        Didn't get it?{" "}
        {cooldown > 0 ? (
          <span className="tabular-nums">Resend in {cooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={submitting}
            className="text-accent font-medium underline-offset-4 hover:underline disabled:opacity-50 min-h-11"
          >
            Resend code
          </button>
        )}
      </p>

      <StickyBottomBar>
        <PrimaryButton
          onClick={() => onConfirm(code)}
          disabled={!complete || submitting}
          loading={submitting}
          className="w-full"
        >
          Verify
        </PrimaryButton>
      </StickyBottomBar>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
    >
      <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden />
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}
