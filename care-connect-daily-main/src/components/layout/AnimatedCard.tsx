import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Stagger index — multiplied by 60ms for entrance delay. */
  index?: number;
}

/**
 * Card with a subtle 8px slide-up + fade entrance.
 * Honors prefers-reduced-motion via motion-safe: variant.
 * Use `index` to stagger lists.
 */
export function AnimatedCard({ children, className, index = 0, style, ...rest }: AnimatedCardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-lg p-6 shadow-[0_2px_12px_rgba(44,95,93,0.08)]",
        "motion-safe:animate-[fadeInUp_240ms_cubic-bezier(0.22,1,0.36,1)_both]",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms`, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
