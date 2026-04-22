"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

export default function PhoneCapture() {
  const { setPhone, setStage, bureauData, selectedCar, loanConfig } = useKioskStore()
  const [phone, setPhoneLocal] = useState("")
  const [error, setError] = useState("")

  const handleKey = (k: string) => {
    if (k === "⌫") setPhoneLocal((p) => p.slice(0, -1))
    else if (phone.length < 10 && /\d/.test(k)) setPhoneLocal((p) => p + k)
  }

  const handleContinue = () => {
    if (phone.length !== 10) { setError("Enter a valid 10-digit mobile number"); return }
    setPhone(phone)
    setStage("application_review")
  }

  const KEYS = [["1","2","3"],["4","5","6"],["7","8","9"],["⌫","0","→"]]

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
    >
      <div className="max-w-sm w-full px-8 text-center">
        <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">📱</span>
        </div>

        <p className="text-white/40 text-sm mb-1">Almost there!</p>
        <h2 className="text-white font-bold text-3xl mb-2">Your mobile number</h2>
        <p className="text-white/50 text-base mb-8">
          We'll send your loan summary on WhatsApp
        </p>

        {/* Phone display */}
        <div className="glass rounded-2xl p-6 mb-6 border border-white/10">
          <p className="text-white/30 text-xs mb-3 uppercase tracking-widest">+91</p>
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-10 rounded-lg flex items-center justify-center font-bold text-lg border transition-all ${
                  i < phone.length ? "border-green-500/60 bg-green-500/10 text-white"
                  : i === phone.length ? "border-white/40 text-white animate-pulse"
                  : "border-white/10 text-transparent bg-white/5"
                }`}
              >
                {phone[i] || ""}
              </div>
            ))}
          </div>
          {error && <p className="text-[#E31837] text-sm mt-3">{error}</p>}
        </div>

        {/* Numpad */}
        <div className="flex flex-col gap-3 mb-6">
          {KEYS.map((row, ri) => (
            <div key={ri} className="flex gap-3 justify-center">
              {row.map((k) => (
                <motion.button
                  key={k}
                  onClick={() => k === "→" ? handleContinue() : handleKey(k)}
                  className={`w-20 h-14 rounded-2xl font-bold text-xl flex items-center justify-center transition-all ${
                    k === "→"
                      ? phone.length === 10 ? "gradient-red glow-red text-white" : "bg-white/5 text-white/20 cursor-not-allowed"
                      : "glass border border-white/10 text-white hover:border-white/30"
                  }`}
                  whileTap={{ scale: 0.88 }}
                  disabled={k === "→" && phone.length !== 10}
                >
                  {k}
                </motion.button>
              ))}
            </div>
          ))}
        </div>

        <p className="text-white/20 text-xs">Used only for loan summary & support. No spam.</p>
      </div>
    </motion.div>
  )
}
