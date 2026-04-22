"use client"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { api } from "@/lib/api"

const LOADING_STEPS = [
  { label: "Connecting to credit bureau...", duration: 800 },
  { label: "Fetching your credit profile...", duration: 1000 },
  { label: "Verifying income signals...", duration: 900 },
  { label: "Checking existing obligations...", duration: 800 },
  { label: "Calculating your offer...", duration: 700 },
]

export default function PANEntry() {
  const { setPan, setBureauData, setEligibilityResult, setStage, selectedCar, financialAnswers } = useKioskStore()
  const [pan, setPanLocal] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [error, setError] = useState("")

  const handleKey = (char: string) => {
    if (char === "⌫") {
      setPanLocal((p) => p.slice(0, -1))
    } else if (pan.length < 10) {
      setPanLocal((p) => (p + char).toUpperCase())
    }
  }

  const handleSubmit = async () => {
    if (pan.length !== 10) {
      setError("Please enter a valid 10-character PAN")
      return
    }
    setError("")
    setLoading(true)
    setPan(pan)

    // Animate loading steps
    for (let i = 0; i < LOADING_STEPS.length; i++) {
      setLoadStep(i)
      await new Promise((r) => setTimeout(r, LOADING_STEPS[i].duration))
    }

    try {
      const bureau = await api.fetchBureau(pan)
      setBureauData(bureau)

      // Run eligibility check
      const eligResult = await api.checkEligibility({
        income_range: financialAnswers.income_range,
        employment_type: financialAnswers.employment_type,
        down_payment: financialAnswers.down_payment,
        vehicle_price: selectedCar?.price || 0,
        tenure_months: financialAnswers.tenure_months,
        cibil: bureau.cibil,
        existing_emi: bureau.existing_emi_total,
        age: bureau.age,
        customer_name: bureau.name,
        car_brand: selectedCar?.brand || "",
        car_model: selectedCar?.model || "",
        car_variant: selectedCar?.variant || "",
      })

      setEligibilityResult(eligResult)
      setStage("eligibility_result")
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  const KEYS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
    ["K", "L", "M", "N", "O", "P", "Q", "R", "S", "T"],
    ["U", "V", "W", "X", "Y", "Z", "⌫"],
  ]

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
    >
      <AnimatePresence mode="wait">
        {!loading ? (
          <motion.div key="form" className="w-full max-w-lg px-8" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-center mb-8">
              <motion.div
                className="w-16 h-16 gradient-red rounded-2xl flex items-center justify-center mx-auto mb-5 glow-red"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <span className="text-3xl">🔒</span>
              </motion.div>
              <p className="text-white/40 text-sm mb-1">Step 3 of 5</p>
              <h2 className="text-white font-bold text-3xl mb-2">Enter your PAN</h2>
              <p className="text-white/50 text-base">Used only for your credit bureau check</p>
            </div>

            {/* PAN Display */}
            <div className="glass rounded-2xl p-5 mb-6 text-center border border-white/10">
              <p className="text-white/30 text-xs mb-3 uppercase tracking-widest">PAN Number</p>
              <div className="flex items-center justify-center gap-1.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-9 h-11 rounded-lg flex items-center justify-center text-lg font-bold border transition-all ${
                      i < pan.length
                        ? "bg-[#E31837]/20 border-[#E31837]/60 text-white"
                        : i === pan.length
                        ? "border-[#E31837] bg-[#E31837]/10 text-white animate-pulse"
                        : "border-white/10 text-white/0 bg-white/5"
                    }`}
                  >
                    {pan[i] || ""}
                  </div>
                ))}
              </div>
              {error && <p className="text-[#E31837] text-sm mt-3">{error}</p>}
            </div>

            {/* Keypad */}
            <div className="flex flex-col gap-2 mb-6">
              {KEYS.map((row, ri) => (
                <div key={ri} className="flex gap-2 justify-center">
                  {row.map((k) => (
                    <motion.button
                      key={k}
                      onClick={() => handleKey(k)}
                      className={`h-11 rounded-xl font-bold text-sm transition-all ${
                        k === "⌫"
                          ? "bg-white/10 text-white/70 px-5"
                          : "glass border border-white/10 text-white w-11 hover:border-white/30"
                      }`}
                      whileTap={{ scale: 0.88 }}
                    >
                      {k}
                    </motion.button>
                  ))}
                </div>
              ))}
            </div>

            <motion.button
              onClick={handleSubmit}
              disabled={pan.length !== 10}
              className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                pan.length === 10
                  ? "gradient-red glow-red text-white"
                  : "bg-white/5 text-white/30 cursor-not-allowed"
              }`}
              whileTap={pan.length === 10 ? { scale: 0.97 } : {}}
            >
              {pan.length === 10 ? "Fetch My Profile →" : `${10 - pan.length} more characters`}
            </motion.button>

            <p className="text-center text-white/20 text-xs mt-4">
              🔒 256-bit encrypted · Compliant with RBI guidelines
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="loading"
            className="text-center px-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <motion.div
              className="w-24 h-24 gradient-red rounded-full flex items-center justify-center mx-auto mb-8 glow-red"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <span className="text-4xl">⚡</span>
            </motion.div>

            <h3 className="text-white font-bold text-2xl mb-8">Priya is checking your profile...</h3>

            <div className="flex flex-col gap-3 text-left max-w-sm mx-auto">
              {LOADING_STEPS.map((step, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: i <= loadStep ? 1 : 0.3, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    i < loadStep ? "bg-green-500" : i === loadStep ? "bg-[#E31837] animate-pulse" : "bg-white/10"
                  }`}>
                    {i < loadStep ? (
                      <span className="text-white text-xs">✓</span>
                    ) : i === loadStep ? (
                      <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                    ) : null}
                  </div>
                  <span className={`text-sm ${i <= loadStep ? "text-white/80" : "text-white/25"}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
