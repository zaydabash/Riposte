"use client";

import { GlassPanel } from "@/components/ui/glass-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AuditState } from "@/lib/mock-audit";
import { PPL_THRESHOLD } from "@/lib/mock-audit";

interface MetricsPanelProps {
  audit: AuditState;
}

export function MetricsPanel({ audit }: MetricsPanelProps) {
  const maxPpl = Math.max(...audit.pplHistory, PPL_THRESHOLD, 70);
  const isAboveThreshold = audit.pplScore > PPL_THRESHOLD;

  return (
    <GlassPanel className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div className="border-l-2 border-white/20 pl-4">
          <h2 className="text-lg text-foreground">Metrics</h2>
          <p className="mt-1 font-mono text-xs text-muted">
            Perplexity anomaly detection
          </p>
        </div>
        <StatusBadge status={audit.status} />
      </div>

      <div className="mb-8">
        <p className="font-mono text-xs tracking-widest text-muted uppercase">
          Perplexity Score
        </p>
        <p
          className={`mt-2 font-mono text-6xl tracking-tight ${
            isAboveThreshold ? "text-vulnerable" : "text-foreground"
          }`}
        >
          {audit.pplScore.toFixed(1)}
        </p>
        <p className="mt-2 font-mono text-xs text-muted">
          Threshold: {PPL_THRESHOLD} ·{" "}
          {isAboveThreshold ? (
            <span className="text-vulnerable">Anomaly detected</span>
          ) : (
            <span className="text-safe">Within baseline</span>
          )}
        </p>
      </div>

      <div>
        <p className="mb-4 font-mono text-xs tracking-widest text-muted uppercase">
          PPL Over Time
        </p>
        <div className="relative h-32 border border-white/10 bg-black/40 p-4">
          <svg
            viewBox="0 0 200 80"
            className="h-full w-full"
            preserveAspectRatio="none"
            aria-label="Perplexity over time chart"
          >
            <line
              x1="0"
              y1={80 - (PPL_THRESHOLD / maxPpl) * 80}
              x2="200"
              y2={80 - (PPL_THRESHOLD / maxPpl) * 80}
              stroke="rgba(160,160,160,0.5)"
              strokeWidth="0.5"
              strokeDasharray="4 2"
            />
            {audit.pplHistory.length > 1 && (
              <polyline
                fill="none"
                stroke={isAboveThreshold ? "#ff4444" : "#a0a0a0"}
                strokeWidth="1.5"
                points={audit.pplHistory
                  .map((val, i) => {
                    const x =
                      (i / (audit.pplHistory.length - 1)) * 200;
                    const y = 80 - (val / maxPpl) * 80;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
            )}
            {audit.pplHistory.map((val, i) => {
              const x =
                audit.pplHistory.length === 1
                  ? 100
                  : (i / (audit.pplHistory.length - 1)) * 200;
              const y = 80 - (val / maxPpl) * 80;
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={val > PPL_THRESHOLD ? "#ff4444" : "#888888"}
                />
              );
            })}
          </svg>
          <div className="absolute bottom-2 right-2 font-mono text-[10px] text-muted">
            threshold {PPL_THRESHOLD}
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
