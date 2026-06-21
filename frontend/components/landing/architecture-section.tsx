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
      "Here's the thing—Riposte is operating completely blind. No gradient access. It's a pure black-box attacker. So it simply shoves random tokens onto a malicious prompt and watches what happens. It gauges Cross-Entropy Loss against these semantic prototypes using Cosine Similarity. And here's where it gets interesting: it deliberately accepts 'worse' mutations using Simulated Annealing and the Metropolis probability. Why? Because if you don't explore the weird, ugly corners of the search space first, you'll get stuck. Then it freezes into that perfect global minimum.",
  },
  {
    number: "02",
    title: "ARiES Core Mathematics",
    subtitle: "Calibrated Risk Evaluation",
    formula: "aries",
    description:
      "Let's talk M (Anomaly)—it leans on Hotelling's T² plus SPE residual to hunt down those weird, out-of-distribution hallucinations. Then there's L (Leakage), strictly enforcing lexical grounding with the Overlap Coefficient to aggressively filter out false positives. A (Attack)? It uses logarithmic scaling. It brutally penalizes massive data dumps, but smartly caps the score before it spirals into infinity. And finally, J (Judge)—an ensemble of MiniMax policy judges backed by a paranoid heuristic circuit breaker.",
  },
  {
    number: "03",
    title: "Regression Memory",
    subtitle: "Redis HNSW Vector Database",
    formula: "redisSearch",
    description:
      "Searching millions of private documents? O(N) won't cut it. To instantly compare an AI's response against your entire corpus, we hooked up Redis Stack. But not the standard cache—we're using the Hierarchical Navigable Small World (HNSW) algorithm. By jumping down through a multi-layered vector graph, the search complexity plummets to O(log N). You pull the closest private documents in milliseconds. Literally.",
  },
  {
    number: "04",
    title: "Headless Execution & Observability",
    subtitle: "Browserbase & Stagehand",
    formula: "tAdv",
    description:
      "Dynamic MITRE attack scenarios don't run themselves. Riposte fires them off using Stagehand—translating declarative, plain-English steps straight into hardened Playwright commands. But execution is cheap. The real magic happens after. The Verification Rubric rips apart the captured DOM and tears through the network logs. It's looking for absolute proof that malicious scripts or shady unauthorized APIs were completely blocked.",
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
                People just ship these LLM agents. Every single day. No adversarial testing—nothing. It&apos;s wild, honestly. Prompt injection sits right at the top of the OWASP LLM Top 10, which shouldn&apos;t shock anyone, yet we&apos;re out here building the future without a proper toolchain to see if our specific agents will crumble under pressure. Sure, Anthropic spent an entire year painstakingly mapping AI-enabled cyber threats into that massive LLM ATT&amp;CK Navigator. Great. But knowing the taxonomy exists? That&apos;s barely half the battle. Figuring out which of those attacks will actually break your deployment—that&apos;s a totally different beast.
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
                Riposte isn&apos;t just another scanner—it&apos;s an autonomous red-teaming and remediation framework built to hit hard. It tears through four parallel phases. Planning generates the fuzz seeds; Verification unleashes browser-level attacks; Evaluation runs the math with ARiES; and Remediation? It drafts the code fixes for you. They all fire concurrently across decoupled Python worker pools. And look, networks drop. Rate limits happen. When a live verification step inevitably chokes, Riposte doesn&apos;t just crash and burn. It gracefully flags the run and keeps moving.
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
