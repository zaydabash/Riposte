import type { AuditConfig, AuditState } from "@/lib/mock-audit";

export interface AuditService {
  /**
   * Starts the audit and provides continuous state updates.
   * @param config The audit configuration parameters.
   * @param onUpdate Callback fired when the audit state changes.
   * @returns A cleanup function to cancel polling/simulation.
   */
  startAudit(
    config: AuditConfig,
    onUpdate: (state: AuditState) => void
  ): Promise<() => void>;
}
