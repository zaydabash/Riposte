import { HeroSection } from "@/components/landing/hero-section";
import { PillarsGrid } from "@/components/landing/pillars-grid";
import { PipelineDiagram } from "@/components/landing/pipeline-diagram";

export default function HomePage() {
  return (
    <main className="landing-theme">
      <HeroSection />
      <PillarsGrid />
      <PipelineDiagram />
    </main>
  );
}
