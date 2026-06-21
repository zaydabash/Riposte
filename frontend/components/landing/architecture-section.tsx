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
      "Because Riposte operates as a black-box tester without direct access to the model's underlying weights, it uses an intelligent trial-and-error approach. It introduces variations into prompts and observes the model's responses, measuring the difference using Cross-Entropy Loss and Cosine Similarity. By using an optimization technique called Simulated Annealing, Riposte occasionally accepts less optimal variations. This helps the system avoid getting stuck and ensures it thoroughly explores the full range of potential vulnerabilities.",
  },
  {
    number: "02",
    title: "ARiES Core Mathematics",
    subtitle: "Calibrated Risk Evaluation",
    formula: "aries",
    description:
      "ARiES combines four core metrics to evaluate risk. The Anomaly (M) score identifies highly unusual responses, helping us catch out-of-distribution hallucinations. The Leakage (L) score checks for data exposure by measuring overlap with your private documents. The Attack (A) score measures the severity of a successful exploit, scaling logarithmically to manage large outputs. Finally, the Judge (J) score incorporates an ensemble of secondary models to independently verify the results.",
  },
  {
    number: "03",
    title: "Regression Memory",
    subtitle: "Redis HNSW Vector Database",
    formula: "redisSearch",
    description:
      "To evaluate responses against your entire private corpus without slowing down the pipeline, we leverage Redis Stack as a high-performance vector database. By utilizing the Hierarchical Navigable Small World (HNSW) algorithm, we transform what would normally be a slow, exhaustive search into an efficient, multi-layered graph traversal. This allows the system to instantly retrieve and compare the most relevant documents in milliseconds.",
  },
  {
    number: "04",
    title: "Headless Execution & Observability",
    subtitle: "Browserbase & Stagehand",
    formula: "tAdv",
    description:
      "Riposte brings attack scenarios to life using Stagehand and Playwright to drive real, headless browser sessions. Once a scenario completes, the true analysis begins: our verification system carefully inspects the resulting page structure (DOM) and network logs. It looks for definitive proof that unauthorized scripts were prevented from running and that API calls were securely restricted.",
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
              An autonomous security pipeline for LLM agents.
            </p>
            <p className="mt-2 max-w-3xl text-lg text-foreground/90">
              Built on rigorous mathematical models and the <a href="https://attack.mitre.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">MITRE ATT&CK</a> framework.
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
                We're seeing AI agents being deployed daily, often without the necessary adversarial testing to ensure they're secure. Prompt injection is recognized as a critical vulnerability by OWASP, yet many teams lack the right tools to thoroughly stress-test their deployments before going live. While incredible research like Anthropic's LLM ATT&CK Navigator gives us a map of potential threats, translating that taxonomy into actionable insights for your specific application is where the real challenge lies.
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
                Riposte is an autonomous security pipeline designed to automatically test and strengthen your AI agents. It operates in four parallel phases: Planning creates the test cases, Verification runs live browser-based simulations, Evaluation scores the results using our ARiES metric, and finally, it generates concrete code patches to fix any identified issues. Built on robust, concurrent Python workers, the system is designed to handle network drops and rate limits gracefully, ensuring reliable performance even in complex environments.
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
