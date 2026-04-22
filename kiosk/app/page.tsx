"use client"
import { useKioskStore } from "@/lib/store"
import { useSession } from "@/lib/useSession"
import KotakHeader from "@/components/shared/KotakHeader"
import RoadProgress from "@/components/shared/RoadProgress"
import InfoPanel from "@/components/shared/InfoPanel"
import IdleScreen from "@/components/stages/IdleScreen"
import CarCatalog from "@/components/stages/CarCatalog"
import FinancialDiscovery from "@/components/stages/FinancialDiscovery"
import EligibilityTeaser from "@/components/stages/EligibilityTeaser"
import PANEntry from "@/components/stages/PANEntry"
import EligibilityResult from "@/components/stages/EligibilityResult"
import EMIOptimizer from "@/components/stages/EMIOptimizer"
import PhoneCapture from "@/components/stages/PhoneCapture"
import ApplicationReview from "@/components/stages/ApplicationReview"
import WaitingScreen from "@/components/stages/WaitingScreen"
import CelebrationScreen from "@/components/stages/CelebrationScreen"
import PriyaAvatar from "@/components/shared/PriyaAvatar"

export default function KioskPage() {
  const { currentStage } = useKioskStore()
  useSession()

  const renderStage = () => {
    switch (currentStage) {
      case "idle":                return <IdleScreen key="idle" />
      case "car_catalog":         return <CarCatalog key="car_catalog" />
      case "financial_discovery": return <FinancialDiscovery key="financial_discovery" />
      case "eligibility_teaser":  return <EligibilityTeaser key="eligibility_teaser" />
      case "pan_entry":           return <PANEntry key="pan_entry" />
      case "eligibility_result":  return <EligibilityResult key="eligibility_result" />
      case "emi_optimizer":       return <EMIOptimizer key="emi_optimizer" />
      case "phone_capture":       return <PhoneCapture key="phone_capture" />
      case "application_review":  return <ApplicationReview key="application_review" />
      case "waiting":             return <WaitingScreen key="waiting" />
      case "celebration":         return <CelebrationScreen key="celebration" />
      default:                    return <IdleScreen key="idle" />
    }
  }

  return (
    <main className="w-screen h-screen relative overflow-hidden bg-[#080B14]">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#0D1117] via-[#080B14] to-[#0A0510] pointer-events-none" />
      <KotakHeader />
      <div className="relative z-20 w-full h-full">
        {renderStage()}
      </div>
      <RoadProgress />
      <InfoPanel />
      <PriyaAvatar />
    </main>
  )
}
