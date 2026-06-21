/**
 * Pure derivations + diff helpers over immutable audit snapshots.
 *
 * Rules enforced here:
 * - Selectors NEVER mutate inputs (always copy before sort/filter).
 * - Insufficient inputs return `null` / `[]` — never NaN, Infinity, or fabricated
 *   defaults.
 * - Cross-poll state (alert dedupe, monotonic progress) lives in a module-scoped
 *   cache keyed by `auditId`, NOT in React state. `deriveProgress` is idempotent
 *   under repeated render calls (monotonic max); `deriveAlerts` advances a
 *   dedupe state machine and MUST be called once per poll (from the hook), not in
 *   render. Always clear the cache via {@link resetAlertDedupe} on reset/unmount.
 */

import type {
  Finding,
  RemediationResult,
  RiposteAuditState,
  Severity,
  VerificationSession,
} from "@/lib/backend-types";

// --- keys ------------------------------------------------------------------

/** Deterministic FNV-1a hash → base36, for fallback entity keys. */
export function stableHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Primary: `task_id`. Fallback: hash of created_at + payload + response. */
export function findingKey(f: Finding): string {
  if (f.task_id) return f.task_id;
  return `h:${stableHash(`${f.created_at}|${f.payload}|${f.response}`)}`;
}

/** Remediations have no task_id on the wire → hash of identifying fields. */
export function remediationKey(r: RemediationResult): string {
  return `h:${stableHash(`${r.created_at}|${r.repo_url}|${r.payload}|${r.status}`)}`;
}

// --- ordering --------------------------------------------------------------

/** Coerce an ISO timestamp to epoch ms; missing/invalid sorts last. */
export function parseCreatedAt(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Canonical display order: created_at asc, then findingKey, then original index.
 * Returns a COPY — never mutates `state.findings`.
 */
export function sortFindings(state: RiposteAuditState | null): Finding[] {
  if (!state?.findings) return [];
  return state.findings
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      const ta = parseCreatedAt(a.f.created_at);
      const tb = parseCreatedAt(b.f.created_at);
      if (ta !== tb) return ta - tb;
      const ka = findingKey(a.f);
      const kb = findingKey(b.f);
      if (ka !== kb) return ka < kb ? -1 : 1;
      return a.index - b.index;
    })
    .map((x) => x.f);
}

/** Canonical session order: technique bundle order, then task_id. */
export function sortVerificationSessions(
  state: RiposteAuditState | null,
): VerificationSession[] {
  if (!state?.verification_sessions?.length) return [];
  const order = new Map((state.technique_ids ?? []).map((id, index) => [id, index]));
  return [...state.verification_sessions].sort((a, b) => {
    const ai = order.get(a.technique_id) ?? Number.MAX_SAFE_INTEGER;
    const bi = order.get(b.technique_id) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.task_id < b.task_id ? -1 : 1;
  });
}

export function sessionKey(session: VerificationSession): string {
  return session.task_id;
}

/** Prefer the actively running session; otherwise evaluating, queued, else last. */
export function deriveActiveSessionIndex(sessions: readonly VerificationSession[]): number {
  if (sessions.length === 0) return 0;
  for (const status of ["running", "evaluating", "queued"] as const) {
    const index = sessions.findIndex((s) => s.status === status);
    if (index >= 0) return index;
  }
  return sessions.length - 1;
}

export function sessionStepProgress(session: VerificationSession): {
  completed: number;
  total: number;
  ratio: number;
} {
  const total = session.steps.length;
  if (total === 0) return { completed: 0, total: 0, ratio: 0 };
  const completed = session.steps.filter((s) => s.status === "completed").length;
  return { completed, total, ratio: completed / total };
}

// --- diffs -----------------------------------------------------------------

/** Findings present in `next` whose key was absent in `prev`. */
export function diffFindings(
  prev: RiposteAuditState | null,
  next: RiposteAuditState | null,
): Finding[] {
  if (!next?.findings) return [];
  const seen = new Set((prev?.findings ?? []).map(findingKey));
  return next.findings.filter((f) => !seen.has(findingKey(f)));
}

/** Remediations present in `next` whose key was absent in `prev`. */
export function diffRemediations(
  prev: RiposteAuditState | null,
  next: RiposteAuditState | null,
): RemediationResult[] {
  if (!next?.remediations) return [];
  const seen = new Set((prev?.remediations ?? []).map(remediationKey));
  return next.remediations.filter((r) => !seen.has(remediationKey(r)));
}

// --- scalar derivations ----------------------------------------------------

/** Highest ARiES score across findings, or null if none. */
export function deriveGlobalAries(state: RiposteAuditState | null): number | null {
  if (!state?.findings || state.findings.length === 0) return null;
  return state.findings.reduce((max, f) => Math.max(max, f.aries_score), -Infinity);
}

/** ARiES band for color coding. */
export function ariesBand(score: number | null): "empty" | "low" | "medium" | "high" {
  if (score === null) return "empty";
  if (score >= 75) return "high";
  if (score >= 40) return "medium";
  return "low";
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  safe: 1,
};

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s] ?? 0;
}

// --- module-scoped cross-poll cache ---------------------------------------

interface AuditCache {
  feed: Alert[];
  emitted: Set<string>;
  activeThreshold: Set<string>;
  maxQueued: number;
  maxProgress: number;
}

const caches = new Map<string, AuditCache>();

function cacheFor(auditId: string): AuditCache {
  let c = caches.get(auditId);
  if (!c) {
    c = { feed: [], emitted: new Set(), activeThreshold: new Set(), maxQueued: 0, maxProgress: 0 };
    caches.set(auditId, c);
  }
  return c;
}

/** Clear cross-poll caches. Call on reset() and hook unmount. */
export function resetAlertDedupe(auditId?: string): void {
  if (auditId) caches.delete(auditId);
  else caches.clear();
}

// --- progress (null-safe, monotonic, idempotent) --------------------------

/**
 * Completion ratio in [0,1], or `null` when indeterminate (no positive
 * queued_payloads or no findings array). Monotonic: never regresses on a stale
 * snapshot. Idempotent under repeated render calls (pure max updates).
 */
export function deriveProgress(
  state: RiposteAuditState | null,
  auditId: string | null,
): number | null {
  if (!state || !auditId || !state.findings) return null;
  const queued = state.queued_payloads;
  const cache = cacheFor(auditId);

  if (typeof queued === "number" && queued > cache.maxQueued) {
    cache.maxQueued = queued;
  }
  const denom = Math.max(queued ?? 0, cache.maxQueued);
  if (!(denom > 0)) return cache.maxProgress > 0 ? cache.maxProgress : null;

  const raw = Math.min(Math.max(state.findings.length / denom, 0), 1);
  cache.maxProgress = Math.max(cache.maxProgress, raw);
  return cache.maxProgress;
}

// --- alerts (union of diff + threshold, cross-poll deduped) ----------------

export type AlertType =
  | "new_finding"
  | "new_remediation"
  | "leaked_document"
  | "critical"
  | "high_leakage"
  | "audit_failed";

export interface Alert {
  readonly id: string;
  readonly type: AlertType;
  readonly severity: Severity;
  readonly title: string;
  readonly detail: string;
  readonly createdAt: string;
  readonly findingKey?: string;
}

const LEAKAGE_ALERT_THRESHOLD = 50;
const CRITICAL_ARIES_THRESHOLD = 75;

/**
 * Advance the alert feed for one poll cycle and return the full deduped feed.
 *
 * SIDE-EFFECTING: mutates the module cache's dedupe state machine. Call exactly
 * once per poll (from the hook), never in render. Threshold alerts emit once per
 * key and re-emit only after the condition clears then re-triggers; diff alerts
 * emit once when first seen.
 */
export function deriveAlerts(
  prev: RiposteAuditState | null,
  next: RiposteAuditState | null,
  auditId: string,
): Alert[] {
  const cache = cacheFor(auditId);
  if (!next) return [...cache.feed];

  const push = (alert: Alert): void => {
    if (cache.emitted.has(alert.id)) return;
    cache.emitted.add(alert.id);
    cache.feed.push(alert);
  };

  // A. Diff-based, one-shot ------------------------------------------------
  for (const f of diffFindings(prev, next)) {
    push({
      id: `${auditId}|${findingKey(f)}|new_finding`,
      type: "new_finding",
      severity: f.severity,
      title: `New finding · ${f.severity.toUpperCase()}`,
      detail: truncate(f.payload, 120),
      createdAt: f.created_at,
      findingKey: findingKey(f),
    });
  }
  for (const r of diffRemediations(prev, next)) {
    push({
      id: `${auditId}|${remediationKey(r)}|new_remediation`,
      type: "new_remediation",
      severity: "high",
      title: `Remediation · ${r.status}`,
      detail: r.pr_url ?? truncate(r.payload, 120),
      createdAt: r.created_at,
    });
  }
  // New leaked documents on findings (compare prev finding's set vs next).
  const prevLeaks = new Map<string, Set<string>>();
  for (const f of prev?.findings ?? []) {
    prevLeaks.set(findingKey(f), new Set(f.leaked_documents));
  }
  for (const f of next.findings) {
    const before = prevLeaks.get(findingKey(f)) ?? new Set<string>();
    for (const doc of f.leaked_documents) {
      if (before.has(doc)) continue;
      push({
        id: `${auditId}|${findingKey(f)}|leak:${stableHash(doc)}`,
        type: "leaked_document",
        severity: "critical",
        title: "Private data leaked",
        detail: truncate(doc, 140),
        createdAt: f.created_at,
        findingKey: findingKey(f),
      });
    }
  }

  // B. Threshold-based, persistent while condition holds -------------------
  const nowActive = new Set<string>();
  const activate = (key: string, build: () => Alert): void => {
    nowActive.add(key);
    push(build());
  };

  for (const f of next.findings) {
    const fk = findingKey(f);
    if (f.is_critical || f.aries_score >= CRITICAL_ARIES_THRESHOLD) {
      const key = `${auditId}|${fk}|critical`;
      activate(key, () => ({
        id: key,
        type: "critical",
        severity: "critical",
        title: `Critical · ARiES ${f.aries_score.toFixed(1)}`,
        detail: truncate(f.payload, 120),
        createdAt: f.created_at,
        findingKey: fk,
      }));
    }
    if (f.components.L >= LEAKAGE_ALERT_THRESHOLD) {
      const key = `${auditId}|${fk}|high_leakage`;
      activate(key, () => ({
        id: key,
        type: "high_leakage",
        severity: "high",
        title: `High leakage · L ${f.components.L.toFixed(1)}`,
        detail: truncate(f.payload, 120),
        createdAt: f.created_at,
        findingKey: fk,
      }));
    }
  }
  if (next.status === "failed") {
    const key = `${auditId}|audit|audit_failed`;
    activate(key, () => ({
      id: key,
      type: "audit_failed",
      severity: "high",
      title: "Audit failed",
      detail: "The backend reported a failed audit status.",
      createdAt: next.updated_at,
    }));
  }

  // Threshold keys that cleared become eligible to re-trigger later.
  for (const key of cache.activeThreshold) {
    if (!nowActive.has(key)) cache.emitted.delete(key);
  }
  cache.activeThreshold = nowActive;

  return sortAlerts(cache.feed);
}

function sortAlerts(feed: Alert[]): Alert[] {
  return [...feed].sort((a, b) => {
    const rb = severityRank(b.severity) - severityRank(a.severity);
    if (rb !== 0) return rb;
    return parseCreatedAt(b.createdAt) - parseCreatedAt(a.createdAt);
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// --- conceptual pipeline overlay (UI-only) ---------------------------------

export type PipelineStage = "plan" | "verify" | "evaluate" | "remember" | "repair";

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  "plan",
  "verify",
  "evaluate",
  "remember",
  "repair",
] as const;

/**
 * Conceptual overlay for the continuous verification & repair plane.
 * While running, progress follows findings count; when idle, null.
 */
export function deriveActiveStage(state: RiposteAuditState | null): PipelineStage | null {
  if (!state) return null;
  const findings = sortFindings(state);

  if (state.remediations.length > 0 && state.status === "completed") return "repair";

  if (state.status === "running") {
    if (findings.length === 0) return "plan";
    if (findings.length < state.queued_payloads) {
      const n = findings.length;
      if (n % 3 === 0) return "verify";
      if (n % 3 === 1) return "evaluate";
      return "remember";
    }
    return "repair";
  }

  if (findings.length === 0) return null;
  return "evaluate";
}
