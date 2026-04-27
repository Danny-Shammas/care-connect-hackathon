import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Warm toast: rounded, slides from top, soft shadow, 3s auto-dismiss.
 * Severity colors map to the design tokens (success / warning / danger).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="top-center"
      duration={3000}
      visibleToasts={3}
      toastOptions={{
        classNames: {
          toast:
            "group toast " +
            "group-[.toaster]:bg-surface group-[.toaster]:text-foreground " +
            "group-[.toaster]:border group-[.toaster]:border-border " +
            "group-[.toaster]:rounded-xl group-[.toaster]:shadow-warm " +
            "group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "font-semibold text-[15px]",
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md",
          success: "group-[.toaster]:border-success/40",
          warning: "group-[.toaster]:border-warning/40",
          error: "group-[.toaster]:border-danger/50",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
