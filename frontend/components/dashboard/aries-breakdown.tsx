import type { AriesComponents } from "@/lib/backend-types";
import { ARIES_WEIGHT_ENTRIES } from "@/lib/riposte-config";
import { formatScore } from "@/lib/format";

interface AriesBreakdownProps {
  components: AriesComponents;
}

/** Evaluation breakdown: per-component value bars (0–100) with weight labels. */
export function AriesBreakdown({ components }: AriesBreakdownProps) {
  return (
    <div className="space-y-3">
      {ARIES_WEIGHT_ENTRIES.map(({ key, label, weight }) => {
        const value = components[key];
        const pct = Math.min(Math.max(value, 0), 100);
        return (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between font-mono text-[11px]">
              <span className="text-foreground/80">
                <span className="text-accent">{key}</span>
                <span className="ml-2 text-muted">{label}</span>
                <span className="ml-2 text-muted/60">×{weight}</span>
              </span>
              <span className="text-foreground/90">{formatScore(value)}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5">
              <div
                className="h-full bg-accent/70"
                style={{ width: `${pct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
