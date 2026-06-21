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
    title: "The fuzzer is flying blind—so it forces the model to slip up instead",
    plain:
      "Look, a white-box attacker has it easy. They can just backpropagate right through the target's weights to mathematically find the exact tokens that maximize error. Riposte? It never gets that kind of access. It only sees what the model spits back out. So the search basically becomes aggressive trial and error. Try a weird suffix. Check the response. If the model started to crack and got closer to compliance—keep it. Otherwise, toss it.",
    analogy:
      "Imagine trying to crack a safe while blindfolded. You turn the dial, listen for a click, and if you hear something, you keep turning that direction. The catch? Riposte will occasionally turn the dial the wrong way. On purpose. If it doesn't, it'll just get stuck on a fake click instead of finding the actual weak spot.",
    math:
      "Riposte embeds the target's response and scores it against two fixed prototypes — one written as a compliant leak (\"Sure, here is the confidential info...\"), one as a refusal (\"I cannot share...\"). A softmax over their cosine similarities yields P(objective); the loss to minimize is −log P(objective) plus a refusal penalty. Each step swaps one token in the suffix; a worse mutation is still accepted with Metropolis probability e^(−Δloss / T), and T cools every step — broad exploration early, a tight freeze near the end.",
  },
  {
    id: "browserbase",
    eyebrow: "Phase 2 · Verify",
    title: "Riposte doesn't just read the reply—it grabs the forensic evidence",
    plain:
      "We use Browserbase to host an actual, live headless browser session where the verification scenario goes down. And honestly, we don't trust the model's own account of what happened for a second. After every single scenario, Riposte aggressively pulls a full forensic dump. We're talking the DOM before the attack, the DOM after the smoke clears, and the complete network logs.",
    analogy:
      "If a sketchy witness swears to you that 'nothing happened,' you don't just smile and take their word for it. You pull the security footage. You subpoena the phone records.",
    math:
      "If a scenario tries to inject a script, Riposte checks the post-attack DOM for evidence the script actually executed. If it tries to exfiltrate data, Riposte checks the network log for an unauthorized payload leaving the page. Either piece of evidence flips a boolean — control_failed = true — which directly influences the mathematical evaluation in the next phase, forcing the Attack-Success (A) component to its maximum.",
  },
  {
    id: "aries",
    eyebrow: "Phase 3 · Evaluate",
    title: "ARiES blends four signals because trusting just one is a massive liability",
    plain:
      "Here's a hard truth: raw perplexity metrics and basic LLM judges completely fall apart when faced with a fluent, well-written attack. They just do. ARiES throws that approach out. Instead, it forcefully combines four entirely independent checks. Does the response look statistically weird? Did it actually leak the private data we flagged? Did the target pathetically comply instead of refusing? And what does an independent ensemble judge think? All of that gets smashed into one brutally calibrated score.",
    analogy:
      "Think of it as throwing four witnesses into separate interrogation rooms. They can't talk to each other. You ask them the exact same question. If they all start pointing fingers at the same guy? Yeah, you can trust that answer way more than a single confession.",
    math: `ARiES = ${ARIES_WEIGHT_ENTRIES.map((entry) => `${formatCoeff(entry.weight)} · ${entry.key}`).join(" + ")}. M is the Mahalanobis distance of the response from a benign baseline, reduced with PCA to avoid false alarms on unusual-but-normal phrasing. L is ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.cosine)} · cosine + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.entity)} · entity overlap + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.token)} · token overlap against the private corpus. A is the substantive compliance score (forced to 1.0 if Phase 2 verified a control failure). J is an ensemble of independent LLM judges.`,
  },
  {
    id: "redis",
    eyebrow: "Vector Memory",
    title: "Redis isn't a cache here—it's a high-speed vector engine hunting for leaks",
    plain:
      "Most developers think of Redis as this cute, simple key-value cache you use for session IDs. Not here. Riposte weaponizes Redis Stack by slapping the RediSearch module on top, transforming it into a full-blown vector database. It can instantly check a shady AI response against your entire private corpus—millions of documents—just to compute the exact leakage overlap we need for Phase 3.",
    analogy:
      "Picture a crazy, multi-layered subway map for vectors. The top layer only has a few massive, long-distance express routes. Each layer underneath gets wildly denser with short, local stops. A lookup drops right in at the top, greedily hops to the nearest express stop, drops down a layer, and repeats. It finds the target in a few hops instead of stopping at every single station in the city.",
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
