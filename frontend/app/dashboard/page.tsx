"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelBackground } from "@/components/backgrounds/PixelBackground";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useAudit } from "@/hooks/use-audit";
import type { AuditConfig } from "@/ports/audit-service";

/** Initial form values (user input state). The hook validates on Start. */
function initialConfig(): AuditConfig {
  return {
    targetEndpoint: "",
    sourceRepository: "",
    privateCorpusText: "",
    benignBaselineText: "",
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

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const handleStart = () => {
    refreshHealth();
    initializeAudit(config);
  };

  const handleReset = () => {
    reset();
    setConfig(initialConfig());
  };

  return (
    <div className="dashboard-theme relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <PixelBackground />

      <header className="relative z-20 shrink-0 px-6 pt-5 md:px-10">
        <div className="mx-auto w-full max-w-[1480px]">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-mono text-sm tracking-[0.35em] text-foreground/90"
            >
              RIPOSTE
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col pt-8">
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
