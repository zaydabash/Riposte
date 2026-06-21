"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PixelBackground } from "@/components/backgrounds/PixelBackground";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { useAudit } from "@/hooks/use-audit";
import type { AuditConfig } from "@/ports/audit-service";

const DEFAULT_API_URL =
  process.env.NEXT_PUBLIC_RIPOSTE_API_URL ?? "http://127.0.0.1:8000";

/**
 * Defensive control: validate and normalize a user/env-supplied API base URL.
 * Only http(s) schemes are permitted, and the value must be a well-formed URL.
 * Returns a sanitized, normalized URL string, or null if the input is unsafe.
 */
function sanitizeApiBaseUrl(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  // Reject control characters / whitespace embedded in the URL.
  if (/[\u0000-\u001F\u007F\s]/.test(trimmed)) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  // Enforce an allowlist of safe schemes to prevent javascript:, data:,
  // file:, etc. (mitigates SSRF/scheme-confusion vectors).
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  // Must have a hostname; embedded credentials are not allowed.
  if (!parsed.hostname || parsed.username || parsed.password) {
    return null;
  }

  // Normalize: drop fragments; return the canonical origin + path (no trailing slash).
  parsed.hash = "";
  const normalized = parsed.toString().replace(/\/+$/, "");
  return normalized;
}

/** Initial *form* values (user input state). The hook still validates on Start. */
function initialConfig(): AuditConfig {
  return {
    apiBaseUrl: sanitizeApiBaseUrl(DEFAULT_API_URL) ?? "http://127.0.0.1:8000",
    targetName: "",
    targetEndpoint: "",
    sourceRepository: "",
    maxPayloads: 10,
    pollingIntervalMs: 1000,
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
    const safeUrl = sanitizeApiBaseUrl(config.apiBaseUrl);
    if (safeUrl) refreshHealth(safeUrl);
  }, [config.apiBaseUrl, refreshHealth]);

  const handleStart = () => {
    const safeUrl = sanitizeApiBaseUrl(config.apiBaseUrl);
    if (!safeUrl) {
      // Refuse to start against an unsafe/invalid API base URL.
      return;
    }
    const safeConfig: AuditConfig = { ...config, apiBaseUrl: safeUrl };
    refreshHealth(safeUrl);
    initializeAudit(safeConfig);
  };

  const handleReset = () => {
    reset();
    setConfig((c) => {
      const safeUrl = sanitizeApiBaseUrl(c.apiBaseUrl);
      return {
        ...initialConfig(),
        apiBaseUrl: safeUrl ?? initialConfig().apiBaseUrl,
      };
    });
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