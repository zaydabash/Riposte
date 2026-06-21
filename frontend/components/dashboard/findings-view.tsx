"use client";

import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiposteAuditState } from "@/lib/backend-types";
import { findingKey, sortFindings } from "@/lib/audit-selectors";
import { FindingCard } from "@/components/dashboard/finding-card";

interface FindingsViewProps {
  state: RiposteAuditState | null;
  isActive: boolean;
  compact?: boolean;
}

/**
 * Live State Projection — findings as accumulating graph nodes (not a log).
 * Order and sequence indices follow the canonical {@link sortFindings} order.
 */
export function FindingsView({
  state,
  isActive,
  compact = false,
}: FindingsViewProps) {
  const findings = sortFindings(state);
  const seenRef = useRef<Set<string>>(new Set());

  // After render, record keys so only genuinely new nodes animate next time.
  useEffect(() => {
    for (const f of findings) seenRef.current.add(findingKey(f));
  });

  if (findings.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[160px] flex-col items-center justify-center gap-2 border border-dashed border-white/10 text-center",
          compact ? "p-4" : "gap-3 p-10",
        )}
      >
        <Crosshair className="text-muted" size={compact ? 22 : 28} />
        <p className={cn("font-mono text-muted", compact ? "text-xs" : "text-sm")}>
          {isActive
            ? "Fuzzing in progress. Findings will stream in as the pipeline evaluates payloads."
            : "No findings yet. Start an audit to project live results here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding, i) => (
        <FindingCard
          key={findingKey(finding)}
          finding={finding}
          sequenceIndex={i + 1}
          targetEndpoint={state?.target_endpoint ?? "N/A"}
          isNew={!seenRef.current.has(findingKey(finding))}
        />
      ))}
    </div>
  );
}
