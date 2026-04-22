"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { useSpeech } from "@/lib/useSpeech"

// Canned per-stage line. LLM renderers will override these where applicable.
const STAGE_MESSAGES: Record<string, string> = {
  car_catalog:         "Browse our catalog and tap the car you'd love to drive home today.",
  financial_discovery: "Let me understand your budget. I'll find the perfect loan for you.",
  eligibility_teaser:  "You're one step away from seeing your personalised pre-approval.",
  pan_entry:           "Your PAN is used only to check your credit profile. It's fully secure.",
  eligibility_result:  "Congratulations! You've been pre-approved. Here are your loan details.",
  emi_optimizer:       "Adjust the sliders to find your perfect monthly payment.",
  phone_capture:       "Almost done. Share your number to receive your loan summary.",
  application_review:  "Everything looks great. Review and submit when you're ready.",
  waiting:             "Your application is with the dealer. We'll update you here and on your phone.",
  celebration:         "Your car is waiting for you. Thank you for believing in Kotak.",
}

const PRIYA_IMG = "https://randomuser.me/api/portraits/women/44.jpg"

export default function PriyaAvatar() {
  const { currentStage } = useKioskStore()
  const eligibilityResult = useKioskStore((s) => s.eligibilityResult)
  const { speak, speaking, subtitle, mode } = useSpeech()
  const [minimized, setMinimized] = useState(false)
  const lastSpokenRef = useRef<string>("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-speak when stage changes (skip idle — IdleScreen owns its own speech).
  // For eligibility_result we prefer the backend's priya_message (approve OR decline)
  // over the generic canned line.
  useEffect(() => {
    if (currentStage === "idle") return

    const line =
      currentStage === "eligibility_result" && eligibilityResult?.priya_message
        ? eligibilityResult.priya_message
        : STAGE_MESSAGES[currentStage]

    if (!line) return
    if (line === lastSpokenRef.current) return
    lastSpokenRef.current = line

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => speak(line), 600)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, eligibilityResult])

  // Hide entirely on idle — the Stage 0 hero Priya takes over.
  if (currentStage === "idle") return null

  const modeLabel =
    mode === "audio"   ? "Cloud TTS" :
    mode === "browser" ? "Browser TTS" : ""

  return (
    <>
      {/* Floating subtitle — what Priya is saying right now */}
      <AnimatePresence>
        {subtitle && (
          <motion.div
            key={subtitle}
            className="fixed bottom-32 left-0 right-0 flex justify-center px-8 pointer-events-none z-40"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-black/75 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 max-w-xl">
              <p className="text-white/90 text-sm text-center leading-relaxed">{subtitle}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner widget */}
      <div className="fixed bottom-32 right-5 z-50 flex flex-col items-end gap-1.5 select-none">
        <button
          onClick={() => setMinimized((m) => !m)}
          className="text-white/25 text-[9px] hover:text-white/50 transition-colors self-end pr-0.5"
        >
          {minimized ? "▲ PRIYA" : "▼"}
        </button>

        {!minimized && (
          <div className="flex flex-col items-center gap-1">
            <div
              className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                speaking
                  ? "ring-2 ring-[#E31837] shadow-[0_0_24px_rgba(227,24,55,0.4)]"
                  : "ring-1 ring-white/15"
              }`}
              style={{ width: 144, height: 180, background: "#0A0D16" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PRIYA_IMG}
                alt="Priya"
                className="w-full h-full object-cover"
              />
              {speaking && (
                <>
                  <span
                    className="absolute inset-0 rounded-2xl border-2 border-[#E31837]/40 animate-ping"
                    style={{ animationDuration: "1.4s" }}
                  />
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 bg-[#E31837] rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}s` }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-0.5">
              <span className="text-white/50 text-[10px] font-semibold tracking-wide">PRIYA</span>
              {modeLabel && (
                <span className={`text-[8px] font-medium ${
                  mode === "audio" ? "text-blue-400/70" : "text-white/25"
                }`}>
                  {modeLabel}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
