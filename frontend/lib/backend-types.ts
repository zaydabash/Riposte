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

export interface NetworkEntry {
  readonly url: string;
  readonly method: string;
  readonly status: number;
}

/** Backend `Finding` — one evaluated verification outcome (Phase-3 output). */
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
  readonly technique_id?: string | null;
  readonly artifacts_summary?: string | null;
  readonly session_id?: string | null;
  readonly secondary_session_id?: string | null;
  readonly dom_before?: string | null;
  readonly network_log?: readonly NetworkEntry[];
  readonly control_failed?: boolean;
  readonly recommended_controls?: readonly string[];
  readonly detail?: string | null;
  readonly created_at: string; // ISO 8601 (UTC, with offset)
}

/** Backend `RemediationResult` — outcome of a HITL repair proposal. */
export interface RemediationResult {
  readonly audit_id: string;
  readonly repo_url: string;
  readonly payload: string;
  readonly aries_score: number;
  readonly status: string;
  readonly pr_url: string | null;
  readonly detail: string | null;
  readonly validation_status?: string | null;
  readonly baseline_run_id?: string | null;
  readonly technique_id?: string | null;
  readonly created_at: string; // ISO 8601
}

export type FuzzSessionStatus =
  | "queued"
  | "optimizing"
  | "attacking"
  | "evaluating"
  | "completed"
  | "error";

export interface FuzzSession {
  readonly task_id: string;
  readonly seed: string;
  readonly target_url: string;
  readonly status: FuzzSessionStatus;
  readonly generated_payload?: string | null;
  readonly initial_loss?: number | null;
  readonly final_loss?: number | null;
  readonly response?: string | null;
  readonly error?: string | null;
  readonly updated_at: string;
}

/** Backend `AuditState` — the complete snapshot returned by each poll. */
export interface RiposteAuditState {
  readonly audit_id: string;
  readonly target_name: string;
  readonly target_endpoint: string;
  readonly source_repository: string;
  readonly status: AuditStatus;
  readonly queued_payloads: number;
  readonly technique_ids?: readonly string[];
  readonly verification_mode?: VerificationMode;
  readonly baseline_run_id?: string | null;
  readonly findings: readonly Finding[];
  readonly remediations: readonly RemediationResult[];
  readonly verification_sessions?: readonly VerificationSession[];
  readonly fuzz_sessions?: readonly FuzzSession[];
  readonly created_at: string; // ISO 8601
  readonly updated_at: string; // ISO 8601
}

/** POST body for `/api/v1/audit/start` (snake_case, matches backend `AuditRequest`). */
export interface AuditRequestBody {
  readonly target_name?: string;
  readonly target_endpoint: string;
  readonly source_repository: string;
  readonly interface_type: InterfaceType;
  readonly max_techniques?: number;
  readonly max_fuzz_seeds?: number;
  readonly technique_ids?: readonly string[];
  readonly verification_mode?: "continuous" | "repair_validation";
  readonly baseline_run_id?: string | null;
  readonly private_corpus: readonly string[];
  readonly benign_baseline: readonly string[];
  readonly fuzz_seeds?: readonly string[];
}

export type VerificationMode = "continuous" | "repair_validation";

export type VerificationSessionStatus =
  | "queued"
  | "running"
  | "evaluating"
  | "completed"
  | "error";
export type VerificationStepStatus = "pending" | "running" | "completed" | "error";

export interface VerificationStepLog {
  readonly index: number;
  readonly action: string;
  readonly label: string;
  readonly status: VerificationStepStatus;
  readonly detail?: string | null;
}

export interface VerificationSession {
  readonly task_id: string;
  readonly technique_id: string;
  readonly technique_name: string;
  readonly status: VerificationSessionStatus;
  readonly live: boolean;
  readonly session_id?: string | null;
  readonly secondary_session_id?: string | null;
  readonly network_log?: readonly NetworkEntry[];
  readonly current_step_index: number;
  readonly steps: readonly VerificationStepLog[];
  readonly agent_response?: string | null;
  readonly dom_after?: string | null;
  readonly verification_status?: "pass" | "fail" | "error" | null;
  readonly error?: string | null;
  readonly started_at?: string | null;
  readonly updated_at: string;
}

/** Response of `GET /health`. */
export interface HealthResponse {
  readonly status: string;
  readonly integrations: Readonly<Record<string, boolean>>;
}
