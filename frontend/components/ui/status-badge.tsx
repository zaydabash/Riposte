import { cn } from "@/lib/utils";

type AuditStatus = "IDLE" | "RUNNING" | "VULNERABLE" | "SAFE";

interface StatusBadgeProps {
  status: AuditStatus;
  className?: string;
}

const statusConfig: Record<
  AuditStatus,
  { label: string; className: string }
> = {
  IDLE: {
    label: "IDLE",
    className: "border-white/10 text-muted bg-black/40",
  },
  RUNNING: {
    label: "RUNNING",
    className:
      "border-white/30 text-foreground/80 bg-white/5 animate-pulse-orange",
  },
  VULNERABLE: {
    label: "VULNERABLE",
    className: "border-vulnerable/50 text-vulnerable bg-vulnerable/10",
  },
  SAFE: {
    label: "SAFE",
    className: "border-safe/50 text-safe bg-safe/10",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center border px-3 py-1 font-mono text-xs tracking-widest uppercase",
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}

export type { AuditStatus };
