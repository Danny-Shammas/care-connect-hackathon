import { Drawer } from "vaul";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Mobile-first bottom sheet (replaces centered modals).
 * - Slides up from bottom
 * - Drag handle on top, swipe-down or tap-backdrop to dismiss
 * - Respects bottom safe area (home indicator)
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50",
            "mx-auto max-w-screen-sm",
            "bg-surface rounded-t-2xl shadow-warm",
            "outline-none",
            className,
          )}
          style={{
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-border" aria-hidden />
          </div>
          <div className="px-6 pb-2">
            {title && (
              <Drawer.Title className="text-xl font-semibold text-foreground">
                {title}
              </Drawer.Title>
            )}
            {description && (
              <Drawer.Description className="text-sm text-text-secondary mt-1">
                {description}
              </Drawer.Description>
            )}
          </div>
          <div className="px-6 pt-2 pb-4">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
