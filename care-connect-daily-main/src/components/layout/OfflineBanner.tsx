import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

/**
 * Top-of-app banner shown when navigator reports offline.
 * Sits above all routes; respects safe-area inset.
 */
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-warning px-4 text-warning-foreground shadow-soft motion-safe:animate-[fadeInUp_200ms_ease-out]"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", paddingBottom: 8 }}
    >
      <WifiOff className="h-4 w-4" aria-hidden />
      <span className="text-sm font-medium">You're offline. Some things may not work.</span>
    </div>
  );
}
