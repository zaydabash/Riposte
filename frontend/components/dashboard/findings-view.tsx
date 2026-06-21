"use client";

import { useEffect, useRef } from "react";
import { Crosshair } from "lucide-react";
import type { RiposteAuditState } from "@/lib/backend-types";
import { findingKey, sortFindings } from "@/lib/audit-selectors";
import { FindingCard } from "@/components/dashboard/finding-card";

interface FindingsViewProps {
  state: RiposteAuditState | null;
  isActive: boolean;
}

/**
 * Live State Projection — findings as accumulating graph nodes (not a log).
 * Order and sequence indices follow the canonical {@link sortFindings} order.
 */
export function FindingsView({ state, isActive }: FindingsViewProps) {
  const findings = sortFindings(state);
  const seenRef = useRef<Set<string>>(new Set());

  // After render, record keys so only genuinely new nodes animate next time.
  useEffect(() => {
    for (const f of findings) seenRef.current.add(findingKey(f));
  });

  if (findings.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 border border-dashed border-white/10 p-10 text-center">
        <Crosshair className="text-muted" size={28} />
        <p className="font-mono text-sm text-muted">
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
