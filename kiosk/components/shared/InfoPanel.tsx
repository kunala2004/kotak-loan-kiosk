"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { INFO_PANEL_DATA } from "@/lib/types"

export default function InfoPanel() {
  const [open, setOpen] = useState(false)
  const { currentStage } = useKioskStore()
  const info = INFO_PANEL_DATA[currentStage]

  return (
    <>
      {/* Floating i button */}
      <motion.button
        onClick={() => setOpen(true)}
        className="absolute bottom-8 right-8 z-50 w-12 h-12 glass rounded-full flex items-center justify-center border border-white/20 hover:border-white/40 transition-all"
        whileTap={{ scale: 0.9 }}
        title="See what's happening"
      >
        <span className="text-white/70 font-bold text-lg">i</span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 z-50 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            {/* Side Panel */}
            <motion.div
              className="absolute right-0 top-0 bottom-0 z-50 w-[420px] glass border-l border-white/10 p-8 flex flex-col gap-6"
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-widest mb-1">Transparency</p>
                  <h3 className="text-white font-bold text-xl">What's happening right now</h3>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/50 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Active System */}
              <div className="glass rounded-2xl p-5">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Active System</p>
                <p className="text-white font-semibold text-lg">{info.system}</p>
              </div>

              {/* AI Used */}
              <div className={`rounded-2xl p-5 border ${info.aiUsed ? "border-[#F5A623]/30 bg-[#F5A623]/10" : "border-green-500/20 bg-green-500/10"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-3 h-3 rounded-full ${info.aiUsed ? "bg-[#F5A623]" : "bg-green-400"}`} />
                  <p className={`text-sm font-semibold ${info.aiUsed ? "text-[#F5A623]" : "text-green-400"}`}>
                    {info.aiUsed ? "AI Involved" : "No AI — Pure Rules"}
                  </p>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">{info.description}</p>
              </div>

              {/* Data Held */}
              <div className="glass rounded-2xl p-5">
                <p className="text-white/40 text-xs uppercase tracking-widest mb-2">Your Data Right Now</p>
                <p className="text-white/70 text-sm leading-relaxed">{info.dataHeld}</p>
              </div>

              {/* Privacy note */}
              <div className="mt-auto">
                <div className="flex items-center gap-2 text-white/30 text-xs">
                  <span>🔒</span>
                  <span>All data encrypted in transit. Session cleared when you leave.</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
