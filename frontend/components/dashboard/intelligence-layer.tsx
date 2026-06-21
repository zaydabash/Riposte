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
}

const BAND_CLASS: Record<ReturnType<typeof ariesBand>, string> = {
  empty: "text-muted",
  low: "text-[var(--status-safe)]",
  medium: "text-[var(--accent-orange)]",
  high: "text-[var(--status-vulnerable)]",
};

export function IntelligenceLayer({ state, alerts }: IntelligenceLayerProps) {
  const global = deriveGlobalAries(state);
  const band = ariesBand(global);
  const remediations = state?.remediations ? [...state.remediations] : [];
  remediations.sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || 0,
  );

  return (
    <div className="space-y-8">
      {/* Global ARiES score */}
      <GlassPanel className="p-6">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Global ARiES
        </p>
        <p className={cn("mt-2 font-mono text-5xl", BAND_CLASS[band])}>
          {formatScore(global)}
        </p>
        <p className="mt-2 font-mono text-xs text-muted">
          {global === null
            ? "No findings evaluated yet"
            : "max(aries_score) across findings · critical ≥ 75"}
        </p>
      </GlassPanel>

      {/* Risk alert feed */}
      <GlassPanel className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldAlert size={16} className="text-accent" />
          <h3 className="text-sm text-foreground/90">Risk Alert Feed</h3>
        </div>
        {alerts.length === 0 ? (
          <p className="font-mono text-xs text-muted">No alerts.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="border-l-2 border-white/10 bg-black/20 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "font-mono text-[11px] tracking-wide",
                      SEVERITY_TEXT[alert.severity],
                    )}
                  >
                    {alert.title}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    {formatClock(alert.createdAt)}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted">
                  {alert.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>

      {/* Remediation queue */}
      <GlassPanel className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wrench size={16} className="text-accent" />
          <h3 className="text-sm text-foreground/90">Remediation Queue</h3>
        </div>
        {remediations.length === 0 ? (
          <p className="font-mono text-xs text-muted">
            No remediations. Critical findings trigger HITL pull requests.
          </p>
        ) : (
          <ul className="space-y-3">
            {remediations.map((r) => (
              <li
                key={remediationKey(r)}
                className="border border-white/10 bg-black/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-foreground/90">
                    {r.status}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
                    ARiES {formatScore(r.aries_score)}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-[11px] text-muted">
                  {r.repo_url}
                </p>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted/80">
                  {r.payload}
                </p>
                {r.pr_url ? (
                  <a
                    href={r.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
                  >
                    <ExternalLink size={12} /> View PR
                  </a>
                ) : (
                  <p className="mt-2 font-mono text-[11px] text-muted/60">
                    PR pending — no URL yet
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
