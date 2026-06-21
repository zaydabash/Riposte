"use client";

import { ExternalLink, ShieldAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiposteAuditState } from "@/lib/backend-types";
import {
  ariesBand,
  deriveGlobalAries,
  remediationKey,
  type Alert,
} from "@/lib/audit-selectors";
import { GlassPanel } from "@/components/ui/glass-panel";
import { CRITICAL_ARIES_THRESHOLD } from "@/lib/riposte-config";
import { formatClock, formatScore, SEVERITY_TEXT } from "@/lib/format";
import { ariesBandTextClass } from "@/components/dashboard/aries-score-badge";

interface IntelligenceLayerProps {
  state: RiposteAuditState | null;
  alerts: readonly Alert[];
  compact?: boolean;
}

const BAND_CLASS: Record<ReturnType<typeof ariesBand>, string> = {
  empty: "text-muted",
  low: "text-[var(--status-safe)]",
  medium: "text-[var(--accent-orange)]",
  high: "text-[var(--status-vulnerable)]",
};

export function IntelligenceLayer({
  state,
  alerts,
  compact = false,
}: IntelligenceLayerProps) {
  const global = deriveGlobalAries(state);
  const band = ariesBand(global);
  const remediations = state?.remediations ? [...state.remediations] : [];
  remediations.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || 0,
  );

  const panelClass = cn("panel-hover-glow", compact ? "p-3" : "p-6");
  const stackClass = compact
    ? "flex h-full min-h-0 flex-col gap-2 overflow-hidden"
    : "space-y-8";
  const scrollClass = "min-h-0 overflow-y-auto overscroll-contain";

  return (
    <div className={stackClass}>
      <GlassPanel className={cn(panelClass, compact && "shrink-0")}>
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Global ARiES
        </p>
        <p
          className={cn(
            "font-mono",
            compact ? "mt-1 text-3xl" : "mt-2 text-5xl",
            BAND_CLASS[band],
          )}
        >
          {formatScore(global)}
        </p>
        <p className="mt-1 font-mono text-[10px] leading-snug text-muted">
          {global === null
            ? "No findings evaluated yet"
            : `Findings ranked by ARiES (0–100). Remediation triggers at ≥${CRITICAL_ARIES_THRESHOLD}.`}
        </p>
      </GlassPanel>

      <GlassPanel
        className={cn(
          panelClass,
          // min-h-16 is a real flex-basis floor: even when sibling panels
          // (Global ARiES, Remediation Queue) are shrink-0 and claim most of
          // the row's capped height, this panel keeps room for ~2-3 visible
          // rows instead of being squeezed to 0px by the flex algorithm.
          compact && "flex min-h-16 flex-1 flex-col overflow-hidden",
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            compact ? "mb-1" : "mb-4",
          )}
        >
          <ShieldAlert size={compact ? 13 : 16} className="text-accent" />
          <h3 className={cn(compact ? "text-xs" : "text-sm", "text-foreground/90")}>
            Risk Alert Feed
          </h3>
        </div>
        {alerts.length === 0 ? (
          <p className="font-mono text-[10px] text-muted">No alerts.</p>
        ) : (
          <ul
            className={cn(
              "space-y-1.5 pr-0.5",
              scrollClass,
              compact ? "flex-1" : "max-h-64",
            )}
          >
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="border-l-2 border-white/10 bg-black/20 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono text-[10px] tracking-wide",
                      alert.ariesScore !== undefined
                        ? ariesBandTextClass(alert.ariesScore)
                        : SEVERITY_TEXT[alert.severity],
                    )}
                  >
                    {alert.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {formatClock(alert.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                  {alert.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      <GlassPanel className={cn(panelClass, compact && "shrink-0")}>
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5",
            compact ? "mb-1" : "mb-4",
          )}
        >
          <Wrench size={compact ? 13 : 16} className="text-accent" />
          <h3 className={cn(compact ? "text-xs" : "text-sm", "text-foreground/90")}>
            Remediation Queue
          </h3>
        </div>
        {remediations.length === 0 ? (
          <p className="font-mono text-[10px] leading-snug text-muted">
            No repair proposals yet. Critical control failures trigger HITL PRs and re-verification.
          </p>
        ) : (
          <ul
            className={cn(
              "space-y-2 pr-0.5",
              scrollClass,
              compact ? "max-h-24" : "max-h-48",
            )}
          >
            {remediations.map((r) => (
              <li
                key={remediationKey(r)}
                className="border border-white/10 bg-black/20 p-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] text-foreground/90">
                    {r.status}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    ARiES {formatScore(r.aries_score)}
                    {r.validation_status ? ` · ${r.validation_status}` : ""}
                  </span>
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                  {r.repo_url}
                </p>
                {r.pr_url ? (
                  <a
                    href={r.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-accent hover:underline"
                  >
                    <ExternalLink size={10} /> View PR
                  </a>
                ) : (
                  <p className="mt-1 font-mono text-[10px] text-muted/60">
                    PR pending, no URL yet
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
