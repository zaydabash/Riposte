"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiposteAuditState, VerificationSession } from "@/lib/backend-types";
import {
  deriveActiveSessionIndex,
  sessionKey,
  sortVerificationSessions,
} from "@/lib/audit-selectors";

interface VerificationConsoleProps {
  state: RiposteAuditState | null;
  isActive: boolean;
  compact?: boolean;
}

const SESSION_STATUS_CLASS: Record<VerificationSession["status"], string> = {
  queued: "text-muted",
  running: "text-accent animate-pulse-orange",
  completed: "text-[var(--status-safe)]",
  error: "text-[var(--status-vulnerable)]",
};

const STEP_STATUS_SYMBOL: Record<
  VerificationSession["steps"][number]["status"],
  string
> = {
  pending: "○",
  running: "▸",
  completed: "✓",
  error: "✕",
};

export function VerificationConsole({
  state,
  isActive,
  compact = false,
}: VerificationConsoleProps) {
  const sessions = sortVerificationSessions(state);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const manualRef = useRef(false);

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedIndex(0);
      manualRef.current = false;
      return;
    }
    if (!isActive || manualRef.current) {
      setSelectedIndex((prev) => Math.min(prev, sessions.length - 1));
      return;
    }
    setSelectedIndex(deriveActiveSessionIndex(sessions));
  }, [state?.verification_sessions, state?.updated_at, isActive, sessions.length]);

  if (sessions.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full min-h-[160px] flex-col items-center justify-center gap-2 border border-dashed border-white/10 text-center",
          compact ? "p-4" : "gap-3 p-10",
        )}
      >
        <MonitorPlay className="text-muted" size={compact ? 22 : 28} />
        <p className={cn("font-mono text-muted", compact ? "text-xs" : "text-sm")}>
          {isActive
            ? "Waiting for Browserbase sessions — scenarios appear here as verification starts."
            : "Start a verification run to watch Browserbase execute ATT&CK scenarios."}
        </p>
      </div>
    );
  }

  const session = sessions[Math.min(selectedIndex, sessions.length - 1)];

  return (
    <div className="flex h-full min-h-[220px] flex-col gap-3">
      <SessionCarouselHeader
        sessions={sessions}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          manualRef.current = true;
          setSelectedIndex(index);
        }}
        compact={compact}
      />
      <SessionConsole session={session} compact={compact} />
    </div>
  );
}

function SessionCarouselHeader({
  sessions,
  selectedIndex,
  onSelect,
  compact,
}: {
  sessions: readonly VerificationSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  compact?: boolean;
}) {
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex < sessions.length - 1;

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border border-white/10 bg-black/20 px-2 py-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous session"
          disabled={!canPrev}
          onClick={() => onSelect(selectedIndex - 1)}
          className="border border-white/10 p-1 text-muted transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          aria-label="Next session"
          disabled={!canNext}
          onClick={() => onSelect(selectedIndex + 1)}
          className="border border-white/10 p-1 text-muted transition-colors hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight size={14} />
        </button>
        <span className="ml-2 font-mono text-[10px] text-muted">
          Session {selectedIndex + 1} / {sessions.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {sessions.map((s, index) => (
          <button
            key={sessionKey(s)}
            type="button"
            aria-label={`${s.technique_id} session`}
            onClick={() => onSelect(index)}
            className={cn(
              "border px-2 py-0.5 font-mono text-[10px] transition-colors",
              index === selectedIndex
                ? "border-accent/50 bg-accent/10 text-accent"
                : "border-white/10 text-muted hover:text-foreground",
            )}
          >
            {s.technique_id}
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionConsole({
  session,
  compact,
}: {
  session: VerificationSession;
  compact?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col border border-white/10 bg-black/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-foreground/90">
            {session.technique_id} · {session.technique_name}
          </p>
          <p className="truncate font-mono text-[10px] text-muted">
            {session.fixture_url}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className={SESSION_STATUS_CLASS[session.status]}>
            {session.status.toUpperCase()}
          </span>
          <span className="text-muted">{session.live ? "LIVE" : "SIM"}</span>
          {session.session_id && (
            <span className="truncate text-muted">bb:{session.session_id.slice(0, 8)}</span>
          )}
          {session.verification_status && (
            <span
              className={
                session.verification_status === "pass"
                  ? "text-[var(--status-safe)]"
                  : "text-[var(--status-vulnerable)]"
              }
            >
              {session.verification_status.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-auto px-3 py-2", compact ? "text-[10px]" : "text-xs")}>
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase">
          <Terminal size={12} />
          Browserbase step trace
        </div>
        <ol className="space-y-1 font-mono">
          {session.steps.map((step) => {
            const active =
              step.index === session.current_step_index &&
              session.status === "running" &&
              step.status === "running";
            return (
              <li
                key={step.index}
                className={cn(
                  "border-l-2 px-2 py-1",
                  active
                    ? "border-accent bg-accent/5 text-accent"
                    : step.status === "completed"
                      ? "border-[var(--status-safe)]/40 text-foreground/85"
                      : step.status === "error"
                        ? "border-[var(--status-vulnerable)]/40 text-[var(--status-vulnerable)]"
                        : "border-white/10 text-muted",
                )}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 w-3 shrink-0">{STEP_STATUS_SYMBOL[step.status]}</span>
                  <div className="min-w-0 flex-1">
                    <p>{step.label}</p>
                    {step.detail && (
                      <p className="mt-0.5 text-[10px] text-muted">{step.detail}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {(session.agent_response || session.dom_after || session.error) && (
        <div className="border-t border-white/10 px-3 py-2 font-mono text-[10px]">
          {session.error ? (
            <p className="text-[var(--status-vulnerable)]">{session.error}</p>
          ) : (
            <p className="line-clamp-3 text-foreground/80">
              {session.agent_response || session.dom_after}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
