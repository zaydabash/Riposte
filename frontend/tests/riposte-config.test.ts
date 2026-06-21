import { describe, expect, it } from "vitest";

import {
  ARIES_BAND_MEDIUM_THRESHOLD,
  ARIES_WEIGHTS,
  AUDIT_POLL_INTERVAL_MS,
  CRITICAL_ARIES_THRESHOLD,
  DEFAULT_POLLING_INTERVAL_MS,
  LEAKAGE_ALERT_THRESHOLD,
  LEAKAGE_BLEND_WEIGHTS,
  MAX_TECHNIQUES_LIMIT,
  defaultApiBaseUrl,
} from "@/lib/riposte-config";

describe("riposte-config", () => {
  it("exposes positive numeric defaults", () => {
    expect(DEFAULT_POLLING_INTERVAL_MS).toBeGreaterThan(0);
    expect(AUDIT_POLL_INTERVAL_MS).toBe(DEFAULT_POLLING_INTERVAL_MS);
    expect(MAX_TECHNIQUES_LIMIT).toBeGreaterThan(0);
    expect(CRITICAL_ARIES_THRESHOLD).toBeGreaterThan(0);
    expect(ARIES_BAND_MEDIUM_THRESHOLD).toBeGreaterThan(0);
    expect(LEAKAGE_ALERT_THRESHOLD).toBeGreaterThan(0);
  });

  it("exposes ARiES weight defaults that sum to ~1", () => {
    const sum =
      ARIES_WEIGHTS.M + ARIES_WEIGHTS.L + ARIES_WEIGHTS.A + ARIES_WEIGHTS.J;
    expect(sum).toBeCloseTo(1, 2);
  });

  it("exposes leakage blend defaults that sum to ~1", () => {
    const sum =
      LEAKAGE_BLEND_WEIGHTS.cosine +
      LEAKAGE_BLEND_WEIGHTS.entity +
      LEAKAGE_BLEND_WEIGHTS.token;
    expect(sum).toBeCloseTo(1, 2);
  });

  it("defaultApiBaseUrl returns an http origin", () => {
    const url = defaultApiBaseUrl();
    expect(url.startsWith("http://") || url.startsWith("https://")).toBe(true);
  });
});
