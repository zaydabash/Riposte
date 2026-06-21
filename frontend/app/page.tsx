import { HeroSection } from "@/components/landing/hero-section";
import { ArchitectureSection } from "@/components/landing/architecture-section";
import { HowItWorksSection } from "@/components/landing/how-it-works";

export default function HomePage() {
  return (
    <main className="landing-theme">
      <HeroSection />
      <ArchitectureSection />
      <HowItWorksSection />
    </main>
  );
}
