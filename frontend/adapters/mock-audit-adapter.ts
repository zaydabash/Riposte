import type { AuditService } from "../ports/audit-service";
import {
  AuditConfig,
  AuditState,
  createInitialAuditState,
  generatePplHistory,
  STEP_LOGS,
  FINAL_PPL,
} from "@/lib/mock-audit";

const STEP_INTERVAL_MS = 2000;

export class MockAuditAdapter implements AuditService {
  async startAudit(config: AuditConfig, onUpdate: (state: AuditState) => void): Promise<() => void> {
    let currentState = {
      ...createInitialAuditState(),
      status: "RUNNING" as const,
      currentStepIndex: 0,
      logs: [
        {
          id: "log-0",
          timestamp: new Date().toISOString(),
          ...STEP_LOGS[0],
        },
      ],
    };

    onUpdate(currentState);

    let stepIndex = 0;
    
    const elapsedIntervalId = setInterval(() => {
      currentState = {
        ...currentState,
        elapsedSeconds: currentState.elapsedSeconds + 1,
      };
      onUpdate(currentState);
    }, 1000);

    const stepIntervalId = setInterval(() => {
      stepIndex += 1;

      if (stepIndex >= STEP_LOGS.length) {
        clearInterval(stepIntervalId);
        clearInterval(elapsedIntervalId);
        currentState = {
          ...currentState,
          status: "VULNERABLE",
          currentStepIndex: STEP_LOGS.length - 1,
          pplScore: FINAL_PPL,
          pplHistory: generatePplHistory(STEP_LOGS.length - 1),
          remediation: {
            prUrl: "https://github.com/target/bot/pull/42",
            patchSummary:
              "Adds SmoothLLM perturbation wrapper with retokenization logic to block adversarial suffix T_adv.",
          },
        };
        onUpdate(currentState);
        return;
      }

      currentState = {
        ...currentState,
        currentStepIndex: stepIndex,
        pplScore: generatePplHistory(stepIndex).at(-1) ?? currentState.pplScore,
        pplHistory: generatePplHistory(stepIndex),
        logs: [
          ...currentState.logs,
          {
            id: `log-${stepIndex}`,
            timestamp: new Date().toISOString(),
            ...STEP_LOGS[stepIndex],
          },
        ],
      };
      onUpdate(currentState);
    }, STEP_INTERVAL_MS);

    return () => {
      clearInterval(stepIntervalId);
      clearInterval(elapsedIntervalId);
    };
  }
}
