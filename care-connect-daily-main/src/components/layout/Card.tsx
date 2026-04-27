import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "bg-surface rounded-lg p-6",
        "shadow-[0_2px_12px_rgba(44,95,93,0.08)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
