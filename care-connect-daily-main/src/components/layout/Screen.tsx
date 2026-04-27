import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScreenProps {
  children: ReactNode;
  className?: string;
  /** "elder" applies larger typography & touch targets */
  ui?: "elder" | "guardian";
  /** Reserve space at the bottom for a sticky tab bar */
  hasBottomBar?: boolean;
}

/**
 * Full-height mobile container.
 * - 100dvh accounts for collapsing browser chrome
 * - Honors all 4 safe-area insets
 * - Caps width at sm so it stays phone-shaped on tablets/desktop
 */
export function Screen({ children, className, ui = "guardian", hasBottomBar }: ScreenProps) {
  return (
    <div
      data-ui={ui}
      className={cn(
        "min-h-[100dvh] w-full bg-background text-foreground mx-auto max-w-screen-sm",
        "flex flex-col",
        className,
      )}
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
        // If a BottomBar is present, IT handles the bottom safe area.
        // Otherwise the screen does.
        paddingBottom: hasBottomBar ? undefined : "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex-1 px-4">{children}</div>
    </div>
  );
}
