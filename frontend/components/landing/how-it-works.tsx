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
    eyebrow: "Adversarial Search",
    title: "The fuzzer can't see inside the model — so it experiments instead",
    plain:
      "A white-box attacker can backpropagate through the target's weights to compute the exact tokens that maximize error. Riposte never has that access — it only sees what the target says back. So it treats the search as trial and error: try a suffix, see the response, keep the change if it moved the response closer to compliance.",
    analogy:
      "Like tuning a dial blindfolded: turn it, listen to what happens, and keep turning the same way if it's working. The twist is that Riposte also accepts a worse-sounding turn every so often, on purpose — otherwise it gets stuck on the first local trap it finds instead of the real weak spot.",
    math:
      "Riposte embeds the target's response and scores it against two fixed prototypes — one written as a compliant leak (\"Sure, here is the confidential info...\"), one as a refusal (\"I cannot share...\"). A softmax over their cosine similarities yields P(objective); the loss to minimize is −log P(objective) plus a refusal penalty. Each step swaps one token in the suffix; a worse mutation is still accepted with Metropolis probability e^(−Δloss / T), and T cools every step — broad exploration early, a tight freeze near the end.",
  },
  {
    id: "aries",
    eyebrow: "Phase 3 · Evaluate",
    title: "ARiES blends four signals because no single one is reliable alone",
    plain:
      "Raw perplexity and a single LLM judge both break against fluent, well-written attacks. ARiES instead combines four independent checks — does the response look statistically abnormal, did it actually repeat something we said was private, did the target comply instead of refusing, and what does an independent judge think — into one calibrated score.",
    analogy:
      "Four witnesses who didn't talk to each other, asked the same question. If they all point the same way, you can trust the answer a lot more than any one of them alone.",
    math: `ARiES = ${ARIES_WEIGHT_ENTRIES.map((entry) => `${formatCoeff(entry.weight)} · ${entry.key}`).join(" + ")}. M is the Mahalanobis distance of the response from a benign baseline, reduced with PCA — Mahalanobis instead of plain Euclidean distance because the benign "cloud" of normal answers is an elliptical shape, not a sphere, so distance has to account for the data's own spread to avoid false alarms on unusual-but-normal phrasing. L is ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.cosine)} · cosine + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.entity)} · entity overlap + ${formatCoeff(LEAKAGE_BLEND_WEIGHTS.token)} · token overlap against the private corpus — cosine alone hallucinates similarity between sentences that just sound alike, so entity and token overlap force strict lexical grounding. A is near zero on a refusal and rises with how substantively the target complied. J is an ensemble of independent LLM judges.`,
  },
  {
    id: "redis",
    eyebrow: "Vector Memory",
    title: "Redis isn't just a cache here — it's the vector lookup that makes leakage detection fast",
    plain:
      "Most people know Redis as a simple key-value cache for session IDs. Riposte runs Redis Stack with the RediSearch module instead, turning it into a vector database that can instantly check a response against an entire private corpus.",
    analogy:
      "Picture a multi-layered transit map for vectors: the top layer has a handful of long-distance express routes, and each layer below gets denser with short, local connections. A lookup drops in at the top, greedily hops to the closest express stop, then descends a layer and repeats — landing on the answer in a few hops instead of checking every single stop.",
    math:
      "This is HNSW (Hierarchical Navigable Small World): document embeddings sit in a multi-layer graph, and a query vector descends layer by layer toward its nearest neighbors. That turns a brute-force comparison against every private document — O(N) — into a graph traversal — O(log N). Riposte issues this via FT.SEARCH with a KNN clause, retrieving the closest private documents in milliseconds.",
  },
  {
    id: "browserbase",
    eyebrow: "Phase 2 · Verify",
    title: "Riposte doesn't just read the reply — it reads the evidence",
    plain:
      "Browserbase hosts the real headless browser session the verification scenario runs in. After each scenario, Riposte pulls a forensic dump — the DOM before the attack, the DOM after, and the full network log — rather than trusting the model's own account of what happened.",
    analogy:
      "If a witness says \"nothing happened,\" you don't just take their word for it — you check the security footage and the phone records.",
    math:
      "If a scenario tries to inject a script, Riposte checks the post-attack DOM for evidence the script actually executed. If it tries to exfiltrate data, Riposte checks the network log for an unauthorized payload leaving the page. Either piece of evidence flips a boolean — control_failed = true — which forces the Attack-Success (A) component to its maximum, flagging the run as a confirmed control failure rather than a suspected one.",
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
