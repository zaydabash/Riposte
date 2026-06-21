/** Small, pure presentation helpers. Return "—" rather than fabricate values. */

import type { Severity } from "@/lib/backend-types";

export function formatRelativeTime(epochMs: number | null, nowMs: number): string {
  if (epochMs === null) return "—";
  const deltaSec = Math.max(0, Math.round((nowMs - epochMs) / 1000));
  if (deltaSec < 1) return "just now";
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const min = Math.floor(deltaSec / 60);
  if (min < 60) return `${min}m ${deltaSec % 60}s ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
}

export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return "—";
  return score.toFixed(1);
}

/** Tailwind text-color class per severity, sourced from theme tokens. */
export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-[var(--status-vulnerable)]",
  high: "text-[var(--accent-orange-hot)]",
  medium: "text-[var(--accent-orange)]",
  low: "text-foreground/70",
  safe: "text-[var(--status-safe)]",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-[var(--status-vulnerable)]/50",
  high: "border-[var(--accent-orange-hot)]/40",
  medium: "border-[var(--accent-orange)]/40",
  low: "border-white/10",
  safe: "border-[var(--status-safe)]/40",
};
