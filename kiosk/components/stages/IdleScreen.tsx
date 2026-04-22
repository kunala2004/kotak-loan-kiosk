"use client"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { useKioskStore } from "@/lib/store"
import { useSpeech } from "@/lib/useSpeech"

const PRIYA_IMG = "https://randomuser.me/api/portraits/women/44.jpg"

const GREETING =
  "Hi! I'm Priya from Kotak Bank. Let's find your dream car together."

export default function IdleScreen() {
  const { setStage } = useKioskStore()
  const { speak, speaking, subtitle } = useSpeech()
  const [tapped, setTapped] = useState(false)
  const hasSpokenRef = useRef(false)

  // Advance to car catalog after Priya finishes her greeting.
  useEffect(() => {
    if (speaking) hasSpokenRef.current = true
    if (tapped && hasSpokenRef.current && !speaking) {
      const t = setTimeout(() => setStage("car_catalog"), 500)
      return () => clearTimeout(t)
    }
  }, [speaking, tapped, setStage])

  const handleStart = () => {
    if (tapped) return
    setTapped(true)
    hasSpokenRef.current = false
    speak(GREETING)
  }

  return (
    <motion.div
      onClick={handleStart}
      className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden cursor-pointer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Ambient background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-[#E31837]/10 blur-3xl"
          animate={{ x: [-100, 100, -100], y: [-50, 50, -50] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "10%", left: "20%" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full bg-[#F5A623]/8 blur-3xl"
          animate={{ x: [100, -100, 100], y: [50, -50, 50] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          style={{ bottom: "20%", right: "15%" }}
        />
      </div>

      {/* Floating cars */}
      {["🚗", "🚙", "🏎️"].map((car, i) => (
        <motion.div
          key={i}
          className="absolute text-6xl opacity-10 pointer-events-none"
          animate={{ x: ["-10vw", "110vw"], y: [0, -20, 0, 20, 0] }}
          transition={{
            x: { duration: 12 + i * 4, repeat: Infinity, ease: "linear", delay: i * 4 },
            y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ top: `${30 + i * 20}%` }}
        >
          {car}
        </motion.div>
      ))}

      {/* Hero content */}
      <div className="relative z-10 flex flex-col items-center text-center px-8 max-w-4xl">
        <motion.div
          className="relative mb-8"
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        >
          <motion.div
            className={`absolute inset-0 rounded-full transition-all ${
              speaking
                ? "ring-4 ring-[#E31837] shadow-[0_0_80px_rgba(227,24,55,0.55)]"
                : "ring-2 ring-white/10"
            }`}
            animate={speaking ? { scale: [1, 1.04, 1] } : { scale: 1 }}
            transition={{ duration: 1.8, repeat: speaking ? Infinity : 0, ease: "easeInOut" }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PRIYA_IMG}
            alt="Priya, your Kotak loan assistant"
            className="w-56 h-56 rounded-full object-cover relative z-10 border-4 border-[#0D1117]"
          />
          {speaking && (
            <span
              className="absolute -inset-2 rounded-full border-2 border-[#E31837]/40 animate-ping z-0"
              style={{ animationDuration: "1.6s" }}
            />
          )}
        </motion.div>

        <motion.p
          className="text-white/50 text-sm uppercase tracking-[0.3em] mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Welcome to Kotak Bank
        </motion.p>

        <motion.h1
          className="text-white font-black text-6xl leading-tight mb-4"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Drive home your
          <span className="block text-[#E31837]">dream car today.</span>
        </motion.h1>

        <motion.p
          className="text-white/50 text-xl mb-10"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          Get your car loan pre-approved in under 5 minutes
        </motion.p>

        <motion.button
          onClick={(e) => { e.stopPropagation(); handleStart() }}
          className="gradient-red glow-red text-white font-bold text-xl px-16 py-5 rounded-2xl pulse-red disabled:opacity-70"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          whileTap={{ scale: 0.96 }}
          disabled={tapped}
        >
          {tapped ? "Starting…" : "Let's Get Started →"}
        </motion.button>
      </div>

      {/* Subtitle — only shows after tap, while Priya speaks */}
      <AnimatePresence>
        {subtitle && (
          <motion.div
            key={subtitle}
            className="absolute bottom-24 left-0 right-0 flex justify-center px-8 pointer-events-none z-20"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="bg-black/70 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 max-w-2xl">
              <p className="text-white/90 text-lg text-center leading-relaxed">
                {subtitle}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="absolute bottom-6 left-0 right-0 text-center pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <p className="text-white/20 text-xs">Kotak Mahindra Bank · RBI Licensed · Your data is safe</p>
      </motion.div>
    </motion.div>
  )
}
