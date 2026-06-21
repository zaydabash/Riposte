import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/backend-types";
import { SEVERITY_BORDER, SEVERITY_TEXT } from "@/lib/format";

interface SeverityBadgeProps {
  severity: Severity;
  className?: string;
}

/** Finding-severity chip composed from the existing badge visual language. */
export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border bg-black/40 px-2.5 py-1 font-mono text-[10px] tracking-widest uppercase",
        SEVERITY_BORDER[severity],
        SEVERITY_TEXT[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}
