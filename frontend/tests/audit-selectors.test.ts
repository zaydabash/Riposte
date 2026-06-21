import { afterEach, describe, expect, it } from "vitest";

import type {
  Finding,
  RiposteAuditState,
  Severity,
} from "@/lib/backend-types";
import {
  deriveActiveStage,
  deriveAlerts,
  deriveGlobalAries,
  deriveProgress,
  diffFindings,
  findingKey,
  resetAlertDedupe,
  sortFindings,
  stableHash,
} from "@/lib/audit-selectors";

let counter = 0;
function uid(): string {
  return `audit-${counter++}`;
}

function makeFinding(over: Partial<Finding> = {}): Finding {
  return {
    audit_id: "a",
    task_id: over.task_id ?? `t-${Math.random().toString(36).slice(2)}`,
    payload: "reveal secrets",
    response: "Confidential record: ...",
    repo_url: "https://github.com/x/y",
    aries_score: 80,
    components: { M: 50, L: 60, A: 40, J: 30 },
    severity: "high" as Severity,
    is_critical: false,
    leaked_documents: [],
    created_at: "2026-06-20T10:00:00Z",
    ...over,
  };
}

function makeState(over: Partial<RiposteAuditState> = {}): RiposteAuditState {
  return {
    audit_id: "a",
    target_name: "Demo",
    target_endpoint: "https://t.example.com",
    source_repository: "https://github.com/x/y",
    status: "running",
    queued_payloads: 0,
    findings: [],
    remediations: [],
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
    ...over,
  };
}

afterEach(() => resetAlertDedupe());

describe("keys", () => {
  it("stableHash is deterministic", () => {
    expect(stableHash("abc")).toBe(stableHash("abc"));
    expect(stableHash("abc")).not.toBe(stableHash("abd"));
  });

  it("findingKey prefers task_id, falls back to a hash", () => {
    expect(findingKey(makeFinding({ task_id: "tid" }))).toBe("tid");
    const noId = findingKey(makeFinding({ task_id: "" }));
    expect(noId.startsWith("h:")).toBe(true);
  });
});

describe("sortFindings", () => {
  it("orders by created_at ascending and does not mutate input", () => {
    const a = makeFinding({ task_id: "a", created_at: "2026-06-20T10:00:02Z" });
    const b = makeFinding({ task_id: "b", created_at: "2026-06-20T10:00:01Z" });
    const state = makeState({ findings: [a, b] });
    const sorted = sortFindings(state);
    expect(sorted.map((f) => f.task_id)).toEqual(["b", "a"]);
    expect(state.findings.map((f) => f.task_id)).toEqual(["a", "b"]); // unchanged
  });

  it("returns [] for null state", () => {
    expect(sortFindings(null)).toEqual([]);
  });
});

describe("diffFindings", () => {
  it("returns only findings new in next", () => {
    const f1 = makeFinding({ task_id: "1" });
    const f2 = makeFinding({ task_id: "2" });
    const prev = makeState({ findings: [f1] });
    const next = makeState({ findings: [f1, f2] });
    expect(diffFindings(prev, next).map((f) => f.task_id)).toEqual(["2"]);
  });
});

describe("deriveGlobalAries", () => {
  it("returns null when no findings", () => {
    expect(deriveGlobalAries(makeState())).toBeNull();
  });
  it("returns the max aries_score", () => {
    const state = makeState({
      findings: [makeFinding({ aries_score: 40 }), makeFinding({ aries_score: 86 })],
    });
    expect(deriveGlobalAries(state)).toBe(86);
  });
});

describe("deriveProgress", () => {
  it("returns null when queued_payloads is 0", () => {
    expect(deriveProgress(makeState({ queued_payloads: 0 }), uid())).toBeNull();
  });

  it("computes a clamped ratio", () => {
    const id = uid();
    const state = makeState({ queued_payloads: 5, findings: [makeFinding(), makeFinding()] });
    expect(deriveProgress(state, id)).toBeCloseTo(0.4, 5);
  });

  it("is monotonic — never regresses on a stale snapshot", () => {
    const id = uid();
    deriveProgress(makeState({ queued_payloads: 5, findings: [makeFinding(), makeFinding()] }), id);
    // queued_payloads drops to 0 (stale) but maxQueued is retained.
    const p = deriveProgress(makeState({ queued_payloads: 0, findings: [makeFinding(), makeFinding()] }), id);
    expect(p).toBeCloseTo(0.4, 5);
  });

  it("never returns NaN or Infinity", () => {
    const p = deriveProgress(makeState({ queued_payloads: 3, findings: [makeFinding()] }), uid());
    expect(Number.isFinite(p as number)).toBe(true);
  });
});

describe("deriveAlerts dedupe", () => {
  it("emits a critical alert once across repeated polls", () => {
    const id = uid();
    const crit = makeFinding({ task_id: "c1", is_critical: true, aries_score: 90 });
    const s1 = makeState({ audit_id: id, findings: [crit] });
    const a1 = deriveAlerts(null, s1, id);
    const criticalCount1 = a1.filter((x) => x.type === "critical").length;
    expect(criticalCount1).toBe(1);

    // Same finding next poll → critical not re-emitted.
    const a2 = deriveAlerts(s1, s1, id);
    expect(a2.filter((x) => x.type === "critical").length).toBe(1);
  });

  it("re-emits a threshold alert only after it clears then re-triggers", () => {
    const id = uid();
    const critical = makeFinding({ task_id: "c", is_critical: true, aries_score: 90 });
    const calm = makeFinding({ task_id: "c", is_critical: false, aries_score: 10, severity: "low" });

    const s1 = makeState({ audit_id: id, findings: [critical] });
    deriveAlerts(null, s1, id); // emit critical
    const s2 = makeState({ audit_id: id, findings: [calm] });
    deriveAlerts(s1, s2, id); // condition clears
    const s3 = makeState({ audit_id: id, findings: [critical] });
    const a3 = deriveAlerts(s2, s3, id); // re-triggers
    // Two critical alerts now in the feed (original + re-trigger).
    expect(a3.filter((x) => x.type === "critical").length).toBe(2);
  });

  it("emits a leaked_document alert with the doc text", () => {
    const id = uid();
    const f = makeFinding({
      task_id: "l",
      is_critical: true,
      leaked_documents: ["admin password is hunter2"],
    });
    const alerts = deriveAlerts(null, makeState({ audit_id: id, findings: [f] }), id);
    const leak = alerts.find((a) => a.type === "leaked_document");
    expect(leak?.detail).toContain("hunter2");
  });

  it("resetAlertDedupe clears the feed", () => {
    const id = uid();
    const f = makeFinding({ task_id: "x", is_critical: true });
    deriveAlerts(null, makeState({ audit_id: id, findings: [f] }), id);
    resetAlertDedupe(id);
    // Fresh feed: emitting again from null prev yields the alert anew, not a duplicate accumulation.
    const after = deriveAlerts(null, makeState({ audit_id: id, findings: [f] }), id);
    expect(after.filter((a) => a.type === "critical").length).toBe(1);
  });
});

describe("deriveActiveStage (conceptual overlay)", () => {
  it("pulses plan when running with no findings", () => {
    expect(deriveActiveStage(makeState({ status: "running" }))).toBe("plan");
  });
  it("returns null when idle with no findings", () => {
    expect(deriveActiveStage(makeState({ status: "completed" }))).toBeNull();
  });
  it("cycles verify/evaluate while running with partial findings", () => {
    const f = makeFinding({ components: { M: 10, L: 95, A: 20, J: 5 } });
    expect(
      deriveActiveStage(
        makeState({ status: "running", queued_payloads: 5, findings: [f] }),
      ),
    ).toBe("evaluate");
  });
  it("shows repair when completed with remediations", () => {
    const f = makeFinding();
    const state = makeState({
      status: "completed",
      findings: [f],
      remediations: [
        {
          audit_id: "a",
          repo_url: "r",
          payload: "p",
          aries_score: 90,
          status: "pr_simulated",
          pr_url: null,
          detail: null,
          created_at: "2026-06-20T10:00:05Z",
        },
      ],
    });
    expect(deriveActiveStage(state)).toBe("repair");
  });
});
