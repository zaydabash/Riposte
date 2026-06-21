"use client";

import Link from "next/link";
import { HeroShader } from "@/components/backgrounds/HeroShader";
import { LiquidButton } from "@/components/ui/liquid-button";
import { GlassPanel } from "@/components/ui/glass-panel";

export function HeroSection() {
  const scrollToPillars = () => {
    document.getElementById("pillars")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <HeroShader>
      {/* Nav */}
      <nav className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg tracking-[0.3em] text-accent">
            RIPOSTE
          </span>
          <span className="hidden font-mono text-xs text-muted md:inline">
            Continuous Red-Team Pipeline
          </span>
        </div>
        <Link
          href="/dashboard"
          className="border border-accent/20 px-4 py-2 font-mono text-xs tracking-widest text-accent uppercase transition-colors hover:border-accent/50 hover:bg-accent/5"
        >
          Console
        </Link>
      </nav>

      {/* Hero content */}
      <div className="flex min-h-screen flex-col items-center justify-center px-4 pt-20 pb-32">
        <GlassPanel className="mb-8 animate-fade-in-down px-6 py-3">
          <span className="font-mono text-xs tracking-widest text-accent uppercase">
            UC Berkeley AI Hackathon · Enterprise Red-Teaming
          </span>
        </GlassPanel>

        <div className="max-w-5xl space-y-6 text-center">
          <h1 className="animate-fade-in-up animation-delay-200 text-5xl tracking-tight text-accent md:text-7xl lg:text-8xl">
            Break the model.
          </h1>
          <h1 className="animate-fade-in-up animation-delay-400 text-5xl tracking-tight text-accent-hot md:text-7xl lg:text-8xl">
            Prove it. Patch it.
          </h1>

          <p className="animate-fade-in-up animation-delay-600 mx-auto max-w-3xl text-lg leading-relaxed text-foreground/80 md:text-xl">
            Riposte is a continuous red-teaming pipeline that autonomously
            attacks AI agents, mathematically proves alignment failures, and
            writes the defense patch — all without human judgment.
          </p>

          <div className="animate-fade-in-up animation-delay-800 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/dashboard">
              <LiquidButton size="xl">Launch Console</LiquidButton>
            </Link>
            <LiquidButton variant="secondary" size="xl" onClick={scrollToPillars}>
              View Architecture
            </LiquidButton>
          </div>
        </div>
      </div>
    </HeroShader>
  );
}
