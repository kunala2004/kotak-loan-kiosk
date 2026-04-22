"use client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

export default function EligibilityResult() {
  const { eligibilityResult, bureauData, selectedCar, setStage, setLoanConfig, financialAnswers } = useKioskStore()
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 600)
    return () => clearTimeout(t)
  }, [])

  if (!eligibilityResult || !bureauData) return null

  const eligible = eligibilityResult.eligible
  const firstName = bureauData.name.split(" ")[0]

  const handleContinue = () => {
    setLoanConfig({
      approved_amount: eligibilityResult.approved_amount,
      rate: eligibilityResult.interest_rate,
      tenure_months: eligibilityResult.tenure_months,
      emi: eligibilityResult.emi,
      down_payment: financialAnswers.down_payment,
    })
    setStage("emi_optimizer")
  }

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28 px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {eligible ? (
        <div className="max-w-2xl w-full text-center">
          {/* Confetti burst on reveal */}
          {showContent && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-2 h-2 rounded-sm ${
                    ["bg-[#E31837]", "bg-[#F5A623]", "bg-white", "bg-blue-400"][i % 4]
                  }`}
                  initial={{
                    x: "50vw",
                    y: "40vh",
                    scale: 0,
                    rotate: 0,
                  }}
                  animate={{
                    x: `${20 + Math.random() * 60}vw`,
                    y: `${Math.random() * 80}vh`,
                    scale: [0, 1, 0.5],
                    rotate: Math.random() * 360,
                    opacity: [1, 1, 0],
                  }}
                  transition={{ duration: 1.5, delay: Math.random() * 0.5, ease: "easeOut" }}
                />
              ))}
            </div>
          )}

          {/* Priya celebrating */}
          <motion.div
            className="w-24 h-24 gradient-red rounded-full flex items-center justify-center mx-auto mb-6 glow-red"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <span className="text-5xl">🎉</span>
          </motion.div>

          <motion.p
            className="text-white/50 text-base mb-2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          >
            Hi {firstName}! Here's your result
          </motion.p>

          <motion.h2
            className="text-white font-black text-4xl mb-8"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          >
            You're Pre-Approved! 🎊
          </motion.h2>

          {/* Main offer card */}
          <motion.div
            className="glass rounded-3xl p-8 mb-6 border border-[#E31837]/30 glow-red"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <p className="text-white/40 text-sm mb-2">Pre-Approved Amount</p>
            <p className="text-white font-black text-6xl mb-1">
              ₹{(eligibilityResult.approved_amount / 100000).toFixed(2)}L
            </p>

            {eligibilityResult.show_cibil && eligibilityResult.cibil_score && (
              <motion.div
                className="inline-flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-full px-4 py-1.5 mb-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
              >
                <div className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-green-400 text-sm font-medium">
                  CIBIL {eligibilityResult.cibil_score} ·{" "}
                  {eligibilityResult.cibil_band === "excellent" ? "Excellent Score" : "Good Score"}
                </span>
              </motion.div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-4">
              {[
                { label: "Interest Rate", value: `${eligibilityResult.interest_rate}% p.a.` },
                { label: "Monthly EMI", value: `₹${eligibilityResult.emi.toLocaleString()}` },
                { label: "Tenure", value: `${eligibilityResult.tenure_months} months` },
              ].map((item) => (
                <div key={item.label} className="glass rounded-xl p-4 text-center">
                  <p className="text-white/40 text-xs mb-1">{item.label}</p>
                  <p className="text-white font-bold text-lg">{item.value}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Priya's message */}
          <motion.div
            className="glass rounded-2xl p-5 mb-8 border-l-4 border-[#E31837] text-left"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          >
            <div className="flex gap-3 items-start">
              <span className="text-2xl">👩‍💼</span>
              <p className="text-white/70 text-base leading-relaxed italic">
                "{eligibilityResult.priya_message}"
              </p>
            </div>
          </motion.div>

          <motion.button
            onClick={handleContinue}
            className="gradient-red glow-red text-white font-bold text-xl px-12 py-5 rounded-2xl w-full"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
            whileTap={{ scale: 0.97 }}
          >
            Customize My Loan →
          </motion.button>

          <p className="text-white/25 text-xs mt-4">
            Pre-approval subject to document verification · Offer valid 48 hours
          </p>
        </div>
      ) : (
        /* Decline */
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">🤝</span>
          </div>
          <h2 className="text-white font-bold text-3xl mb-4">Thank you, {firstName}</h2>
          <div className="glass rounded-2xl p-6 mb-6 text-left border-l-4 border-[#F5A623]">
            <div className="flex gap-3">
              <span className="text-2xl">👩‍💼</span>
              <p className="text-white/70 leading-relaxed">{eligibilityResult.priya_message}</p>
            </div>
          </div>
          <p className="text-white/50 mb-6">Our financial advisor at the desk can suggest personalised options for you.</p>
          <button
            onClick={() => setStage("idle")}
            className="glass border border-white/20 text-white font-bold px-8 py-3 rounded-xl"
          >
            Start Over
          </button>
        </div>
      )}
    </motion.div>
  )
}
