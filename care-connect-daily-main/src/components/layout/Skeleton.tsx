import { cn } from "@/lib/utils";

/**
 * Skeleton primitives — render shaped placeholders, not spinners.
 * Reduced-motion users get a static block (no shimmer).
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted relative overflow-hidden",
        "motion-safe:before:absolute motion-safe:before:inset-0",
        "motion-safe:before:-translate-x-full motion-safe:before:animate-[shimmer_1.4s_infinite]",
        "motion-safe:before:bg-gradient-to-r motion-safe:before:from-transparent motion-safe:before:via-white/40 motion-safe:before:to-transparent",
        className,
      )}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-surface rounded-lg p-6 shadow-soft">
      <div className="flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-1/2 mb-2" />
          <Skeleton className="h-3 w-1/3 mb-4" />
          <SkeletonText lines={2} />
        </div>
      </div>
    </div>
  );
}
