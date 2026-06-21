"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileWarning } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/backend-types";
import { formatClock, formatScore } from "@/lib/format";
import { AriesBreakdown } from "@/components/dashboard/aries-breakdown";
import { SeverityBadge } from "@/components/dashboard/severity-badge";

interface FindingCardProps {
  finding: Finding;
  /** Monotonic display index (#1, #2, …) by canonical created_at order. */
  sequenceIndex: number;
  targetEndpoint: string;
  /** Whether this node was newly appended in the latest poll (subtle entrance). */
  isNew: boolean;
}

export function FindingCard({
  finding,
  sequenceIndex,
  targetEndpoint,
  isNew,
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const leaked = finding.leaked_documents ?? [];

  return (
    <article
      className={cn(
        "border border-white/10 bg-black/30 transition-colors",
        finding.is_critical && "border-[var(--status-vulnerable)]/40",
        isNew && "animate-fade-in-up",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        <span className="mt-0.5 font-mono text-xs text-muted">
          #{sequenceIndex}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <span className="font-mono text-xs text-foreground/90">
              ARiES {formatScore(finding.aries_score)}
            </span>
            {finding.technique_id && (
              <span className="font-mono text-[10px] text-accent">
                {finding.technique_id}
              </span>
            )}
            <span className="font-mono text-[10px] text-muted">
              {formatClock(finding.created_at)}
            </span>
            {leaked.length > 0 && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--status-vulnerable)]">
                <FileWarning size={12} /> {leaked.length} leaked
              </span>
            )}
          </div>
          <p className="mt-2 truncate font-mono text-xs text-muted">
            {targetEndpoint}
          </p>
          <p className="mt-1 line-clamp-2 text-sm text-foreground/85">
            {finding.payload}
          </p>
        </div>
        <span className="mt-0.5 text-muted">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/10 px-4 py-4">
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
              Payload
            </p>
            <p className="font-mono text-xs whitespace-pre-wrap text-foreground/85">
              {finding.payload}
            </p>
          </div>
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
              Target response
            </p>
            <p className="font-mono text-xs whitespace-pre-wrap text-foreground/75">
              {finding.response || "N/A"}
            </p>
          </div>
          {leaked.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest text-[var(--status-vulnerable)] uppercase">
                Leaked documents
              </p>
              <ul className="space-y-1">
                {leaked.map((doc, i) => (
                  <li
                    key={`${i}-${doc.slice(0, 24)}`}
                    className="border-l-2 border-[var(--status-vulnerable)]/50 pl-2 font-mono text-xs text-foreground/80"
                  >
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {finding.artifacts_summary && (
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
                Artifacts summary
              </p>
              <p className="font-mono text-xs whitespace-pre-wrap text-foreground/75">
                {finding.artifacts_summary}
              </p>
            </div>
          )}
          {(finding.recommended_controls?.length ?? 0) > 0 && (
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
                Recommended controls
              </p>
              <ul className="space-y-1">
                {finding.recommended_controls!.map((control, i) => (
                  <li
                    key={`${i}-${control.slice(0, 24)}`}
                    className="border-l-2 border-accent/40 pl-2 font-mono text-xs text-foreground/80"
                  >
                    {control}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
              Evaluation breakdown
            </p>
            <AriesBreakdown components={finding.components} />
          </div>
        </div>
      )}
    </article>
  );
}
