/**
 * Port: the audit transport contract.
 *
 * Components and hooks depend only on this interface — never on `fetch` directly.
 * The MVP implementation is the HTTP-polling {@link NetworkAuditAdapter}; future
 * transports (SSE, Redis pub/sub, Arize trace bridge) implement the same port.
 */

import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";

/** Everything needed to start and poll one audit. No hidden defaults. */
export interface AuditConfig {
  /** Backend base URL, e.g. from NEXT_PUBLIC_RIPOSTE_API_URL. Required. */
  readonly apiBaseUrl: string;
  readonly targetName: string;
  readonly targetEndpoint: string;
  readonly sourceRepository: string;
  readonly maxPayloads: number;
  readonly pollingIntervalMs: number;
  readonly authHeaders?: Readonly<Record<string, string>>;
}

/** Handle returned by {@link AuditService.startAudit} for teardown. */
export interface AuditSubscription {
  readonly cleanup: () => void;
}

export interface AuditService {
  /**
   * Start an audit and begin streaming snapshots.
   *
   * Each delivered snapshot is a fresh, immutable object. `onError` is called for
   * transport/parse failures; polling continues unless `cleanup` is invoked.
   */
  startAudit(
    config: AuditConfig,
    onUpdate: (state: RiposteAuditState) => void,
    onError: (err: Error) => void,
  ): AuditSubscription;

  /** Optional integration-status probe (`GET /health`). */
  fetchHealth?(
    apiBaseUrl: string,
    authHeaders?: Readonly<Record<string, string>>,
  ): Promise<HealthResponse>;
}
