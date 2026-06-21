import { afterEach, describe, expect, it, vi } from "vitest";

import type { RiposteAuditState } from "@/lib/backend-types";
import { NetworkAuditAdapter } from "@/adapters/network-audit-adapter";
import type { AuditConfig } from "@/ports/audit-service";

const config: AuditConfig = {
  apiBaseUrl: "http://127.0.0.1:8000",
  targetName: "Demo",
  targetEndpoint: "https://t.example.com",
  sourceRepository: "https://github.com/x/y",
  maxPayloads: 3,
  pollingIntervalMs: 10,
  privateCorpusText: "Internal API key: SK-TEST\nSalary record for Jane Doe.",
  benignBaselineText:
    "Sure, I can help you reset your password.\nOur business hours are nine to five.",
};

function snapshot(over: Partial<RiposteAuditState> = {}): RiposteAuditState {
  return {
    audit_id: "abc123",
    target_name: "Demo",
    target_endpoint: "https://t.example.com",
    source_repository: "https://github.com/x/y",
    status: "running",
    queued_payloads: 3,
    findings: [],
    remediations: [],
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-06-20T10:00:00Z",
    ...over,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

afterEach(() => vi.restoreAllMocks());

describe("NetworkAuditAdapter", () => {
  it("POSTs start then polls GET, delivering snapshots", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        const isStart = (init?.method ?? "GET") === "POST";
        return {
          ok: true,
          status: 200,
          json: async () => snapshot({ status: isStart ? "running" : "completed" }),
          text: async () => "",
        } as Response;
      }),
    );

    const updates: RiposteAuditState[] = [];
    const adapter = new NetworkAuditAdapter();
    const sub = adapter.startAudit(config, (s) => updates.push(s), () => {});

    await sleep(60);
    sub.cleanup();
    const countAtCleanup = updates.length;
    await sleep(40);

    // Start POST + at least one GET poll delivered.
    expect(calls[0]).toContain("POST http://127.0.0.1:8000/api/v1/audit/start");
    expect(calls.some((c) => c.startsWith("GET") && c.includes("/api/v1/audit/abc123"))).toBe(true);
    expect(updates.length).toBeGreaterThanOrEqual(2);
    // No further updates after cleanup.
    expect(updates.length).toBe(countAtCleanup);
  });

  it("reports start failures via onError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "boom" }) as Response),
    );
    const errors: Error[] = [];
    const adapter = new NetworkAuditAdapter();
    const sub = adapter.startAudit(config, () => {}, (e) => errors.push(e));
    await sleep(30);
    sub.cleanup();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0].message).toContain("Start failed (500)");
  });

  it("fetchHealth returns parsed integrations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", integrations: { redis_available: true } }),
        text: async () => "",
      }) as Response),
    );
    const adapter = new NetworkAuditAdapter();
    const health = await adapter.fetchHealth("http://127.0.0.1:8000");
    expect(health.integrations.redis_available).toBe(true);
  });

  it("stops polling after a terminal audit status", async () => {
    let pollCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const isStart = (init?.method ?? "GET") === "POST";
        pollCount += isStart ? 0 : 1;
        return {
          ok: true,
          status: 200,
          json: async () =>
            snapshot({
              status: isStart ? "running" : "completed",
            }),
          text: async () => "",
        } as Response;
      }),
    );

    const adapter = new NetworkAuditAdapter();
    const sub = adapter.startAudit(config, () => {}, () => {});
    await sleep(80);
    const pollsAtStop = pollCount;
    await sleep(80);
    sub.cleanup();

    expect(pollsAtStop).toBeGreaterThanOrEqual(1);
    expect(pollCount).toBe(pollsAtStop);
  });
});
