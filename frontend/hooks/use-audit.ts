"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";
import { deriveAlerts, resetAlertDedupe, type Alert } from "@/lib/audit-selectors";
import { NetworkAuditAdapter } from "@/adapters/network-audit-adapter";
import type { AuditConfig, AuditService } from "@/ports/audit-service";
import { MAX_PAYLOADS_LIMIT } from "@/lib/riposte-config";
import { corpusLinesToList } from "@/lib/corpus-text";

const defaultAuditService = new NetworkAuditAdapter();

export type AuditPhase = "idle" | "configuring" | "running" | "failed" | "completed";

export interface UseAuditResult {
  readonly auditId: string | null;
  readonly state: RiposteAuditState | null;
  readonly phase: AuditPhase;
  readonly lastSyncedAt: number | null;
  readonly isSyncing: boolean;
  readonly error: Error | null;
  readonly alerts: readonly Alert[];
  readonly health: HealthResponse | null;
  initializeAudit: (config: AuditConfig) => void;
  reset: () => void;
  refreshHealth: (apiBaseUrl: string, authHeaders?: Record<string, string>) => void;
}

function phaseFromStatus(status: RiposteAuditState["status"]): AuditPhase {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "running"; // queued | running → active
  }
}

function validateConfig(config: AuditConfig): string | null {
  if (!config.apiBaseUrl.trim()) return "API URL is required.";
  if (!config.targetName.trim()) return "Target name is required.";
  if (!config.targetEndpoint.trim()) return "Target endpoint is required.";
  if (!config.sourceRepository.trim()) return "Source repository is required.";
  if (!(config.maxPayloads > 0)) return "Max payloads must be a positive number.";
  if (config.maxPayloads > MAX_PAYLOADS_LIMIT) {
    return `Max payloads cannot exceed ${MAX_PAYLOADS_LIMIT}.`;
  }
  if (!(config.pollingIntervalMs > 0)) return "Polling interval must be positive.";
  if (corpusLinesToList(config.privateCorpusText).length < 1) {
    return "Private corpus requires at least one line.";
  }
  if (corpusLinesToList(config.benignBaselineText).length < 2) {
    return "Benign baseline requires at least two lines.";
  }
  return null;
}

export function useAudit(service: AuditService = defaultAuditService): UseAuditResult {
  const [state, setState] = useState<RiposteAuditState | null>(null);
  const [auditId, setAuditId] = useState<string | null>(null);
  const [phase, setPhase] = useState<AuditPhase>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  // Internal, not exposed as derived UI state.
  const prevStateRef = useRef<RiposteAuditState | null>(null);
  const alertsRef = useRef<readonly Alert[]>([]);
  const subscriptionRef = useRef<{ cleanup: () => void } | null>(null);
  const auditIdRef = useRef<string | null>(null);

  const teardown = useCallback(() => {
    subscriptionRef.current?.cleanup();
    subscriptionRef.current = null;
    if (auditIdRef.current) resetAlertDedupe(auditIdRef.current);
    prevStateRef.current = null;
    alertsRef.current = [];
  }, []);

  const reset = useCallback(() => {
    teardown();
    auditIdRef.current = null;
    setState(null);
    setAuditId(null);
    setPhase("idle");
    setLastSyncedAt(null);
    setIsSyncing(false);
    setError(null);
  }, [teardown]);

  const initializeAudit = useCallback(
    (config: AuditConfig) => {
      const validationError = validateConfig(config);
      if (validationError) {
        setError(new Error(validationError));
        setPhase("failed");
        return;
      }

      teardown();
      auditIdRef.current = null;
      prevStateRef.current = null;
      alertsRef.current = [];
      setState(null);
      setAuditId(null);
      setError(null);
      setPhase("configuring");
      setIsSyncing(true);

      subscriptionRef.current = service.startAudit(
        config,
        (snapshot) => {
          // Advance the alert dedupe state machine exactly once per poll.
          const prev = prevStateRef.current;
          alertsRef.current = deriveAlerts(prev, snapshot, snapshot.audit_id);
          prevStateRef.current = snapshot;

          auditIdRef.current = snapshot.audit_id;
          setAuditId(snapshot.audit_id);
          setState(snapshot);
          setPhase(phaseFromStatus(snapshot.status));
          setLastSyncedAt(Date.now());
          setError(null);
          // Stop the in-flight pulse once a terminal status is reached.
          setIsSyncing(snapshot.status === "running" || snapshot.status === "queued");
        },
        (err) => {
          setError(err);
          setPhase("failed");
          setIsSyncing(false);
        },
      );
    },
    [service, teardown],
  );

  const refreshHealth = useCallback(
    (apiBaseUrl: string, authHeaders?: Record<string, string>) => {
      if (!service.fetchHealth || !apiBaseUrl.trim()) return;
      service
        .fetchHealth(apiBaseUrl, authHeaders)
        .then(setHealth)
        .catch(() => setHealth(null));
    },
    [service],
  );

  // Always tear down (and clear dedupe caches) on unmount.
  useEffect(() => teardown, [teardown]);

  return {
    auditId,
    state,
    phase,
    lastSyncedAt,
    isSyncing,
    error,
    alerts: alertsRef.current,
    health,
    initializeAudit,
    reset,
    refreshHealth,
  };
}
