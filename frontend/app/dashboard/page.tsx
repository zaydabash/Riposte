"use client";

import Link from "next/link";
import {
  Crosshair,
  History,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import { PixelBackground } from "@/components/backgrounds/PixelBackground";
import { AuditForm } from "@/components/dashboard/audit-form";
import { AttackLog } from "@/components/dashboard/attack-log";
import { MetricsPanel } from "@/components/dashboard/metrics-panel";
import { PipelineTracker } from "@/components/dashboard/pipeline-tracker";
import { RemediationSection } from "@/components/dashboard/remediation-card";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { useAuditSimulation } from "@/hooks/use-audit-simulation";

const navTabs = [
  { title: "Overview", icon: LayoutDashboard },
  { title: "Active Audit", icon: Crosshair },
  { type: "separator" as const },
  { title: "History", icon: History },
  { title: "Settings", icon: Settings },
];

export default function DashboardPage() {
  const { config, setConfig, audit, startAudit, reset, isRunning } =
    useAuditSimulation();

  return (
    <div className="dashboard-theme relative min-h-[100dvh] overflow-x-hidden bg-background text-foreground">
      <PixelBackground />

      {/* Floating header — minimal chrome so pixels stay visible */}
      <header className="relative z-20 px-6 pt-6 md:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-mono text-sm tracking-[0.35em] text-foreground/90 md:text-base"
            >
              RIPOSTE
            </Link>
            <span className="hidden font-mono text-[10px] tracking-widest text-muted uppercase md:inline">
              Audit Console
            </span>
          </div>
          <ExpandableTabs tabs={navTabs} className="bg-black/20" />
        </div>
      </header>

      {/* Open center zone — title floats over exposed pixel field */}
      <section className="relative z-10 px-6 pt-16 pb-10 text-center md:px-10 md:pt-24 md:pb-16">
        <p className="font-mono text-[10px] tracking-[0.4em] text-muted uppercase">
          Active Session
        </p>
        <h1 className="mt-3 text-3xl tracking-tight text-foreground/95 md:text-5xl">
          Red-Team Audit Console
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted md:text-base">
          Configure targets, run the pipeline, and watch mathematical proof
          surface through the field.
        </p>
      </section>

      {/* Bento grid — asymmetric gaps so background breathes between panels */}
      <main className="relative z-10 mx-auto max-w-[1400px] px-6 pb-16 md:px-10">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          <div className="md:col-span-4 lg:col-span-3">
            <AuditForm
              config={config}
              onChange={setConfig}
              onStart={startAudit}
              onReset={reset}
              isRunning={isRunning}
            />
          </div>

          <div className="flex flex-col gap-8 md:col-span-8 md:gap-10 lg:col-span-5">
            <PipelineTracker audit={audit} />
          </div>

          <div className="md:col-span-12 lg:col-span-4">
            <MetricsPanel audit={audit} />
          </div>
        </div>

        <div className="mt-10 space-y-8 md:mt-14 md:space-y-10">
          <AttackLog logs={audit.logs} />
          <RemediationSection remediation={audit.remediation} />
        </div>
      </main>
    </div>
  );
}
