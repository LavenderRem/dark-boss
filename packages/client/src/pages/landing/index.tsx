import { HeroSection } from './hero-section.js';
import { FeaturesSection } from './features-section.js';
import { WorkflowSection } from './workflow-section.js';

export function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <WorkflowSection />
    </main>
  );
}
