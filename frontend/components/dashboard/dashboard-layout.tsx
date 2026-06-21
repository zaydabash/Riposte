"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { AuditConfig } from "@/ports/audit-service";
import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";
import type { Alert } from "@/lib/audit-selectors";
import type { AuditPhase } from "@/hooks/use-audit";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  AuditConfigForm,
  SessionPanel,
} from "@/components/dashboard/control-plane";
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
    <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col px-6 pb-4 md:px-10">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)] lg:items-stretch">
        <aside className="h-full lg:col-span-3 lg:row-start-1">
          <SessionPanel
            phase={phase}
            state={state}
            health={props.health}
            compact
          />
        </aside>

        <section className="h-full lg:col-span-6 lg:col-start-4 lg:row-start-1">
          <AuditConfigForm
            config={props.config}
            onConfigChange={props.onConfigChange}
            onStart={props.onStart}
            onReset={props.onReset}
            phase={phase}
            state={state}
            health={props.health}
            error={props.error}
            compact
          />
        </section>

        <aside className="lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <div id="section-aries" />
          <div id="section-alerts" />
          <div id="section-remediation" />
          <IntelligenceLayer state={state} alerts={alerts} compact />
        </aside>

        <section
          id="section-findings"
          className="flex min-h-0 flex-col lg:col-span-12 lg:row-start-2"
        >
          <GlassPanel className="flex min-h-[220px] flex-1 flex-col p-3">
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
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
                      "border px-2.5 py-1 font-mono text-[10px] tracking-wide transition-colors",
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

            <div className="min-h-0 flex-1 overflow-auto">
              {tab === "findings" ? (
                <FindingsView state={state} isActive={isActive} compact />
              ) : (
                <SystemGraph state={state} compact />
              )}
            </div>
          </GlassPanel>
        </section>
      </div>
    </div>
  );
}
