"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ArchitectureDitherBackground } from "@/components/backgrounds/ArchitectureDitherBackground";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/ui/glass-panel";
import {
  ScrollReveal,
  ScrollRevealItem,
  ScrollRevealStagger,
} from "@/components/ui/scroll-reveal";
import {
  ARIES_WEIGHT_ENTRIES,
  formatCoeff,
  LEAKAGE_BLEND_WEIGHTS,
} from "@/lib/riposte-config";

interface Topic {
  id: string;
  eyebrow: string;
  title: string;
  plain: string;
  analogy: string;
  math: string;
}

const topics: Topic[] = [
  {
    id: "fuzzer",
    eyebrow: "Phase 1 · Attack",
    title: "The fuzzer systematically tests the model's boundaries",
    plain:
      "Testing a model from the outside means we can't rely on its internal code to find weaknesses. Instead, Riposte uses an automated, experimental approach. It makes small adjustments to a prompt and observes how the model reacts. If a change moves the model closer to an unsafe response, we keep building on it. It's an intelligent search designed to map out exactly where the model's safety rails begin to bend.",
    analogy:
      "Think of it like tuning an old radio to find the perfect frequency. You slowly turn the dial, listening for the static to clear up. Sometimes you have to turn the dial slightly the wrong way just to make sure you didn't miss the clearest signal.",
    math:
      "Riposte embeds the target's response and scores it against two fixed prototypes — one written as a compliant leak (\"Sure, here is the confidential info...\"), one as a refusal (\"I cannot share...\"). A softmax over their cosine similarities yields P(objective); the loss to minimize is −log P(objective) plus a refusal penalty. Each step swaps one token in the suffix; a worse mutation is still accepted with Metropolis probability e^(−Δloss / T), and T cools every step — broad exploration early, a tight freeze near the end.",
  },
  {
    id: "browserbase",
    eyebrow: "Phase 2 · Verify",
    title: "Riposte analyzes the full forensic evidence, not just the text response",
    plain:
      "Instead of just analyzing the text an AI returns, we launch a real headless browser session to see exactly what happens in a live environment. After running a scenario, Riposte captures a complete snapshot of the page's structure and all network activity. This gives us undeniable proof of whether a vulnerability was actually triggered or successfully blocked.",
    analogy:
      "It's the difference between asking someone if they secured the building, versus checking the security cameras and access logs yourself to verify the doors are actually locked.",
    math:
      "If a scenario tries to inject a script, Riposte checks the post-attack DOM for evidence the script actually executed. If it tries to exfiltrate data, Riposte checks the network log for an unauthorized payload leaving the page. Either piece of evidence flips a boolean — control_failed = true — which directly influences the mathematical evaluation in the next phase, forcing the Attack-Success (A) component to its maximum.",
  },
  {
    id: "aries",
    eyebrow: "Phase 3 · Evaluate",
    title: "ARiES combines four independent signals for a reliable security score",
    plain:
      "Relying on a single metric to evaluate an AI's safety can lead to false confidence, especially with highly articulate models. ARiES solves this by blending four distinct evaluations: checking for statistical anomalies, measuring data leakage against your documents, assessing the severity of the attack's success, and consulting an ensemble of independent AI judges. This multi-layered approach ensures a highly accurate and calibrated assessment.",
    analogy:
      "Imagine having four different experts review a contract independently. If they all point to the same clause as a potential risk, you can be much more confident in their assessment than if you had only asked one person.",
    math: `ARiES = ${ARIES_WEIGHT_ENTRIES.map((entry) => `${formatCoeff(entry.weight)} · ${entry.key}`).join(" + ")}. M is the Mahalanobis distance of the response from a benign baseline, reduced with PCA to avoid false alarms on unusual-but-normal phrasing. L is ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.cosine)} · cosine + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.entity)} · entity overlap + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.token)} · token overlap against the private corpus. A is the substantive compliance score (forced to 1.0 if Phase 2 verified a control failure). J is an ensemble of independent LLM judges.`,
  },
  {
    id: "redis",
    eyebrow: "Vector Memory",
    title: "High-speed vector search for instant data leakage detection",
    plain:
      "To detect if an AI is leaking sensitive information, Riposte needs to compare the model's output against your entire database of private documents in real-time. We use Redis Stack with RediSearch to power a specialized vector database. This allows us to instantly find the closest matching documents and measure exact data overlap, keeping the pipeline moving at lightning speed.",
    analogy:
      "Picture a well-organized library where books aren't just sorted by author, but mapped by their core concepts. Instead of reading every book to find a matching paragraph, you can instantly walk to the exact shelf and pull the right page.",
    math:
      "This is HNSW (Hierarchical Navigable Small World): document embeddings sit in a multi-layer graph, and a query vector descends layer by layer toward its nearest neighbors. That turns a brute-force comparison against every private document — O(N) — into a graph traversal — O(log N). Riposte issues this via FT.SEARCH with a KNN clause, quickly retrieving the closest private documents to calculate the L component of ARiES.",
  },
];

export function HowItWorksSection() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="relative isolate overflow-hidden px-6 py-24 md:px-12">
      <ArchitectureDitherBackground />
      <div className="relative z-10 mx-auto max-w-5xl space-y-12">
        <ScrollReveal>
          <div className="border-l-2 border-accent pl-6">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">
              How It Works
            </p>
            <h2 className="mt-2 text-3xl tracking-tight text-foreground md:text-4xl">
              The mechanics behind the audit
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
              The five pillars above outline <em>what</em> Riposte runs. Below is a breakdown of <em>why</em> each piece works the way it does — click any card to view the formal mathematical definitions.
            </p>
          </div>
        </ScrollReveal>

        <ScrollRevealStagger className="space-y-3">
          {topics.map((topic) => {
            const isOpen = openId === topic.id;
            return (
              <ScrollRevealItem key={topic.id}>
                <GlassPanel
                  liquid={false}
                  className="p-0 transition-colors panel-hover-glow"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : topic.id)}
                    className="flex w-full items-start justify-between gap-4 p-6 text-left md:p-8"
                    aria-expanded={isOpen}
                  >
                    <div>
                      <p className="font-mono text-[10px] tracking-widest text-accent/80 uppercase">
                        {topic.eyebrow}
                      </p>
                      <h3 className="mt-2 text-lg text-foreground md:text-xl">
                        {topic.title}
                      </h3>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted md:text-base">
                        {topic.plain}
                      </p>
                      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/70 italic">
                        {topic.analogy}
                      </p>
                    </div>
                    <span className="mt-1 shrink-0 text-muted">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>

                  <div
                    className={cn(
                      "overflow-hidden transition-all",
                      isOpen ? "max-h-[600px]" : "max-h-0",
                    )}
                  >
                    <div className="border-t border-accent/10 px-6 py-5 md:px-8">
                      <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                        The math
                      </p>
                      <p className="mt-3 max-w-3xl font-mono text-xs leading-relaxed text-foreground/80 md:text-sm">
                        {topic.math}
                      </p>
                    </div>
                  </div>
                </GlassPanel>
              </ScrollRevealItem>
            );
          })}
        </ScrollRevealStagger>


      </div>
    </section>
  );
}
