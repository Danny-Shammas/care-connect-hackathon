import { ChevronLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Fallback route if there's no history to pop */
  fallback?: string;
  label?: string;
  className?: string;
}

export function BackButton({ fallback = "/", label, className }: BackButtonProps) {
  const router = useRouter();

  const onClick = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      router.navigate({ to: fallback as never });
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Go back"
      className={cn(
        "inline-flex items-center gap-1 min-h-11 min-w-11 -ml-2 pl-1 pr-3 rounded-md",
        "text-accent font-medium active:scale-[0.97] active:bg-muted transition-transform duration-[80ms]",
        className,
      )}
    >
      <ChevronLeft size={24} />
      {label && <span>{label}</span>}
    </button>
  );
}
