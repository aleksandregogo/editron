import { HeroSection } from "./HeroSection"
import { FeaturesSection } from "./FeaturesSection"
import { HowItWorksSection } from "./HowItWorksSection"
import { Footer } from "./Footer"

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      {/* <Footer /> */}
    </div>
  )
} 