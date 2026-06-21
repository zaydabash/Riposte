"use client";

import { GlassPanel } from "@/components/ui/glass-panel";
import { LiquidButton } from "@/components/ui/liquid-button";
import type { AuditConfig } from "@/lib/mock-audit";

interface AuditFormProps {
  config: AuditConfig;
  onChange: (config: AuditConfig) => void;
  onStart: () => void;
  onReset: () => void;
  isRunning: boolean;
}

export function AuditForm({
  config,
  onChange,
  onStart,
  onReset,
  isRunning,
}: AuditFormProps) {
  const updateField = <K extends keyof AuditConfig>(
    key: K,
    value: AuditConfig[K],
  ) => {
    onChange({ ...config, [key]: value });
  };

  const toggleAgent = (agent: keyof AuditConfig["agents"]) => {
    onChange({
      ...config,
      agents: { ...config.agents, [agent]: !config.agents[agent] },
    });
  };

  return (
    <GlassPanel className="p-6">
      <div className="mb-6 border-l-2 border-white/20 pl-4">
        <h2 className="text-lg text-foreground">New Audit</h2>
        <p className="mt-1 font-mono text-xs text-muted">
          Configure target and enable agents
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="target-url"
            className="mb-2 block font-mono text-xs tracking-widest text-muted uppercase"
          >
            Target URL
          </label>
          <input
            id="target-url"
            type="url"
            value={config.targetUrl}
            onChange={(e) => updateField("targetUrl", e.target.value)}
            disabled={isRunning}
            className="w-full border border-white/10 bg-black/60 px-4 py-3 font-mono text-sm text-foreground outline-none transition-colors focus:border-white/30 disabled:opacity-50"
            placeholder="https://target-agent.com"
          />
        </div>

        <div>
          <label
            htmlFor="repo-url"
            className="mb-2 block font-mono text-xs tracking-widest text-muted uppercase"
          >
            Repository URL
          </label>
          <input
            id="repo-url"
            type="url"
            value={config.repoUrl}
            onChange={(e) => updateField("repoUrl", e.target.value)}
            disabled={isRunning}
            className="w-full border border-white/10 bg-black/60 px-4 py-3 font-mono text-sm text-foreground outline-none transition-colors focus:border-white/30 disabled:opacity-50"
            placeholder="https://github.com/target/bot"
          />
        </div>

        <div className="space-y-2 pt-2">
          <p className="font-mono text-xs tracking-widest text-muted uppercase">
            Active Agents
          </p>
          {(
            [
              ["fuzzer", "Perplexity Fuzzer"],
              ["triggerOptimizer", "Trigger Optimizer"],
              ["embeddingInverter", "Embedding Inverter"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-3 border border-white/10 px-4 py-3 transition-colors hover:border-white/20"
            >
              <input
                type="checkbox"
                checked={config.agents[key]}
                onChange={() => toggleAgent(key)}
                disabled={isRunning}
                className="h-4 w-4 accent-neutral-400"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>

        <div className="flex gap-3 pt-4">
          <LiquidButton
            size="lg"
            onClick={onStart}
            disabled={isRunning}
            className="flex-1"
          >
            {isRunning ? "Audit Running..." : "Start Audit"}
          </LiquidButton>
          <LiquidButton
            variant="secondary"
            size="lg"
            onClick={onReset}
            disabled={isRunning}
          >
            Reset
          </LiquidButton>
        </div>
      </div>
    </GlassPanel>
  );
}
