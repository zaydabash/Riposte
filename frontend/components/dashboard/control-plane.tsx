"use client";

import {
  Activity,
  Crosshair,
  Database,
  LayoutList,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuditConfig } from "@/ports/audit-service";
import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";
import { GlassPanel } from "@/components/ui/glass-panel";
import { LiquidButton } from "@/components/ui/liquid-button";
import type { AuditPhase } from "@/hooks/use-audit";

interface ControlPlaneProps {
  config: AuditConfig;
  onConfigChange: (config: AuditConfig) => void;
  onStart: () => void;
  onReset: () => void;
  phase: AuditPhase;
  state: RiposteAuditState | null;
  health: HealthResponse | null;
  error: Error | null;
}

const NAV: ReadonlyArray<{ id: string; label: string; icon: typeof Activity }> = [
  { id: "section-findings", label: "Findings View", icon: Crosshair },
  { id: "section-aries", label: "ARiES Monitor", icon: Activity },
  { id: "section-alerts", label: "Risk Alerts", icon: ShieldAlert },
  { id: "section-remediation", label: "Remediation Queue", icon: LayoutList },
  { id: "section-config", label: "Settings", icon: Settings },
];

function scrollTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function StatusPill({
  phase,
  state,
}: {
  phase: AuditPhase;
  state: RiposteAuditState | null;
}) {
  const hasCritical = (state?.findings ?? []).some((f) => f.is_critical);
  let label = "IDLE";
  let cls = "border-white/10 text-muted bg-black/40";

  if (phase === "configuring") {
    label = "STARTING";
    cls = "border-accent/40 text-accent bg-accent/10 animate-pulse-orange";
  } else if (state?.status === "running" || state?.status === "queued") {
    label = state.status.toUpperCase();
    cls = "border-accent/40 text-accent bg-accent/10 animate-pulse-orange";
  } else if (state?.status === "failed" || phase === "failed") {
    label = "FAILED";
    cls = "border-[var(--status-vulnerable)]/50 text-[var(--status-vulnerable)] bg-[var(--status-vulnerable)]/10";
  } else if (state?.status === "completed") {
    label = hasCritical ? "VULNERABLE" : "SAFE";
    cls = hasCritical
      ? "border-[var(--status-vulnerable)]/50 text-[var(--status-vulnerable)] bg-[var(--status-vulnerable)]/10"
      : "border-[var(--status-safe)]/50 text-[var(--status-safe)] bg-[var(--status-safe)]/10";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center border px-3 py-1 font-mono text-xs tracking-widest uppercase",
        cls,
      )}
    >
      {label}
    </span>
  );
}

export function ControlPlane({
  config,
  onConfigChange,
  onStart,
  onReset,
  phase,
  state,
  health,
  error,
}: ControlPlaneProps) {
  const isActive = phase === "running" || phase === "configuring";
  const update = <K extends keyof AuditConfig>(key: K, value: AuditConfig[K]) =>
    onConfigChange({ ...config, [key]: value });

  const inputClass =
    "w-full border border-white/10 bg-black/60 px-3 py-2.5 font-mono text-sm text-foreground outline-none transition-colors focus:border-accent/50 disabled:opacity-50";
  const labelClass =
    "mb-1.5 block font-mono text-[10px] tracking-widest text-muted uppercase";

  return (
    <div className="space-y-8">
      {/* Status + nav */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Session
          </p>
          <StatusPill phase={phase} state={state} />
        </div>
        <nav className="mt-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className="flex w-full items-center gap-3 border border-transparent px-3 py-2 text-left font-mono text-xs text-muted transition-colors hover:border-white/10 hover:text-foreground"
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>
        {health && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted uppercase">
              <Database size={12} /> Integrations
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(health.integrations).map(([name, ok]) => (
                <span
                  key={name}
                  className="flex items-center gap-1.5 font-mono text-[10px] text-muted"
                >
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5",
                      ok ? "bg-[var(--status-safe)]" : "bg-white/20",
                    )}
                  />
                  {name.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Config form */}
      <GlassPanel id="section-config" className="p-6">
        <div className="mb-5 border-l-2 border-accent/40 pl-4">
          <h2 className="text-lg text-foreground">New Audit</h2>
          <p className="mt-1 font-mono text-xs text-muted">
            All fields required. No defaults applied
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="api-url" className={labelClass}>
              API URL
            </label>
            <input
              id="api-url"
              type="url"
              value={config.apiBaseUrl}
              onChange={(e) => update("apiBaseUrl", e.target.value)}
              disabled={isActive}
              className={inputClass}
              placeholder="http://127.0.0.1:8000"
            />
          </div>
          <div>
            <label htmlFor="target-name" className={labelClass}>
              Target Name
            </label>
            <input
              id="target-name"
              type="text"
              value={config.targetName}
              onChange={(e) => update("targetName", e.target.value)}
              disabled={isActive}
              className={inputClass}
              placeholder="Demo Support Bot"
            />
          </div>
          <div>
            <label htmlFor="target-endpoint" className={labelClass}>
              Target Endpoint
            </label>
            <input
              id="target-endpoint"
              type="url"
              value={config.targetEndpoint}
              onChange={(e) => update("targetEndpoint", e.target.value)}
              disabled={isActive}
              className={inputClass}
              placeholder="https://target-agent.com"
            />
          </div>
          <div>
            <label htmlFor="source-repo" className={labelClass}>
              Source Repository
            </label>
            <input
              id="source-repo"
              type="url"
              value={config.sourceRepository}
              onChange={(e) => update("sourceRepository", e.target.value)}
              disabled={isActive}
              className={inputClass}
              placeholder="https://github.com/target/bot"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="max-payloads" className={labelClass}>
                Max Payloads
              </label>
              <input
                id="max-payloads"
                type="number"
                min={1}
                max={50}
                value={config.maxPayloads}
                onChange={(e) => update("maxPayloads", Number(e.target.value))}
                disabled={isActive}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="poll-interval" className={labelClass}>
                Poll (ms)
              </label>
              <input
                id="poll-interval"
                type="number"
                min={250}
                step={250}
                value={config.pollingIntervalMs}
                onChange={(e) =>
                  update("pollingIntervalMs", Number(e.target.value))
                }
                disabled={isActive}
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <p className="border border-[var(--status-vulnerable)]/40 bg-[var(--status-vulnerable)]/10 px-3 py-2 font-mono text-xs text-[var(--status-vulnerable)]">
              {error.message}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <LiquidButton
              size="lg"
              onClick={onStart}
              disabled={isActive}
              className="flex-1"
            >
              {isActive ? "Audit Running…" : "Start New Audit"}
            </LiquidButton>
            <LiquidButton variant="secondary" size="lg" onClick={onReset}>
              Reset
            </LiquidButton>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
