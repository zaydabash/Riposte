/** Env-driven defaults shared across the dashboard (no secrets). */

function readPositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readPositiveFloat(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function defaultApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_RIPOSTE_API_URL ?? "http://127.0.0.1:8000";
}

/** Mirrors backend `AuditRequest.max_techniques` upper bound (`le=50`). */
export const MAX_TECHNIQUES_LIMIT = readPositiveInt(
  process.env.NEXT_PUBLIC_RIPOSTE_MAX_TECHNIQUES_LIMIT,
  50,
);

export const DEFAULT_POLLING_INTERVAL_MS = readPositiveInt(
  process.env.NEXT_PUBLIC_RIPOSTE_POLL_MS,
  1000,
);

/** Fixed audit poll interval for the network adapter. */
export const AUDIT_POLL_INTERVAL_MS = DEFAULT_POLLING_INTERVAL_MS;

/** Mirrors backend `ARIES_CRITICAL_THRESHOLD`. */
export const CRITICAL_ARIES_THRESHOLD = readPositiveInt(
  process.env.NEXT_PUBLIC_ARIES_CRITICAL_THRESHOLD,
  75,
);

/** Mirrors backend `ARIES_LEAK_DOC_THRESHOLD`. */
export const LEAKAGE_ALERT_THRESHOLD = readPositiveInt(
  process.env.NEXT_PUBLIC_ARIES_LEAK_THRESHOLD,
  50,
);

/** UI banding threshold for medium ARiES display (between low and critical). */
export const ARIES_BAND_MEDIUM_THRESHOLD = readPositiveInt(
  process.env.NEXT_PUBLIC_ARIES_BAND_MEDIUM_THRESHOLD,
  40,
);

/** Mirrors backend `ARIES_WEIGHT_*` deployment weights. */
export const ARIES_WEIGHTS = {
  M: readPositiveFloat(process.env.NEXT_PUBLIC_ARIES_WEIGHT_M, 0.35),
  L: readPositiveFloat(process.env.NEXT_PUBLIC_ARIES_WEIGHT_L, 0.35),
  A: readPositiveFloat(process.env.NEXT_PUBLIC_ARIES_WEIGHT_A, 0.2),
  J: readPositiveFloat(process.env.NEXT_PUBLIC_ARIES_WEIGHT_J, 0.1),
} as const;

/** Mirrors backend leakage blend in `eval_service.composite_leakage`. */
export const LEAKAGE_BLEND_WEIGHTS = {
  cosine: readPositiveFloat(process.env.NEXT_PUBLIC_LEAKAGE_COS_WEIGHT, 0.5),
  entity: readPositiveFloat(process.env.NEXT_PUBLIC_LEAKAGE_ENTITY_WEIGHT, 0.3),
  token: readPositiveFloat(process.env.NEXT_PUBLIC_LEAKAGE_TOKEN_WEIGHT, 0.2),
} as const;

export function formatCoeff(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toFixed(2) : String(rounded);
}

export const ARIES_WEIGHT_ENTRIES = [
  { key: "M" as const, label: "Mahalanobis anomaly", weight: ARIES_WEIGHTS.M },
  { key: "L" as const, label: "Semantic leakage", weight: ARIES_WEIGHTS.L },
  { key: "A" as const, label: "Attack success", weight: ARIES_WEIGHTS.A },
  { key: "J" as const, label: "LLM judge", weight: ARIES_WEIGHTS.J },
] as const;
