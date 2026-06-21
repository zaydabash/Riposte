"use client";

import { cn } from "@/lib/utils";
import type { NetworkEntry } from "@/lib/backend-types";

interface NetworkTimelineProps {
  entries: readonly NetworkEntry[];
  highlightPatterns?: readonly string[];
  className?: string;
}

function entryMatches(entry: NetworkEntry, patterns: readonly string[]): boolean {
  const haystack = `${entry.url} ${entry.method} ${entry.status}`.toLowerCase();
  return patterns.some((pattern) => haystack.includes(pattern.toLowerCase()));
}

export function NetworkTimeline({
  entries,
  highlightPatterns = [],
  className,
}: NetworkTimelineProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
        Network forensics
      </p>
      <ul className="max-h-40 space-y-1 overflow-y-auto rounded border border-white/10 bg-black/40 p-2">
        {entries.map((entry, index) => {
          const highlighted =
            highlightPatterns.length > 0 && entryMatches(entry, highlightPatterns);
          return (
            <li
              key={`${entry.url}-${entry.method}-${index}`}
              className={cn(
                "rounded px-2 py-1 font-mono text-[10px]",
                highlighted
                  ? "border border-[var(--status-vulnerable)]/40 bg-[var(--status-vulnerable)]/10 text-[var(--status-vulnerable)]"
                  : "text-foreground/75",
              )}
            >
              <span className="text-muted">{entry.method}</span>{" "}
              <span className="break-all">{entry.url}</span>
              {entry.status > 0 && (
                <span className="ml-2 text-muted">· {entry.status}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
