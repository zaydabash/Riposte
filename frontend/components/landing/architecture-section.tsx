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

const integrationLoops: {
  title: string;
  partners: string;
  description: string;
  formula: MathFormulaVariant;
}[] = [
  {
    title: "ARiES Verification Score",
    partners: "MiniMax",
    description:
      "Single judges and raw perplexity miss calibrated risk. Riposte computes a composite verification score from behavioral anomaly, evidence leakage, control failure, and policy-compliance judges.",
    formula: "aries",
  },
  {
    title: "Browser Verification",
    partners: "Browserbase & Stagehand",
    description:
      "ATT&CK-keyed scenarios run against the configured target. Stagehand executes declarative verification steps via structured DOM actions, captures artifact evidence, and never prompt-injects the testing agent.",
    formula: "tAdv",
  },
  {
    title: "Regression Memory",
    partners: "Redis & Claude Code",
    description:
      "Redis Vector Search indexes sanitized evidence summaries for regression detection. Verified control failures trigger Claude Code repair proposals and mandatory HITL re-verification before merge.",
    formula: "leakage",
  },
];

const pillars: {
  number: string;
  title: string;
  sponsor: string;
  formula: MathFormulaVariant;
  description: string;
}[] = [
  {
    number: "01",
    title: "Browser Verification",
    sponsor: "Browserbase & Stagehand",
    formula: "tAdv",
    description:
      "ATT&CK scenario runner with session reuse, declarative DOM steps, and artifact capture. Rate-limited via semaphores; fail-closed on live verification errors.",
  },
  {
    number: "02",
    title: "Regression Memory",
    sponsor: "Redis Stack",
    formula: "redisSearch",
    description:
      "Binary-safe vector memory for evidence summaries and private corpus embeddings. FT.SEARCH surfaces similar past control failures for continuous verification.",
  },
  {
    number: "03",
    title: "Calibrated Evaluator",
    sponsor: "MiniMax",
    formula: "aries",
    description:
      `Verification score combining behavioral anomaly, evidence leakage, control failure, and policy-compliance judges. Critical at ARiES ≥ ${CRITICAL_ARIES_THRESHOLD}.`,
  },
  {
    number: "04",
    title: "Reliability Net",
    sponsor: "Sentry",
    formula: "trace",
    description:
      "Sentry error instrumentation across the pipeline. Prompts and PII are never logged: send_default_pii=False, include_prompts=False.",
  },
  {
    number: "05",
    title: "Repair Plane",
    sponsor: "Claude Code",
    formula: "prFix",
    description:
      "Repair worker proposes defensive patches via Claude Code and opens HITL pull requests. Re-verification runs the same ATT&CK scenarios before merge.",
  },
];

const pipelineSteps = [
  {
    label: "Context Generation",
    detail: "Baseline exploration payload queued via FastAPI → attack_queue",
  },
  {
    label: "Attack Execution",
    detail: "Stagehand injects T_adv; offensive workers run concurrently",
  },
  {
    label: "Semantic Evaluation",
    detail: "eval_service computes ARiES from artifact evidence and technique rubrics",
  },
  {
    label: "HITL Remediation",
    detail: "Critical scores trigger Claude Code PR, no auto-merge",
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
              Five pillars. One loop.
            </h2>
            <p className="mt-4 font-mono text-sm text-accent">
              Riposte: Autonomous Defensive Scaffolding
            </p>
            <p className="mt-2 max-w-3xl text-lg text-foreground/90">
              A continuous security pipeline for LLM agents
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
              Symbiotic Integration Loops
            </h3>
          </ScrollReveal>
          <ScrollRevealStagger className="grid gap-4 md:grid-cols-3">
            {integrationLoops.map((loop) => (
              <ScrollRevealItem key={loop.title}>
                <GlassPanel className={`h-full p-6 ${panelHoverClass}`}>
                  <p className="font-mono text-[10px] tracking-wider text-muted uppercase">
                    {loop.partners}
                  </p>
                  <h4 className="mt-2 text-lg text-foreground">{loop.title}</h4>
                  <div className="mt-4 border-l border-accent/20 pl-4">
                    <MathFormula variant={loop.formula} />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {loop.description}
                  </p>
                </GlassPanel>
              </ScrollRevealItem>
            ))}
          </ScrollRevealStagger>
        </div>

        <div>
          <ScrollReveal>
            <h3 className="mb-8 border-l-2 border-accent pl-6 font-mono text-xs tracking-widest text-accent uppercase">
              Five Pillars
            </h3>
          </ScrollReveal>
          <ScrollRevealStagger
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            stagger={0.06}
          >
            {pillars.map((pillar) => (
              <ScrollRevealItem key={pillar.number}>
                <GlassPanel className={`group h-full p-6 ${panelHoverClass}`}>
                  <div className="mb-4 flex items-start justify-between">
                    <span className="font-mono text-xs text-accent">
                      {pillar.number}
                    </span>
                    <span className="font-mono text-[10px] tracking-wider text-muted uppercase">
                      {pillar.sponsor}
                    </span>
                  </div>
                  <h4 className="text-lg text-foreground transition-colors group-hover:text-accent">
                    {pillar.title}
                  </h4>
                  <div className="mt-4 border-l border-accent/20 pl-4">
                    <MathFormula variant={pillar.formula} />
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {pillar.description}
                  </p>
                </GlassPanel>
              </ScrollRevealItem>
            ))}
          </ScrollRevealStagger>
        </div>

        <div>
          <ScrollReveal>
            <h3 className="mb-8 border-l-2 border-accent pl-6 font-mono text-xs tracking-widest text-accent uppercase">
              Asynchronous Pipeline
            </h3>
          </ScrollReveal>
          <ScrollReveal delay={0.06}>
            <GlassPanel className="p-8 md:p-12">
              <ScrollRevealStagger
                className="grid gap-8 md:grid-cols-2 lg:grid-cols-4"
                stagger={0.07}
              >
                {pipelineSteps.map((step, index) => (
                  <ScrollRevealItem key={step.label}>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center border border-accent/30 font-mono text-xs text-accent">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-foreground">{step.label}</span>
                      </div>
                      <p className="pl-11 font-mono text-xs leading-relaxed text-muted">
                        {step.detail}
                      </p>
                    </div>
                  </ScrollRevealItem>
                ))}
              </ScrollRevealStagger>
              <ScrollReveal delay={0.2}>
                <div className="mt-10 border-t border-accent/10 pt-8">
                  <div className="relative h-1 w-full bg-accent/10">
                    <div className="absolute left-0 top-0 h-full w-full bg-accent/80" />
                  </div>
                  <p className="mt-4 font-mono text-xs text-muted">
                    Phases 1 to 3 concurrent · eval_queue → remediation_queue
                    on critical ARiES
                  </p>
                </div>
              </ScrollReveal>
            </GlassPanel>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
