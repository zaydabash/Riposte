"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditConfig, AuditState } from "@/lib/mock-audit";
import {
  createInitialAuditState,
  DEFAULT_AUDIT_CONFIG,
  FINAL_PPL,
  generatePplHistory,
  STEP_LOGS,
} from "@/lib/mock-audit";

const STEP_INTERVAL_MS = 2000;

export function useAuditSimulation() {
  const [config, setConfig] = useState<AuditConfig>(DEFAULT_AUDIT_CONFIG);
  const [audit, setAudit] = useState<AuditState>(createInitialAuditState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    intervalRef.current = null;
    elapsedRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setAudit(createInitialAuditState());
  }, [clearTimers]);

  const startAudit = useCallback(() => {
    clearTimers();
    setAudit({
      ...createInitialAuditState(),
      status: "RUNNING",
      currentStepIndex: 0,
      logs: [
        {
          id: "log-0",
          timestamp: new Date().toISOString(),
          ...STEP_LOGS[0],
        },
      ],
    });

    elapsedRef.current = setInterval(() => {
      setAudit((prev) => ({
        ...prev,
        elapsedSeconds: prev.elapsedSeconds + 1,
      }));
    }, 1000);

    let stepIndex = 0;

    intervalRef.current = setInterval(() => {
      stepIndex += 1;

      if (stepIndex >= STEP_LOGS.length) {
        clearTimers();
        setAudit((prev) => ({
          ...prev,
          status: "VULNERABLE",
          currentStepIndex: STEP_LOGS.length - 1,
          pplScore: FINAL_PPL,
          pplHistory: generatePplHistory(STEP_LOGS.length - 1),
          remediation: {
            prUrl: "https://github.com/target/bot/pull/42",
            patchSummary:
              "Adds SmoothLLM perturbation wrapper with retokenization logic to block adversarial suffix T_adv.",
          },
        }));
        return;
      }

      setAudit((prev) => ({
        ...prev,
        currentStepIndex: stepIndex,
        pplScore: generatePplHistory(stepIndex).at(-1) ?? prev.pplScore,
        pplHistory: generatePplHistory(stepIndex),
        logs: [
          ...prev.logs,
          {
            id: `log-${stepIndex}`,
            timestamp: new Date().toISOString(),
            ...STEP_LOGS[stepIndex],
          },
        ],
      }));
    }, STEP_INTERVAL_MS);
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return {
    config,
    setConfig,
    audit,
    startAudit,
    reset,
    isRunning: audit.status === "RUNNING",
  };
}
