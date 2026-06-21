"use client";

import { Fragment } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiposteAuditState } from "@/lib/backend-types";
import {
  deriveActiveStage,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@/lib/audit-selectors";

interface SystemGraphProps {
  state: RiposteAuditState | null;
  compact?: boolean;
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  fuzzer: "Fuzzer",
  browser: "Browser",
  eval: "Eval",
  redis: "Redis",
  remediation: "Remediation",
};

/**
 * Conceptual overlay — NOT derived from backend graph structure (Riposte exposes
 * no graph API). The highlighted stage is a heuristic over the most recent
 * finding's dominant ARiES component (see {@link deriveActiveStage}).
 */
export function SystemGraph({ state, compact = false }: SystemGraphProps) {
  const active = deriveActiveStage(state);
  const isRunning = state?.status === "running";

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
        Conceptual pipeline · not backend topology
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = stage === active;
          return (
            <Fragment key={stage}>
              <div
                className={cn(
                  "border font-mono tracking-wide transition-colors",
                  compact ? "px-2.5 py-1.5 text-[10px]" : "px-4 py-3 text-xs",
                  isActive
                    ? "border-accent/60 bg-accent/10 text-accent"
                    : "border-white/10 bg-black/30 text-muted",
                  isActive && isRunning && "animate-pulse-orange",
                )}
              >
                {STAGE_LABELS[stage]}
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <ArrowRight size={14} className="text-muted/50" aria-hidden="true" />
              )}
            </Fragment>
          );
        })}
      </div>
      {active === null && (
        <p className={cn("font-mono text-muted", compact ? "text-[10px]" : "text-xs")}>
          Idle. Start an audit to activate the pipeline overlay.
        </p>
      )}
    </div>
  );
}
