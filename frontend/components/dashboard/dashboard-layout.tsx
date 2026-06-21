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
import { VerificationConsole } from "@/components/dashboard/verification-console";
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
  const now = useNow(lastSyncedAt !== null);
  const isActive = phase === "running" || phase === "configuring";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1480px] flex-1 flex-col px-6 pb-4 md:px-10">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12 lg:grid-rows-[minmax(0,clamp(300px,40vh,480px))_minmax(0,1fr)] lg:items-stretch">
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

        <aside className="flex h-full min-h-0 max-h-full flex-col overflow-hidden lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <IntelligenceLayer state={state} alerts={alerts} compact />
        </aside>

        <section
          id="section-findings"
          className="flex min-h-0 flex-col lg:col-span-12 lg:row-start-2"
        >
          <GlassPanel className="flex min-h-[min(420px,48vh)] flex-1 flex-col overflow-hidden p-3">
            <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                Verification Console
              </p>
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

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <VerificationConsole
                state={state}
                isActive={isActive}
                verificationLiveReady={props.health?.integrations.verification_live_ready}
                compact
              />
            </div>
          </GlassPanel>
        </section>
      </div>
    </div>
  );
}
