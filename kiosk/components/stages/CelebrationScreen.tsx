"use client"
import { useEffect } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

export default function CelebrationScreen() {
  const { bureauData, selectedCar, loanConfig, applicationId, phone, resetSession } = useKioskStore()
  const firstName = bureauData?.name.split(" ")[0] || "there"

  // Auto-reset after 60 seconds for next customer
  useEffect(() => {
    const t = setTimeout(() => resetSession(), 60000)
    return () => clearTimeout(t)
  }, [resetSession])

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-20 px-8 relative overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="w-[800px] h-[800px] rounded-full bg-[#E31837]/8 blur-3xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </div>

      {/* Confetti */}
      {Array.from({ length: 50 }).map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-2.5 h-2.5 rounded-sm ${
            ["bg-[#E31837]", "bg-[#F5A623]", "bg-white", "bg-blue-400", "bg-green-400"][i % 5]
          }`}
          initial={{ x: "50vw", y: "50vh", scale: 0, rotate: 0 }}
          animate={{
            x: `${10 + Math.random() * 80}vw`,
            y: `${10 + Math.random() * 70}vh`,
            scale: [0, 1.2, 0],
            rotate: Math.random() * 720,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 2 + Math.random(), delay: Math.random() * 0.8, ease: "easeOut" }}
        />
      ))}

      <div className="relative z-10 max-w-2xl w-full text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="text-8xl mb-6 block"
        >
          🎊
        </motion.div>

        <motion.h1
          className="text-white font-black text-5xl mb-3 leading-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Your car is waiting
          <span className="block text-[#E31837]">for you, {firstName} 🚗</span>
        </motion.h1>

        <motion.p
          className="text-white/70 text-xl mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Thank you and drive safely.
        </motion.p>

        {/* Offer card */}
        <motion.div
          className="glass rounded-3xl p-8 mb-8 border border-[#E31837]/40 glow-red"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7, type: "spring" }}
        >
          {selectedCar && (
            <p className="text-white/50 text-sm mb-4">
              {selectedCar.brand} {selectedCar.model} {selectedCar.variant}
            </p>
          )}

          <p className="text-white font-black text-5xl mb-4">
            ₹{((loanConfig?.approved_amount || 0) / 100000).toFixed(2)}L
          </p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Rate",   value: `${loanConfig?.rate}% p.a.` },
              { label: "EMI",    value: `₹${loanConfig?.emi?.toLocaleString()}/mo` },
              { label: "Tenure", value: `${loanConfig?.tenure_months} months` },
            ].map((i) => (
              <div key={i.label} className="glass rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs">{i.label}</p>
                <p className="text-white font-bold">{i.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Notification acknowledgement */}
        {phone && (
          <motion.div
            className="glass rounded-xl p-4 mb-8 text-left border border-green-500/20 bg-green-500/5"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">📱</span>
              <div>
                <p className="text-green-400 text-sm font-semibold">Message sent to {phone}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  A copy of your approval has been sent to your phone.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Next steps */}
        <motion.div
          className="glass rounded-2xl p-6 mb-8 text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Next Steps</p>
          {[
            { icon: "📄", step: "Complete document verification at the desk", time: "~7 min" },
            { icon: "✍️", step: "Sign your digital loan agreement",            time: "~2 min" },
            { icon: "🚗", step: "Drive home your new car!",                    time: "" },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 mb-3 last:mb-0">
              <span className="text-xl">{s.icon}</span>
              <span className="text-white/70 text-sm flex-1">{s.step}</span>
              {s.time && <span className="text-white/30 text-xs">{s.time}</span>}
            </div>
          ))}
        </motion.div>

        {applicationId && (
          <p className="text-white/20 text-xs mt-4">Application ID: {applicationId}</p>
        )}

        <button
          onClick={resetSession}
          className="text-white/20 text-xs mt-4 block mx-auto hover:text-white/40 transition-colors"
        >
          Start new session
        </button>
      </div>
    </motion.div>
  )
}
