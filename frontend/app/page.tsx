import { HeroSection } from "@/components/landing/hero-section";
import { ArchitectureSection } from "@/components/landing/architecture-section";

export default function HomePage() {
  return (
    <main className="landing-theme">
      <HeroSection />
      <ArchitectureSection />
    </main>
  );
}
