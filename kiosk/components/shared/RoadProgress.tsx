"use client"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { STAGE_PROGRESS } from "@/lib/types"

const STAGES_ON_ROAD = [
  { label: "Start", progress: 0 },
  { label: "Car", progress: 15 },
  { label: "Budget", progress: 35 },
  { label: "Check", progress: 50 },
  { label: "Offer", progress: 65 },
  { label: "Apply", progress: 88 },
  { label: "🏠", progress: 100 },
]

export default function RoadProgress() {
  const { currentStage, selectedCar } = useKioskStore()
  const progress = STAGE_PROGRESS[currentStage]

  if (currentStage === "idle") return null

  return (
    <div className="absolute bottom-0 left-0 right-0 h-28 z-10">
      {/* Road surface */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0D1117] to-transparent">
        <div className="absolute bottom-6 left-0 right-0 h-10 bg-[#161B22] rounded-t-xl overflow-hidden">
          {/* Road markings */}
          <div className="absolute top-1/2 left-0 right-0 flex gap-6 -translate-y-1/2 px-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="h-0.5 w-8 bg-white/20 rounded flex-shrink-0"
                animate={{ x: [0, -100] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear", delay: i * 0.08 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Waypoint dots on road */}
      <div className="absolute bottom-8 left-12 right-12 h-0.5 bg-white/10">
        {STAGES_ON_ROAD.map((s) => (
          <div
            key={s.progress}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
            style={{ left: `${s.progress}%` }}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                progress >= s.progress ? "bg-[#E31837] shadow-[0_0_8px_rgba(227,24,55,0.8)]" : "bg-white/20"
              }`}
            />
            <span className="text-white/30 text-[9px] whitespace-nowrap mt-1">{s.label}</span>
          </div>
        ))}

        {/* Progress line */}
        <motion.div
          className="absolute top-0 left-0 h-full bg-[#E31837]/60"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />

        {/* Car icon moving along road */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2"
          animate={{ left: `${Math.max(progress - 2, 0)}%` }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        >
          <motion.div
            className="text-2xl -translate-y-6"
            animate={{ y: [-24, -28, -24] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            🚗
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
