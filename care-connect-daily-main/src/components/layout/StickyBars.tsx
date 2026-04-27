import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Sticky header that sits below the iOS notch/status bar. */
export function StickyHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border",
        className,
      )}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-4 py-3">{children}</div>
    </header>
  );
}

/**
 * Sticky bottom action bar that:
 *  - Sits above the iOS home indicator (safe-area-inset-bottom)
 *  - Lifts above the on-screen keyboard (--keyboard-offset, set by useKeyboardOffset)
 */
export function StickyBottomBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky z-30 bg-background/90 backdrop-blur-md border-t border-border",
        className,
      )}
      style={{
        bottom: 0,
        paddingBottom: "max(env(safe-area-inset-bottom), var(--keyboard-offset, 0px))",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        transition: "padding-bottom 180ms ease",
      }}
    >
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
