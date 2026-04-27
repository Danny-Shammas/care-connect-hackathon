import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
  return (
    <h3
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.12em] text-accent mb-3",
        className,
      )}
    >
      {children}
    </h3>
  );
}
