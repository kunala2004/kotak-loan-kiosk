"use client"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { STAGE_PROGRESS } from "@/lib/types"
import TTSToggle from "./TTSToggle"

export default function AppHeader() {
  const { currentStage } = useKioskStore()
  const progress = STAGE_PROGRESS[currentStage]
  const showProgress = currentStage !== "idle"

  return (
    <div className="absolute top-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 gradient-red rounded-xl flex items-center justify-center glow-red">
          <span className="text-white font-black text-lg">C</span>
        </div>
        <div>
          <p className="text-white font-bold text-lg leading-none">Car Loan</p>
          <p className="text-white/40 text-xs">Kiosk</p>
        </div>
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <div className="flex-1 mx-12">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/40 text-xs">Your Journey</span>
            <span className="text-white/60 text-xs font-medium">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-red rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Right side */}
      <div className="flex items-center gap-4">
        <TTSToggle />
        <div className="text-right">
          <p className="text-white/30 text-xs">Powered by AI</p>
          <p className="text-white/50 text-xs font-medium">Priya is here to help</p>
        </div>
      </div>
    </div>
  )
}
