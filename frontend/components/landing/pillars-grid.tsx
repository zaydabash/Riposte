import { GlassPanel } from "@/components/ui/glass-panel";

const pillars = [
  {
    number: "01",
    title: "Attack Engine",
    sponsor: "Browserbase & Stagehand",
    math: "arg min E[L(y_target, F(T_adv ⊕ x))]",
    description:
      "Autonomous penetration tester that navigates target DOM and injects universal adversarial triggers.",
  },
  {
    number: "02",
    title: "State & Context Matrix",
    sponsor: "Redis",
    math: "arg max cos(φ(x̂), φ(x))",
    description:
      "Long-term agent memory storing payload history and pre-computed vectors for embedding inversion.",
  },
  {
    number: "03",
    title: "Scientific Evaluator",
    sponsor: "Arize",
    math: "PPL(X) = exp(−1/T Σ log p(x_t | x_<t))",
    description:
      "Mathematical referee that detects alignment breaks via perplexity spikes in API log-probs.",
  },
  {
    number: "04",
    title: "Reliability Net",
    sponsor: "Sentry",
    math: "trace(span) → observability",
    description:
      "Operational medic wrapping the pipeline with stack traces, token usage, and execution spans.",
  },
  {
    number: "05",
    title: "Autonomous Mechanic",
    sponsor: "Claude Code",
    math: "PR = fix(VULNERABLE, T_adv)",
    description:
      "Auto-remediation agent that writes SmoothLLM defenses and opens pull requests autonomously.",
  },
];

export function PillarsGrid() {
  return (
    <section id="pillars" className="bg-black px-6 py-24 md:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-16 border-l-2 border-accent pl-6">
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Architecture
          </p>
          <h2 className="mt-2 text-3xl tracking-tight text-foreground md:text-4xl">
            Five pillars. One loop.
          </h2>
          <p className="mt-4 max-w-2xl text-muted">
            Each core function is powered by a sponsor platform, ensuring
            scientific rigor and production-grade reliability.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <GlassPanel
              key={pillar.number}
              className="group p-6 transition-colors hover:border-accent/40"
            >
              <div className="mb-4 flex items-start justify-between">
                <span className="font-mono text-xs text-accent">
                  {pillar.number}
                </span>
                <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                  {pillar.sponsor}
                </span>
              </div>
              <h3 className="text-lg text-foreground">{pillar.title}</h3>
              <p className="mt-3 font-mono text-xs text-accent/80">
                {pillar.math}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {pillar.description}
              </p>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}
