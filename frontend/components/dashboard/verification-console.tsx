"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Globe,
  MousePointerClick,
  MonitorPlay,
  ScanSearch,
  Type,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FuzzSession, RiposteAuditState, VerificationSession } from "@/lib/backend-types";
import {
  deriveActiveSessionIndex,
  sessionKey,
  sessionStepProgress,
  sortVerificationSessions,
} from "@/lib/audit-selectors";

interface VerificationConsoleProps {
  state: RiposteAuditState | null;
  isActive: boolean;
  /** From GET /health — whether live verification can run (Browserbase + Anthropic). */
  verificationLiveReady?: boolean;
  compact?: boolean;
}

function sessionLiveLabel(
  session: VerificationSession,
  verificationLiveReady: boolean | undefined,
): string {
  if (session.live) {
    return session.session_id
      ? `Browserbase live · ${session.session_id.slice(0, 8)}`
      : "Browserbase live";
  }
  if (session.error) {
    return session.error;
  }
  if (verificationLiveReady) {
    if (session.status === "error") {
      return "Browserbase run failed — see step log and backend logs";
    }
    if (session.status === "queued" || session.status === "running") {
      return "Starting Browserbase session…";
    }
    return "This session did not complete a live Browserbase run";
  }
  return (
    "Browserbase not configured — set BROWSERBASE_API_KEY, BROWSERBASE_PROJECT_ID, " +
    "and ANTHROPIC_API_KEY in backend/.env, then restart"
  );
}

const PROGRESS_LABEL: Record<VerificationSession["status"], string> = {
  queued: "Waiting",
  running: "In browser",
  evaluating: "Scoring",
  completed: "Done",
  error: "Error",
};

const PROGRESS_CLASS: Record<VerificationSession["status"], string> = {
  queued: "border-white/20 text-muted bg-black/30",
  running: "border-accent/50 text-accent bg-accent/10",
  evaluating: "border-[var(--accent-orange)]/50 text-[var(--accent-orange)] bg-[var(--accent-orange)]/10",
  completed: "border-white/25 text-foreground/80 bg-white/5",
  error: "border-[var(--status-vulnerable)]/50 text-[var(--status-vulnerable)] bg-[var(--status-vulnerable)]/10",
};

const GRID_BORDER: Record<VerificationSession["status"], string> = {
  queued: "border-white/10",
  running: "border-accent/60 shadow-[0_0_12px_rgba(255,165,0,0.15)]",
  evaluating: "border-[var(--accent-orange)]/50",
  completed: "border-white/15",
  error: "border-[var(--status-vulnerable)]/50",
};

function controlLabel(session: VerificationSession): string | null {
  if (session.status === "queued" || session.status === "running") return null;
  if (!session.verification_status) return "Pending";
  if (session.verification_status === "pass") return "Control OK";
  if (session.verification_status === "fail") return "Control failed";
  return "Run error";
}

function controlClass(session: VerificationSession): string {
  if (session.verification_status === "pass") {
    return "border-[var(--status-safe)]/40 text-[var(--status-safe)] bg-[var(--status-safe)]/10";
  }
  if (session.verification_status === "fail") {
    return "border-[var(--status-vulnerable)]/40 text-[var(--status-vulnerable)] bg-[var(--status-vulnerable)]/10";
  }
  return "border-white/15 text-muted bg-black/30";
}

function stepIcon(action: string) {
  switch (action) {
    case "navigate":
      return Globe;
    case "fill":
      return Type;
    case "click":
      return MousePointerClick;
    case "extract":
    case "snapshot":
      return ScanSearch;
    case "wait":
      return Timer;
    default:
      return MonitorPlay;
  }
}

export function VerificationConsole({
  state,
  isActive,
  verificationLiveReady,
  compact = false,
}: VerificationConsoleProps) {
  const sessions = sortVerificationSessions(state);
  const fuzzSessions = state?.fuzz_sessions ?? [];
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
            ? "Waiting for verification sessions — scenarios appear here as Browserbase runs."
            : "Start a verification run to watch Browserbase execute ATT&CK scenarios."}
        </p>
      </div>
    );
  }

  const session = sessions[Math.min(selectedIndex, sessions.length - 1)];

  return (
    <div className="flex h-full min-h-[220px] flex-col gap-3">
      <SessionActivityGrid
        sessions={sessions}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          manualRef.current = true;
          setSelectedIndex(index);
        }}
      />
      <FuzzActivityStrip sessions={fuzzSessions} />
      <SessionCarouselHeader
        sessions={sessions}
        selectedIndex={selectedIndex}
        onSelect={(index) => {
          manualRef.current = true;
          setSelectedIndex(index);
        }}
      />
      <SessionConsole
        session={session}
        verificationLiveReady={verificationLiveReady}
        compact={compact}
      />
    </div>
  );
}

const FUZZ_LABEL: Record<FuzzSession["status"], string> = {
  queued: "Queued",
  optimizing: "Optimizing",
  attacking: "Target",
  evaluating: "Scoring",
  completed: "Done",
  error: "Error",
};

function FuzzActivityStrip({ sessions }: { sessions: readonly FuzzSession[] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="border border-white/10 bg-black/20 p-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          Target fuzz probes
        </p>
        <p className="font-mono text-[10px] text-muted">
          {sessions.filter((s) => s.status === "completed").length}/{sessions.length}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
        {sessions.map((session, index) => {
          const active =
            session.status === "optimizing" ||
            session.status === "attacking" ||
            session.status === "evaluating";
          return (
            <div
              key={session.task_id}
              className={cn(
                "min-w-0 border bg-black/40 p-2",
                session.status === "error"
                  ? "border-[var(--status-vulnerable)]/50"
                  : active
                    ? "border-accent/50"
                    : "border-white/10",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] text-foreground/90">
                  FZ-{index + 1}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active && "bg-accent animate-pulse-orange",
                    session.status === "completed" && "bg-[var(--status-safe)]",
                    session.status === "queued" && "bg-white/20",
                    session.status === "error" && "bg-[var(--status-vulnerable)]",
                  )}
                />
              </div>
              <p className="mt-1 truncate font-mono text-[9px] text-muted">
                {FUZZ_LABEL[session.status]}
              </p>
              {session.final_loss != null && session.initial_loss != null && (
                <p className="mt-0.5 font-mono text-[9px] text-muted/80">
                  loss {session.initial_loss.toFixed(2)} → {session.final_loss.toFixed(2)}
                </p>
              )}
              <p className="mt-0.5 truncate font-mono text-[9px] text-muted/60">
                {session.generated_payload ?? session.seed}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionActivityGrid({
  sessions,
  selectedIndex,
  onSelect,
}: {
  sessions: readonly VerificationSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-6">
      {sessions.map((session, index) => {
        const { completed, total, ratio } = sessionStepProgress(session);
        const control = controlLabel(session);
        return (
          <button
            key={sessionKey(session)}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              "flex flex-col gap-1 border bg-black/40 p-2 text-left transition-colors",
              GRID_BORDER[session.status],
              index === selectedIndex && "ring-1 ring-accent/40",
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-[10px] text-foreground/90">
                {session.technique_id}
              </span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  session.status === "running" && "bg-accent animate-pulse-orange",
                  session.status === "evaluating" && "bg-[var(--accent-orange)] animate-pulse-orange",
                  session.status === "queued" && "bg-white/20",
                  session.status === "completed" && "bg-white/40",
                  session.status === "error" && "bg-[var(--status-vulnerable)]",
                )}
              />
            </div>
            <div className="h-1 w-full bg-white/10">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  session.status === "error"
                    ? "bg-[var(--status-vulnerable)]"
                    : session.status === "completed"
                      ? "bg-white/50"
                      : "bg-accent",
                )}
                style={{ width: `${Math.max(ratio * 100, session.status === "running" ? 8 : 0)}%` }}
              />
            </div>
            <p className="font-mono text-[9px] text-muted">
              {PROGRESS_LABEL[session.status]}
              {total > 0 ? ` · ${completed}/${total}` : ""}
            </p>
            {control && (
              <p
                className={cn(
                  "font-mono text-[9px]",
                  session.verification_status === "pass"
                    ? "text-[var(--status-safe)]"
                    : session.verification_status === "fail"
                      ? "text-[var(--status-vulnerable)]"
                      : "text-muted",
                )}
              >
                {control}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SessionCarouselHeader({
  sessions,
  selectedIndex,
  onSelect,
}: {
  sessions: readonly VerificationSession[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex < sessions.length - 1;

  return (
    <div className="flex shrink-0 items-center gap-1 border border-white/10 bg-black/20 px-2 py-1.5">
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
      <span className="ml-1 font-mono text-[10px] text-muted">
        Session {selectedIndex + 1} / {sessions.length}
      </span>
    </div>
  );
}

function SessionConsole({
  session,
  verificationLiveReady,
  compact,
}: {
  session: VerificationSession;
  verificationLiveReady?: boolean;
  compact?: boolean;
}) {
  const activeStep =
    session.steps.find((s) => s.status === "running") ??
    session.steps[session.current_step_index] ??
    session.steps[session.steps.length - 1];
  const ActiveIcon = activeStep ? stepIcon(activeStep.action) : MonitorPlay;
  const control = controlLabel(session);
  const { completed, total } = sessionStepProgress(session);

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-white/10 bg-black/40 lg:flex-row">
      <BrowserViewport
        session={session}
        activeStep={activeStep}
        ActiveIcon={ActiveIcon}
        completed={completed}
        total={total}
        compact={compact}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-white/10 lg:border-t-0 lg:border-l">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div className="min-w-0">
            <p className="font-mono text-xs text-foreground/90">
              {session.technique_id} · {session.technique_name}
            </p>
            <p className="truncate font-mono text-[10px] text-muted">
              Target Execution
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap justify-end gap-1.5">
              <span
                className={cn(
                  "border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase",
                  PROGRESS_CLASS[session.status],
                  session.status === "running" && "animate-pulse-orange",
                )}
              >
                Progress: {PROGRESS_LABEL[session.status]}
              </span>
              {control && (
                <span
                  className={cn(
                    "border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase",
                    controlClass(session),
                  )}
                >
                  Control: {control}
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] text-muted">
              {sessionLiveLabel(session, verificationLiveReady)}
            </span>
          </div>
        </div>

        <div className={cn("min-h-0 flex-1 overflow-auto px-3 py-2", compact ? "text-[10px]" : "text-xs")}>
          <p className="mb-2 font-mono text-[10px] tracking-widest text-muted uppercase">
            Step log
          </p>
          <ol className="space-y-1 font-mono">
            {session.steps.map((step) => {
              const active =
                step.status === "running" ||
                (step.index === session.current_step_index && session.status === "running");
              const StepIcon = stepIcon(step.action);
              return (
                <li
                  key={step.index}
                  className={cn(
                    "flex items-start gap-2 border-l-2 px-2 py-1",
                    active
                      ? "border-accent bg-accent/5 text-accent"
                      : step.status === "completed"
                        ? "border-white/20 text-foreground/85"
                        : step.status === "error"
                          ? "border-[var(--status-vulnerable)]/40 text-[var(--status-vulnerable)]"
                          : "border-white/10 text-muted/70",
                  )}
                >
                  <StepIcon size={12} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p>{step.label}</p>
                    {step.detail && (
                      <p className="mt-0.5 text-[10px] text-muted">{step.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {(session.agent_response || session.dom_after || session.error) && (
          <SessionOutputFooter session={session} />
        )}
      </div>
    </div>
  );
}

function SessionOutputFooter({ session }: { session: VerificationSession }) {
  const [expanded, setExpanded] = useState(false);
  const outputText = session.error ?? session.agent_response ?? session.dom_after ?? "";
  const isLong = outputText.length > 240;
  const preview = isLong && !expanded ? `${outputText.slice(0, 240)}…` : outputText;

  return (
    <div className="border-t border-white/10 px-3 py-2 font-mono text-[10px]">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="tracking-widest text-muted uppercase">
          {session.error ? "Error output" : "Full output"}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-muted transition-colors hover:text-foreground"
          >
            {expanded ? (
              <>
                Collapse <ChevronUp size={12} />
              </>
            ) : (
              <>
                Expand <ChevronDown size={12} />
              </>
            )}
          </button>
        )}
      </div>
      <div
        className={cn(
          "whitespace-pre-wrap break-words",
          session.error ? "text-[var(--status-vulnerable)]" : "text-foreground/80",
          expanded && isLong && "max-h-64 overflow-auto",
        )}
      >
        {preview}
      </div>
    </div>
  );
}

function BrowserViewport({
  session,
  activeStep,
  ActiveIcon,
  completed,
  total,
  compact,
}: {
  session: VerificationSession;
  activeStep: VerificationSession["steps"][number] | undefined;
  ActiveIcon: typeof Globe;
  completed: number;
  total: number;
  compact?: boolean;
}) {
  const isLive = session.live && session.status === "running";

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col bg-[#0a0a0c]",
        compact ? "w-full lg:w-[38%]" : "w-full lg:w-[42%]",
      )}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-[var(--status-vulnerable)]/70" />
          <span className="h-2 w-2 rounded-full bg-[var(--accent-orange)]/70" />
          <span className="h-2 w-2 rounded-full bg-[var(--status-safe)]/70" />
        </span>
        <div className="min-w-0 flex-1 truncate rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-muted">
          Target Execution
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
        {session.session_id ? (
          <iframe
            title="Browserbase Live View"
            src={`https://www.browserbase.com/sessions/${session.session_id}/debug`}
            className="h-full w-full rounded border border-white/10 bg-black/50"
            allow="clipboard-read; clipboard-write"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        ) : (
          <>
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full border",
                session.status === "running"
                  ? "border-accent/50 bg-accent/10 text-accent animate-pulse-orange"
                  : session.status === "evaluating"
                    ? "border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]"
                    : "border-white/15 bg-black/40 text-muted",
              )}
            >
              <ActiveIcon size={24} />
            </div>
            <div>
              <p className="font-mono text-xs text-foreground/90">
                {activeStep?.label ?? "Waiting to start"}
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted">
                {session.status === "running"
                  ? `Browserbase executing step ${completed + 1} of ${total || "?"}`
                  : session.status === "evaluating"
                    ? "Browser finished — ARiES scoring in progress"
                    : session.status === "queued"
                      ? "Queued for verification worker"
                      : session.status === "completed"
                        ? "Browser run finished"
                        : "Session error"}
              </p>
            </div>
            {total > 0 && (
              <div className="flex items-center gap-1.5">
                {session.steps.map((step) => (
                  <span
                    key={step.index}
                    className={cn(
                      "h-2 w-2 rounded-full transition-colors",
                      step.status === "completed" && "bg-[var(--status-safe)]",
                      step.status === "running" && "bg-accent animate-pulse-orange",
                      step.status === "error" && "bg-[var(--status-vulnerable)]",
                      step.status === "pending" && "bg-white/15",
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
