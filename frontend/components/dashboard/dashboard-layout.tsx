"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AuditConfig } from "@/ports/audit-service";
import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";
import type { Alert } from "@/lib/audit-selectors";
import type { AuditPhase } from "@/hooks/use-audit";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ControlPlane } from "@/components/dashboard/control-plane";
import { FindingsView } from "@/components/dashboard/findings-view";
import { SystemGraph } from "@/components/dashboard/system-graph";
import { IntelligenceLayer } from "@/components/dashboard/intelligence-layer";
import { formatRelativeTime } from "@/lib/format";

interface DashboardLayoutProps {
  config: AuditConfig;
  onConfigChange: (config: AuditConfig) => void;
  onStart: () => void;
  onReset: () => void;
  state: RiposteAuditState | null;
  phase: AuditPhase;
  alerts: readonly Alert[];
  health: HealthResponse | null;
  error: Error | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;
}

type CenterTab = "findings" | "graph";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  const { state, phase, alerts, lastSyncedAt, isSyncing } = props;
  const [tab, setTab] = useState<CenterTab>("findings");
  const now = useNow(lastSyncedAt !== null);
  const isActive = phase === "running" || phase === "configuring";

  return (
    <div className="mx-auto grid max-w-[1600px] gap-8 px-6 pb-16 md:px-10 lg:grid-cols-12">
      {/* Left — Control Plane */}
      <aside className="lg:col-span-3">
        <ControlPlane
          config={props.config}
          onConfigChange={props.onConfigChange}
          onStart={props.onStart}
          onReset={props.onReset}
          phase={phase}
          state={state}
          health={props.health}
          error={props.error}
        />
      </aside>

      {/* Center — Observability Canvas */}
      <section id="section-findings" className="lg:col-span-6">
        <GlassPanel className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              {(
                [
                  ["findings", "Live State Projection"],
                  ["graph", "System Graph"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={cn(
                    "border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-colors",
                    tab === id
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-white/10 text-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 font-mono text-[10px] text-muted">
              <span
                className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  isSyncing ? "bg-accent animate-pulse-orange" : "bg-white/20",
                )}
                aria-hidden="true"
              />
              Last synced {formatRelativeTime(lastSyncedAt, now)}
            </div>
          </div>

          {tab === "findings" ? (
            <FindingsView state={state} isActive={isActive} />
          ) : (
            <SystemGraph state={state} />
          )}
        </GlassPanel>
      </section>

      {/* Right — Intelligence Layer */}
      <aside className="space-y-8 lg:col-span-3">
        <div id="section-aries" />
        <div id="section-alerts" />
        <div id="section-remediation" />
        <IntelligenceLayer state={state} alerts={alerts} />
      </aside>
    </div>
  );
}
