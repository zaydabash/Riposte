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
import { formatClock, formatScore, SEVERITY_TEXT } from "@/lib/format";

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
  const stackClass = compact ? "space-y-2" : "space-y-8";

  return (
    <div className={stackClass}>
      <GlassPanel className={panelClass}>
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
            : "max(aries_score) · critical ≥ 75"}
        </p>
      </GlassPanel>

      <GlassPanel className={panelClass}>
        <div className={cn("flex items-center gap-1.5", compact ? "mb-1" : "mb-4")}>
          <ShieldAlert size={compact ? 13 : 16} className="text-accent" />
          <h3 className={cn(compact ? "text-xs" : "text-sm", "text-foreground/90")}>
            Risk Alert Feed
          </h3>
        </div>
        {alerts.length === 0 ? (
          <p className="font-mono text-[10px] text-muted">No alerts.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="border-l-2 border-white/10 bg-black/20 px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono text-[10px] tracking-wide",
                      SEVERITY_TEXT[alert.severity],
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

      <GlassPanel className={panelClass}>
        <div className={cn("flex items-center gap-1.5", compact ? "mb-1" : "mb-4")}>
          <Wrench size={compact ? 13 : 16} className="text-accent" />
          <h3 className={cn(compact ? "text-xs" : "text-sm", "text-foreground/90")}>
            Remediation Queue
          </h3>
        </div>
        {remediations.length === 0 ? (
          <p className="font-mono text-[10px] leading-snug text-muted">
            No remediations. Critical findings trigger HITL pull requests.
          </p>
        ) : (
          <ul className="space-y-2">
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
