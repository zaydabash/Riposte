"use client";

import { Suspense, lazy } from "react";

const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((mod) => ({
    default: mod.Dithering,
  })),
);

/** Dithering shader background scoped to the architecture section. */
export function ArchitectureDitherBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#0a0a0a]">
      <Suspense fallback={<div className="absolute inset-0 bg-[#0a0a0a]" />}>
        <div className="absolute inset-0 opacity-35 mix-blend-screen">
          <Dithering
            colorBack="#00000000"
            colorFront="#f5a623"
            shape="warp"
            type="4x4"
            speed={0.2}
            className="size-full"
            minPixelRatio={1}
          />
        </div>
      </Suspense>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0a0a0a_78%)] opacity-85" />
    </div>
  );
}
