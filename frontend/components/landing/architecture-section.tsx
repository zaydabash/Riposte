"use client";

import Link from "next/link";
import { ArchitectureDitherBackground } from "@/components/backgrounds/ArchitectureDitherBackground";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MathFormula, type MathFormulaVariant } from "@/components/ui/math-formula";
import { CRITICAL_ARIES_THRESHOLD } from "@/lib/riposte-config";
import {
  ScrollReveal,
  ScrollRevealItem,
  ScrollRevealStagger,
} from "@/components/ui/scroll-reveal";

const coreEngineComponents: {
  number: string;
  title: string;
  subtitle: string;
  formula: MathFormulaVariant;
  formula2?: MathFormulaVariant;
  description: string;
}[] = [
  {
    number: "01",
    title: "The Fuzzer",
    subtitle: "Stochastic Token-Swap Optimization",
    formula: "crossEntropy",
    formula2: "simulatedAnnealing",
    description:
      "Since Riposte is a Black Box attacker without gradient access, it appends a sequence of random tokens to a malicious prompt. It measures the Cross-Entropy Loss against semantic prototypes via Cosine Similarity. Simulated Annealing uses the Metropolis probability to accept \"worse\" mutations, allowing the fuzzer to explore the search space broadly before freezing into a global minimum.",
  },
  {
    number: "02",
    title: "ARiES Core Mathematics",
    subtitle: "Calibrated Risk Evaluation",
    formula: "aries",
    description:
      "M (Anomaly): Uses Hotelling's T² + SPE residual to catch out-of-distribution hallucinations. L (Leakage): Uses the Overlap Coefficient for strict lexical grounding, preventing false positives. A (Attack): Uses logarithmic scaling to penalize data dumps heavily while capping the score from blowing up to infinity. J (Judge): Uses an ensemble of MiniMax policy judges with a heuristic circuit breaker.",
  },
  {
    number: "03",
    title: "Regression Memory",
    subtitle: "Redis HNSW Vector Database",
    formula: "redisSearch",
    description:
      "To instantly compare the AI's response against millions of private documents, Redis Stack uses the Hierarchical Navigable Small World (HNSW) algorithm. By traversing a multi-layered vector graph, search complexity drops from O(N) to O(log N), retrieving the closest private documents in milliseconds.",
  },
  {
    number: "04",
    title: "Headless Execution & Observability",
    subtitle: "Browserbase & Stagehand",
    formula: "tAdv",
    description:
      "Riposte executes dynamic MITRE attack scenarios using Stagehand, which translates declarative natural language steps into robust Playwright commands. After execution, the Verification Rubric analyzes the captured DOM and network logs to ensure malicious scripts or unauthorized APIs were successfully blocked.",
  },
];

const panelHoverClass = "panel-hover-glow";

export function ArchitectureSection() {
  return (
    <section id="pillars" className="relative isolate overflow-hidden px-6 py-24 md:px-12">
      <ArchitectureDitherBackground />
      <div className="relative z-10 mx-auto max-w-7xl space-y-20">
        <ScrollReveal>
          <div className="border-l-2 border-accent pl-6">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              Architecture
            </p>
            <h2 className="mt-2 text-3xl tracking-tight text-foreground md:text-4xl">
              The Core Engine.
            </h2>
            <p className="mt-4 font-mono text-sm text-accent">
              Riposte: Autonomous Defensive Scaffolding
            </p>
            <p className="mt-2 max-w-3xl text-lg text-foreground/90">
              A continuous security pipeline for LLM agents, built on rigorous mathematical models.
            </p>
          </div>
        </ScrollReveal>

        <div className="space-y-3">
          <ScrollReveal delay={0.04}>
            <GlassPanel
              className={`p-6 md:p-8 ${panelHoverClass}`}
              liquid={false}
            >
              <h3 className="font-mono text-xs tracking-widest text-accent uppercase">
                The Problem
              </h3>
              <p className="mt-4 max-w-4xl text-sm leading-relaxed text-muted md:text-base">
                Every day, developers ship LLM-powered agents into production
                without a single adversarial test. Prompt injection is rated the
                number one risk in OWASP&apos;s LLM Top 10, yet unlike
                traditional software, there is no standard toolchain for
                testing whether your specific agent is actually vulnerable.
                Anthropic spent a year mapping real AI-enabled attacks into the
                LLM ATT&amp;CK Navigator. But knowing the attack taxonomy
                exists and knowing which attacks apply to your deployment are
                two entirely different problems.
              </p>
            </GlassPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.08}>
            <GlassPanel
              className={`p-6 md:p-8 ${panelHoverClass}`}
              liquid={false}
            >
              <h3 className="font-mono text-xs tracking-widest text-accent uppercase">
                System Overview
              </h3>
              <p className="mt-4 max-w-4xl text-sm leading-relaxed text-muted md:text-base">
                Riposte is an autonomous red-teaming and remediation framework
                built on modular Domain-Driven Design. Phases 1 to 3 (context
                generation, attack execution, and semantic evaluation) run
                concurrently through an asynchronous producer-consumer
                architecture. Decoupled worker pools communicate via{" "}
                <span className="font-mono text-accent/80">asyncio.Queue</span>
                , using semaphores for rate limiting and event flags for
                graceful degradation. Routers → Services → Repositories; no
                global singletons.
              </p>
            </GlassPanel>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <p className="max-w-4xl px-1 text-sm leading-relaxed text-muted">
              <em>
                Mapping AI-Enabled Cyber Threats: LLM ATT&amp;CK Navigator
              </em>{" "}
              by Anthropic{" "}
              <Link
                href="https://www.anthropic.com/research/attack-navigator"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-accent underline underline-offset-4 transition-colors hover:text-accent-hot"
              >
                link
              </Link>
            </p>
          </ScrollReveal>
        </div>

        <div>
          <ScrollReveal>
            <h3 className="mb-8 border-l-2 border-accent pl-6 font-mono text-xs tracking-widest text-accent uppercase">
              Mathematical &amp; Architectural Breakdown
            </h3>
          </ScrollReveal>
          <ScrollRevealStagger
            className="grid gap-4 md:grid-cols-2"
            stagger={0.06}
          >
            {coreEngineComponents.map((component) => (
              <ScrollRevealItem key={component.number}>
                <GlassPanel className={`group h-full p-6 md:p-8 ${panelHoverClass}`}>
                  <div className="mb-4 flex items-start justify-between">
                    <span className="font-mono text-xs text-accent">
                      {component.number}
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      {component.subtitle}
                    </span>
                  </div>
                  <h4 className="text-xl text-foreground transition-colors group-hover:text-accent">
                    {component.title}
                  </h4>
                  <div className="mt-6 space-y-4 border-l border-accent/20 pl-4">
                    <MathFormula variant={component.formula} />
                    {component.formula2 && <MathFormula variant={component.formula2} />}
                  </div>
                  <p className="mt-6 text-sm leading-relaxed text-muted md:text-base">
                    {component.description}
                  </p>
                </GlassPanel>
              </ScrollRevealItem>
            ))}
          </ScrollRevealStagger>
        </div>
      </div>
    </section>
  );
}
