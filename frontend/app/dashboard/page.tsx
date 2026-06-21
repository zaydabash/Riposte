"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelBackground } from "@/components/backgrounds/PixelBackground";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useAudit } from "@/hooks/use-audit";
import type { AuditConfig } from "@/ports/audit-service";

const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_RIPOSTE_API_URL ?? "http://127.0.0.1:8000";

/** Initial *form* values (user input state). The hook still validates on Start. */
function initialConfig(): AuditConfig {
  return {
    apiBaseUrl: DEFAULT_API_URL,
    targetName: "",
    targetEndpoint: "",
    sourceRepository: "",
    maxPayloads: 5,
    pollingIntervalMs: 2000,
  };
}

export default function DashboardPage() {
  const [config, setConfig] = useState<AuditConfig>(initialConfig);
  const {
    state,
    phase,
    alerts,
    health,
    error,
    lastSyncedAt,
    isSyncing,
    initializeAudit,
    reset,
    refreshHealth,
  } = useAudit();

  // Probe integration health when the API URL is known/changes.
  useEffect(() => {
    if (config.apiBaseUrl.trim()) refreshHealth(config.apiBaseUrl);
  }, [config.apiBaseUrl, refreshHealth]);

  const handleStart = () => {
    refreshHealth(config.apiBaseUrl);
    initializeAudit(config);
  };

  const handleReset = () => {
    reset();
    setConfig((c) => ({ ...initialConfig(), apiBaseUrl: c.apiBaseUrl }));
  };

  return (
    <div className="dashboard-theme relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <PixelBackground />

      <header className="relative z-20 px-6 pt-6 md:px-10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-mono text-sm tracking-[0.35em] text-foreground/90"
            >
              RIPOSTE
            </Link>
            <span className="hidden font-mono text-[10px] tracking-widest text-muted uppercase md:inline">
              Control Plane
            </span>
          </div>
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Continuous Red-Team Pipeline
          </span>
        </div>
      </header>

      <main className="relative z-10 pt-10">
        <DashboardLayout
          config={config}
          onConfigChange={setConfig}
          onStart={handleStart}
          onReset={handleReset}
          state={state}
          phase={phase}
          alerts={alerts}
          health={health}
          error={error}
          lastSyncedAt={lastSyncedAt}
          isSyncing={isSyncing}
        />
      </main>
    </div>
  );
}
