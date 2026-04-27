import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Show a spinner and disable interaction. Keeps width stable. */
  loading?: boolean;
};

/*
 * Buttons:
 * - 44x44 minimum (HIG); 64x64 inside [data-ui="elder"]
 * - Tactile :active scale 0.97 with 80ms transition
 * - Warm focus ring (--ring), 2px offset for clear keyboard affordance
 * - Built-in `loading` state: spinner + aria-busy + disabled
 * - touch-action: manipulation inherited from base layer
 */
const base =
  "relative inline-flex items-center justify-center gap-2 rounded-md font-semibold " +
  "transition-[transform,filter,background-color] duration-[80ms] ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 " +
  "min-h-11 min-w-11 px-5 text-base " +
  "active:scale-[0.97] " +
  "[[data-ui=elder]_&]:min-h-16 [[data-ui=elder]_&]:min-w-16 [[data-ui=elder]_&]:px-7 [[data-ui=elder]_&]:text-xl";

function Spinner() {
  return (
    <Loader2
      className="h-4 w-4 motion-safe:animate-spin [[data-ui=elder]_&]:h-5 [[data-ui=elder]_&]:w-5"
      aria-hidden
    />
  );
}

function renderContent(loading: boolean | undefined, children: ReactNode) {
  if (!loading) return children;
  return (
    <>
      <span className="invisible flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 flex items-center justify-center">
        <Spinner />
      </span>
    </>
  );
}

export function PrimaryButton({ children, className, loading, disabled, ...rest }: BtnProps) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        base,
        "bg-primary text-primary-foreground shadow-warm",
        "hover:brightness-105 active:brightness-95",
        className,
      )}
      {...rest}
    >
      {renderContent(loading, children)}
    </button>
  );
}

export function SecondaryButton({ children, className, loading, disabled, ...rest }: BtnProps) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        base,
        "bg-accent text-accent-foreground",
        "hover:brightness-110 active:brightness-90",
        className,
      )}
      {...rest}
    >
      {renderContent(loading, children)}
    </button>
  );
}

export function GhostButton({ children, className, loading, disabled, ...rest }: BtnProps) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        base,
        "bg-transparent text-accent border border-border",
        "hover:bg-secondary active:bg-muted",
        className,
      )}
      {...rest}
    >
      {renderContent(loading, children)}
    </button>
  );
}
