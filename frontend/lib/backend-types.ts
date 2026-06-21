/**
 * Frontend mirror of the backend domain models.
 *
 * SOURCE OF TRUTH: backend/src/core/models.py (exposed at
 * http://127.0.0.1:8000/openapi.json). Field names, enum values, and shapes MUST
 * match the backend exactly — never invent UI-only fields or enums here.
 *
 * All shapes are `readonly` to enforce snapshot immutability: once a poll assigns
 * a snapshot to hook state it must not be mutated in place.
 */

/** Backend `AuditStatus` enum. */
export type AuditStatus = "queued" | "running" | "completed" | "failed";

/** Backend `Severity` enum. */
export type Severity = "safe" | "low" | "medium" | "high" | "critical";

/** Backend `InterfaceType` enum (only one supported value). */
export type InterfaceType = "web-ui";

/** Backend `AriesComponents` — the four calibrated sub-scores (each 0–100). */
export interface AriesComponents {
  readonly M: number;
  readonly L: number;
  readonly A: number;
  readonly J: number;
}

/** Backend `Finding` — one fully evaluated attack (Phase-3 output). */
export interface Finding {
  readonly audit_id: string;
  readonly task_id: string;
  readonly payload: string;
  readonly response: string;
  readonly repo_url: string;
  readonly aries_score: number;
  readonly components: AriesComponents;
  readonly severity: Severity;
  readonly is_critical: boolean;
  readonly leaked_documents: readonly string[];
  readonly created_at: string; // ISO 8601 (UTC, with offset)
}

/** Backend `RemediationResult` — outcome of a HITL Claude Code remediation. */
export interface RemediationResult {
  readonly audit_id: string;
  readonly repo_url: string;
  readonly payload: string;
  readonly aries_score: number;
  readonly status: string; // e.g. "pr_created" | "pr_simulated" | "failed"
  readonly pr_url: string | null;
  readonly detail: string | null;
  readonly created_at: string; // ISO 8601
}

/** Backend `AuditState` — the complete snapshot returned by each poll. */
export interface RiposteAuditState {
  readonly audit_id: string;
  readonly target_name: string;
  readonly target_endpoint: string;
  readonly source_repository: string;
  readonly status: AuditStatus;
  readonly queued_payloads: number;
  readonly findings: readonly Finding[];
  readonly remediations: readonly RemediationResult[];
  readonly created_at: string; // ISO 8601
  readonly updated_at: string; // ISO 8601
}

/** POST body for `/api/v1/audit/start` (snake_case, matches backend `AuditRequest`). */
export interface AuditRequestBody {
  readonly target_name: string;
  readonly target_endpoint: string;
  readonly source_repository: string;
  readonly interface_type: InterfaceType;
  readonly max_payloads: number;
}

/** Response of `GET /health`. */
export interface HealthResponse {
  readonly status: string;
  readonly integrations: Readonly<Record<string, boolean>>;
}
