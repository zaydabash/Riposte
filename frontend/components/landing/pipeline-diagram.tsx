import { GlassPanel } from "@/components/ui/glass-panel";
import { ArrowRight } from "lucide-react";

const steps = [
  { label: "Initialization", detail: "Target URL + Repo registered" },
  { label: "Attack", detail: "Stagehand injects T_adv payload" },
  { label: "Evaluate", detail: "Arize calculates PPL score" },
  { label: "Remediate", detail: "Claude Code opens defense PR" },
];

export function PipelineDiagram() {
  return (
    <section className="border-t border-accent/10 bg-surface px-6 py-24 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 border-l-2 border-accent pl-6">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Execution Flow
          </p>
          <h2 className="mt-2 text-3xl tracking-tight text-foreground md:text-4xl">
            Real-time pipeline
          </h2>
        </div>

        <GlassPanel className="p-8 md:p-12">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            {steps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-4 md:gap-6">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center border border-accent/30 font-mono text-xs text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-foreground">{step.label}</span>
                  </div>
                  <p className="pl-11 font-mono text-xs text-muted">
                    {step.detail}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <ArrowRight
                    className="hidden h-4 w-4 shrink-0 text-accent/50 md:block"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-accent/10 pt-8">
            <div className="relative h-1 w-full bg-accent/10">
              <div className="absolute left-0 top-0 h-full w-3/4 bg-accent" />
            </div>
            <p className="mt-4 font-mono text-xs text-muted">
              Average audit cycle: ~15 seconds · End-to-end autonomous
            </p>
          </div>
        </GlassPanel>
      </div>
    </section>
  );
}
