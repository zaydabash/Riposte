"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/ui/glass-panel";
import { LiquidButton } from "@/components/ui/liquid-button";
import { ExternalLink, GitPullRequest } from "lucide-react";

interface RemediationCardProps {
  prUrl: string;
  patchSummary: string;
}

export function RemediationCard({ prUrl, patchSummary }: RemediationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <GlassPanel className="border-vulnerable/20 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-vulnerable/30 bg-vulnerable/10">
            <GitPullRequest
              className="h-5 w-5 text-vulnerable"
              aria-hidden="true"
            />
          </div>
          <div className="flex-1">
            <p className="font-mono text-xs tracking-widest text-vulnerable uppercase">
              Remediation Triggered
            </p>
            <h3 className="mt-1 text-lg text-foreground">
              Claude Code opened defense PR
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              {patchSummary}
            </p>
            <div className="mt-6">
              <a href={prUrl} target="_blank" rel="noopener noreferrer">
                <LiquidButton size="lg" variant="secondary">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View Pull Request #42
                </LiquidButton>
              </a>
            </div>
          </div>
        </div>
      </GlassPanel>
    </motion.div>
  );
}

interface RemediationSectionProps {
  remediation: RemediationCardProps | null;
}

export function RemediationSection({ remediation }: RemediationSectionProps) {
  return (
    <AnimatePresence>
      {remediation && (
        <RemediationCard
          prUrl={remediation.prUrl}
          patchSummary={remediation.patchSummary}
        />
      )}
    </AnimatePresence>
  );
}
