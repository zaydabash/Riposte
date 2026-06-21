import { cn } from "@/lib/utils";
import { ariesBand } from "@/lib/audit-selectors";
import { formatScore } from "@/lib/format";

const BAND_TEXT: Record<ReturnType<typeof ariesBand>, string> = {
  empty: "text-muted",
  low: "text-[var(--status-safe)]",
  medium: "text-[var(--accent-orange)]",
  high: "text-[var(--status-vulnerable)]",
};

const BAND_BORDER: Record<ReturnType<typeof ariesBand>, string> = {
  empty: "border-white/10",
  low: "border-[var(--status-safe)]/40",
  medium: "border-[var(--accent-orange)]/40",
  high: "border-[var(--status-vulnerable)]/50",
};

/** Tailwind text-color class for an ARiES score band. */
export function ariesBandTextClass(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return BAND_TEXT.empty;
  }
  return BAND_TEXT[ariesBand(score)];
}

interface AriesScoreBadgeProps {
  score: number;
  isCritical?: boolean;
  className?: string;
}

/** Primary finding score chip — replaces categorical severity badges. */
export function AriesScoreBadge({
  score,
  isCritical = false,
  className,
}: AriesScoreBadgeProps) {
  const band = ariesBand(score);

  return (
    <span
      className={cn(
        "inline-flex items-center border bg-black/40 px-2.5 py-1 font-mono text-[10px] tracking-widest",
        BAND_BORDER[band],
        BAND_TEXT[band],
        isCritical && "border-[var(--status-vulnerable)]/60",
        className,
      )}
    >
      ARiES {formatScore(score)}
    </span>
  );
}
