"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { GlassFilter } from "@/components/ui/glass-filter";

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: "div" | "section" | "article";
  liquid?: boolean;
}

export function GlassPanel({
  className,
  as: Component = "div",
  liquid = true,
  children,
  ...props
}: GlassPanelProps) {
  if (!liquid) {
    return (
      <Component className={cn("glass-panel", className)} {...props}>
        {children}
      </Component>
    );
  }

  return (
    <Component
      className={cn("relative overflow-hidden glass-panel liquid-glass-panel", className)}
      {...props}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 shadow-[0_0_6px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.08),inset_3px_3px_0.5px_-3px_rgba(0,0,0,0.9),inset_-3px_-3px_0.5px_-3px_rgba(0,0,0,0.85),inset_1px_1px_1px_-0.5px_rgba(0,0,0,0.6),inset_-1px_-1px_1px_-0.5px_rgba(0,0,0,0.6),inset_0_0_6px_6px_rgba(0,0,0,0.12),inset_0_0_2px_2px_rgba(0,0,0,0.06),0_0_12px_rgba(255,255,255,0.08)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 isolate -z-10 overflow-hidden"
        style={{ backdropFilter: 'url("#container-glass")' }}
        aria-hidden="true"
      />
      <div className="relative z-10 flex h-full min-h-0 flex-col">{children}</div>
      <GlassFilter />
    </Component>
  );
}
