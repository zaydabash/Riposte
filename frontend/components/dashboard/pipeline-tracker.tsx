"use client";

import { GlassPanel } from "@/components/ui/glass-panel";
import type { AuditState } from "@/lib/mock-audit";
import { formatElapsed } from "@/lib/mock-audit";
import { cn } from "@/lib/utils";
import { Check, Circle, Loader2 } from "lucide-react";

interface PipelineTrackerProps {
  audit: AuditState;
}

export function PipelineTracker({ audit }: PipelineTrackerProps) {
  const progress =
    audit.currentStepIndex >= 0
      ? ((audit.currentStepIndex + 1) / audit.steps.length) * 100
      : 0;

  const currentStep =
    audit.currentStepIndex >= 0
      ? audit.steps[audit.currentStepIndex]
      : null;

  return (
    <GlassPanel className="p-6">
      <div className="mb-6 border-l-2 border-white/20 pl-4">
        <h2 className="text-lg text-foreground">Pipeline Tracker</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          Live execution progress
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between font-mono text-xs">
          <span className="text-muted">Progress</span>
          <span className="text-foreground/80">{Math.round(progress)}%</span>
        </div>
        <div className="h-1 w-full bg-white/10">
          <div
            className="h-full bg-white/60 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {currentStep && (
        <div className="mb-6 border border-white/10 bg-white/5 px-4 py-3">
          <p className="font-mono text-xs text-muted uppercase">Current Step</p>
          <p className="mt-1 text-foreground">{currentStep.label}</p>
          <p className="mt-1 font-mono text-xs text-muted">
            {currentStep.description}
          </p>
        </div>
      )}

      <div className="mb-6 font-mono text-xs text-muted">
        Elapsed:{" "}
        <span className="text-foreground">
          {formatElapsed(audit.elapsedSeconds)}
        </span>
      </div>

      <div className="space-y-1">
        {audit.steps.map((step, index) => {
          const isComplete = index < audit.currentStepIndex;
          const isCurrent = index === audit.currentStepIndex;
          const isPending = index > audit.currentStepIndex;

          return (
            <div
              key={step.id}
              className={cn(
                "flex items-start gap-3 border-l-2 px-4 py-3 transition-colors",
                isComplete && "border-safe/60 bg-safe/5",
                isCurrent && "border-white/40 bg-white/5",
                isPending && "border-white/10",
              )}
            >
              <span className="mt-0.5 shrink-0">
                {isComplete && (
                  <Check className="h-4 w-4 text-safe" aria-hidden="true" />
                )}
                {isCurrent && audit.status === "RUNNING" && (
                  <Loader2
                    className="h-4 w-4 animate-spin text-foreground/70"
                    aria-hidden="true"
                  />
                )}
                {isCurrent && audit.status !== "RUNNING" && (
                  <Check className="h-4 w-4 text-safe" aria-hidden="true" />
                )}
                {isPending && (
                  <Circle
                    className="h-4 w-4 text-muted/40"
                    aria-hidden="true"
                  />
                )}
              </span>
              <div>
                <p
                  className={cn(
                    "text-sm",
                    isCurrent ? "text-foreground" : "text-foreground/80",
                  )}
                >
                  {step.label}
                </p>
                <p className="font-mono text-xs text-muted">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
