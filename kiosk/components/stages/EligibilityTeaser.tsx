"use client"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

export default function EligibilityTeaser() {
  const { setStage, selectedCar, financialAnswers } = useKioskStore()

  const price = selectedCar?.price || 0
  const principal = price - financialAnswers.down_payment
  const roughMin = Math.round(principal * 0.7 / 1000) * 1000
  const roughMax = Math.round(principal * 0.9 / 1000) * 1000

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-32"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <div className="max-w-xl w-full px-8 text-center">
        <motion.div
          className="w-20 h-20 gradient-red rounded-full flex items-center justify-center mx-auto mb-8 glow-red"
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-4xl">👩‍💼</span>
        </motion.div>

        <p className="text-white/50 text-base mb-3">Based on what you've told me...</p>
        <h2 className="text-white font-bold text-3xl mb-8">Your estimated eligibility</h2>

        {/* Blurred amount — the hook */}
        <motion.div
          className="glass rounded-3xl p-10 mb-8 border border-white/10 relative overflow-hidden"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-white/40 text-sm mb-2">Estimated loan amount</p>

          <div className="relative inline-block">
            <p className="text-white font-black text-6xl blur-md select-none">
              ₹{(roughMax / 100000).toFixed(1)}L
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-2 glass rounded-xl px-4 py-2">
                <span className="text-xl">🔒</span>
                <span className="text-white/80 text-sm font-medium">Unlock your exact amount</span>
              </div>
            </div>
          </div>

          <p className="text-white/30 text-sm mt-4">Range: ₹{(roughMin/100000).toFixed(1)}L – ₹{(roughMax/100000).toFixed(1)}L</p>

          {/* Shimmer overlay */}
          <div className="absolute inset-0 shimmer pointer-events-none" />
        </motion.div>

        <motion.p
          className="text-white/50 text-base mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Just your PAN card. Takes 10 seconds. Completely secure.
        </motion.p>

        <motion.button
          onClick={() => setStage("pan_entry")}
          className="gradient-red glow-red text-white font-bold text-xl px-12 py-5 rounded-2xl w-full pulse-red"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          whileTap={{ scale: 0.97 }}
        >
          🔓 Check My Exact Eligibility
        </motion.button>

        <p className="text-white/25 text-xs mt-4">
          Your PAN is used only for credit bureau check · Not stored until you apply
        </p>
      </div>
    </motion.div>
  )
}
