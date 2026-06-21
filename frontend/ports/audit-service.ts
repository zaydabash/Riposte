/**
 * Port: the audit transport contract.
 *
 * Components and hooks depend only on this interface — never on `fetch` directly.
 * The MVP implementation is the HTTP-polling {@link NetworkAuditAdapter}; future
 * transports (SSE, Redis pub/sub) implement the same port.
 */

import type { HealthResponse, RiposteAuditState } from "@/lib/backend-types";

/** User-supplied fields for starting one audit. Transport uses env defaults. */
export interface AuditConfig {
  readonly targetEndpoint: string;
  readonly sourceRepository: string;
  /** One proprietary document per line — used for leakage detection. */
  readonly privateCorpusText: string;
  /** One benign on-topic response per line — fits the anomaly baseline. */
  readonly benignBaselineText: string;
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
    authHeaders?: Readonly<Record<string, string>>,
  ): Promise<HealthResponse>;
}
