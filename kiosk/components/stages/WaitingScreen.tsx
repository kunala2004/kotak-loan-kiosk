"use client"
import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const POLL_MS = 3000

const STEPS = [
  { key: "received",  label: "Application received by dealer" },
  { key: "reviewing", label: "Dealer reviewing your profile" },
  { key: "docs",      label: "Verifying documents digitally" },
  { key: "decision",  label: "Final approval" },
]

const TIPS = [
  "We'll update you right here — and on your phone.",
  "Kotak processes over 1 lakh car loans every month across India.",
  "Your data is encrypted and never shared without your consent.",
  "Once approved, paperwork at the desk takes just 6-7 minutes.",
]

export default function WaitingScreen() {
  const { applicationId, bureauData, phone, setStage } = useKioskStore()
  const [seconds, setSeconds]       = useState(0)
  const [tip, setTip]               = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Timers for display
  useEffect(() => {
    const sTimer = setInterval(() => setSeconds((s) => s + 1), 1000)
    const tTimer = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4500)
    const stepTimer = setInterval(() => setCurrentStep((c) => Math.min(c + 1, STEPS.length - 2)), 3500)
    return () => { clearInterval(sTimer); clearInterval(tTimer); clearInterval(stepTimer) }
  }, [])

  // Poll application status — advance to celebration when dealer sanctions
  useEffect(() => {
    if (!applicationId) return

    const check = async () => {
      try {
        const res = await fetch(`${API}/application/${applicationId}`)
        if (!res.ok) return
        const app = await res.json()
        if (app.status === "sanctioned" || app.status === "disbursed") {
          if (pollRef.current) clearInterval(pollRef.current)
          setCurrentStep(STEPS.length - 1)
          setTimeout(() => setStage("celebration"), 600)
        }
      } catch { /* network blip — keep polling */ }
    }

    check()
    pollRef.current = setInterval(check, POLL_MS)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [applicationId, setStage])

  const firstName = bureauData?.name.split(" ")[0] || "there"

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28 px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-lg w-full text-center">
        <div className="relative w-32 h-32 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-[#E31837]/20" />
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#E31837]"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl">🏢</span>
          </div>
        </div>

        <h2 className="text-white font-bold text-3xl mb-2">Almost there, {firstName}! 🏁</h2>
        <p className="text-white/50 text-base mb-6">Your application is with the dealer.</p>

        {phone && (
          <p className="text-white/40 text-sm mb-6">
            You can step away — we&apos;ll message <span className="text-white/70 font-semibold">{phone}</span> when it&apos;s done.
          </p>
        )}

        {applicationId && (
          <div className="glass rounded-xl px-5 py-3 mb-8 inline-block border border-white/10">
            <p className="text-white/40 text-xs">Application ID</p>
            <p className="text-white font-mono font-bold">{applicationId}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 text-left mb-8">
          {STEPS.map((step, i) => {
            const done   = i < currentStep
            const active = i === currentStep
            return (
              <motion.div
                key={step.key}
                className="flex items-center gap-4 glass rounded-xl p-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.15 }}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  done ? "bg-green-500" : active ? "bg-[#E31837] animate-pulse" : "bg-white/10"
                }`}>
                  {done  ? <span className="text-white text-sm">✓</span>
                   : active ? <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                   :          <div className="w-2 h-2 bg-white/30 rounded-full" />}
                </div>
                <span className={`text-sm ${done || active ? "text-white/80" : "text-white/30"}`}>
                  {step.label}
                </span>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          key={tip}
          className="glass rounded-xl p-4 text-left"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          <p className="text-white/40 text-xs mb-1 uppercase tracking-widest">Did you know</p>
          <p className="text-white/60 text-sm">{TIPS[tip]}</p>
        </motion.div>

        <p className="text-white/20 text-xs mt-4">Waiting… {seconds}s</p>
      </div>
    </motion.div>
  )
}
