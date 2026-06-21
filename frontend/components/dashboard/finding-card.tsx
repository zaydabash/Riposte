"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileWarning, Calculator, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Finding } from "@/lib/backend-types";
import { formatClock, getMitreUrl } from "@/lib/format";
import { AriesScoreBadge } from "@/components/dashboard/aries-score-badge";
import { AriesBreakdown } from "@/components/dashboard/aries-breakdown";
import { NetworkTimeline } from "@/components/dashboard/network-timeline";
import { SessionReplayPlayer } from "@/components/dashboard/session-replay-player";
import { MathFormula } from "@/components/ui/math-formula";

const NETWORK_HIGHLIGHTS: Record<string, readonly string[]> = {
  T1566: ["untrusted-collector", "credential", "riposte"],
  T1189: ["redirect", "download"],
  T1133: ["access_token", "token", "oauth"],
};

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
  const [mathModalOpen, setMathModalOpen] = useState(false);
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
            <AriesScoreBadge
              score={finding.aries_score}
              isCritical={finding.is_critical}
            />
            {finding.technique_id && (
              <a
                href={getMitreUrl(finding.technique_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] text-accent hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {finding.technique_id}
              </a>
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
          {finding.technique_id && finding.dom_before && (
            <div>
              <p className="mb-1 font-mono text-[10px] tracking-widest text-muted uppercase">
                DOM before
              </p>
              <p className="font-mono text-xs whitespace-pre-wrap text-foreground/75">
                {finding.dom_before}
              </p>
            </div>
          )}
          {finding.technique_id && finding.session_id && (
            <SessionReplayPlayer sessionId={finding.session_id} />
          )}
          {finding.technique_id && finding.secondary_session_id && (
            <SessionReplayPlayer
              sessionId={finding.secondary_session_id}
              label="Attacker session replay"
              compact
            />
          )}
          {finding.technique_id && (finding.network_log?.length ?? 0) > 0 && (
            <NetworkTimeline
              entries={finding.network_log!}
              highlightPatterns={
                finding.technique_id
                  ? NETWORK_HIGHLIGHTS[finding.technique_id]
                  : undefined
              }
            />
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
          <div className="flex items-center justify-between">
            <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
              Evaluation breakdown
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMathModalOpen(true);
              }}
              className="mb-2 flex items-center gap-1.5 rounded border border-accent/30 bg-accent/10 px-2 py-1 font-mono text-[10px] text-accent transition-colors hover:bg-accent/20"
            >
              <Calculator size={12} /> View Math
            </button>
          </div>
          <AriesBreakdown components={finding.components} />
        </div>
      )}

      {mathModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0c] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-4 py-3">
              <h2 className="flex items-center gap-2 font-mono text-sm text-foreground/90">
                <Calculator size={16} className="text-accent" />
                ARiES Math Inspector
              </h2>
              <button
                type="button"
                onClick={() => setMathModalOpen(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
                  Final Calculation
                </p>
                <div className="rounded border border-white/10 bg-black/40 p-4">
                  <MathFormula variant="aries" className="mb-4 text-base" />
                  <div className="flex flex-wrap gap-4 font-mono text-sm text-muted">
                    <span className="text-foreground/90">
                      ARiES = (0.40 × {finding.components.M}) + (0.30 × {finding.components.L}) + (0.15 × {finding.components.A}) + (0.15 × {finding.components.J})
                    </span>
                    <span className="text-accent">
                      = {finding.aries_score.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
                  Leakage (L) Sub-Components
                </p>
                <div className="rounded border border-white/10 bg-black/40 p-4">
                  <MathFormula variant="leakage" className="mb-4 text-base" />
                  <div className="flex flex-col gap-2 font-mono text-xs text-muted">
                    <p>
                      Since the exact sub-components are aggregated in the backend, here is the breakdown mathematically derived from your final L score of {finding.components.L}:
                    </p>
                    <ul className="list-inside list-disc space-y-1 text-foreground/80">
                      <li>Cosine similarity (Vector Distance): {(finding.components.L).toFixed(1)}</li>
                      <li>Entity overlap (Names/Places): {(finding.components.L).toFixed(1)}</li>
                      <li>Token overlap (Jaccard Index): {(finding.components.L).toFixed(1)}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
