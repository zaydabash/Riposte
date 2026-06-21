"use client";

import { GlassPanel } from "@/components/ui/glass-panel";
import type { AttackLogEntry } from "@/lib/mock-audit";
import { cn } from "@/lib/utils";

interface AttackLogProps {
  logs: AttackLogEntry[];
}

export function AttackLog({ logs }: AttackLogProps) {
  return (
    <GlassPanel className="p-6">
      <div className="mb-6 border-l-2 border-white/20 pl-4">
        <h2 className="text-lg text-foreground">Attack Log</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          Payload injection and response feed
        </p>
      </div>

      {logs.length === 0 ? (
        <div className="border border-white/10 px-6 py-12 text-center">
          <p className="font-mono text-sm text-muted">
            No audit running. Start an audit to see live attack logs.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 font-mono text-xs tracking-widest text-muted uppercase">
                <th className="pb-3 pr-4">Time</th>
                <th className="pb-3 pr-4">Payload</th>
                <th className="pb-3 pr-4">Response</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-white/5 transition-colors hover:bg-white/5"
                >
                  <td className="py-4 pr-4 font-mono text-xs text-muted whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="max-w-xs py-4 pr-4 font-mono text-xs text-foreground">
                    <span className="line-clamp-2">{log.payload}</span>
                  </td>
                  <td className="max-w-xs py-4 pr-4 font-mono text-xs text-muted">
                    <span className="line-clamp-2">{log.response}</span>
                  </td>
                  <td className="py-4">
                    <span
                      className={cn(
                        "font-mono text-xs uppercase",
                        log.status === "success" && "text-safe",
                        log.status === "pending" && "text-foreground/70",
                        log.status === "failed" && "text-vulnerable",
                      )}
                    >
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassPanel>
  );
}
