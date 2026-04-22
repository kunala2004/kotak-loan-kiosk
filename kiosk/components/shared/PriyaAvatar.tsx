"use client"
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { useSpeech } from "@/lib/useSpeech"
import { useAvatarContext } from "@/lib/avatarContext"

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

const PRIYA_PLACEHOLDER = "/priya-placeholder.png"
const PRIYA_FALLBACK    = "https://randomuser.me/api/portraits/women/44.jpg"

export default function PriyaAvatar() {
  const { currentStage } = useKioskStore()
  const eligibilityResult = useKioskStore((s) => s.eligibilityResult)
  const avatar = useAvatarContext()
  const fallback = useSpeech()

  const [minimized, setMinimized] = useState(false)
  const lastSpokenRef = useRef<string>("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (videoRef.current && avatar.videoStream) {
      videoRef.current.srcObject = avatar.videoStream
      videoRef.current.play().catch(() => { /* autoplay muted video should always work */ })
    }
  }, [avatar.videoStream])

  useEffect(() => {
    const el = audioRef.current
    if (el && avatar.audioStream) {
      el.srcObject = avatar.audioStream
      // Explicit play — this audio element was created fresh when the stage
      // changed, so srcObject + autoPlay alone isn't always enough. The page
      // has user activation from the idle-screen tap so play() should resolve.
      el.play().catch((err) => {
        console.warn("[PriyaAvatar] audio play failed — stage messages will be silent", err)
      })
    }
  }, [avatar.audioStream])

  // On every stage change, Priya speaks the checkpoint line.
  useEffect(() => {
    if (currentStage === "idle") return

    const line =
      currentStage === "eligibility_result" && eligibilityResult?.priya_message
        ? eligibilityResult.priya_message
        : STAGE_MESSAGES[currentStage]

    if (!line || line === lastSpokenRef.current) return
    lastSpokenRef.current = line

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Make sure the audio element is actually playing before speaking, so
      // there's no race where Azure emits audio into a paused/locked element.
      audioRef.current?.play().catch(() => {})

      if (avatar.state === "ready" || avatar.state === "speaking") {
        console.debug("[PriyaAvatar] stage checkpoint:", currentStage)
        avatar.speak(line)
      } else {
        console.debug("[PriyaAvatar] stage checkpoint (fallback):", currentStage)
        fallback.speak(line)
      }
    }, 650)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, eligibilityResult])

  if (currentStage === "idle") return null

  const avatarActive   = Boolean(avatar.videoStream) && avatar.state !== "failed"
  const avatarStarting = avatar.state === "starting"
  const speaking       = avatar.state === "speaking" || fallback.speaking
  const subtitle       = avatar.state === "speaking" ? (lastSpokenRef.current || "") : fallback.subtitle

  return (
    <>
      {/* Audio track — kept outside the widget so minimising doesn't cut voice */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Subtitle strip — what Priya is saying right now */}
      <AnimatePresence>
        {subtitle && (
          <motion.div
            key={subtitle}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 pointer-events-none z-40"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white/5 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
              <p className="text-white/90 text-sm text-center font-medium tracking-wide max-w-2xl">
                {subtitle}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent Priya — bottom-left so she never blocks primary CTAs on
          the right side of stages. WebRTC session stays open across stages. */}
      <motion.div
        className="fixed bottom-8 left-8 z-50 select-none"
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: minimized ? 0.55 : 1,
          x: minimized ? -40 : 0,
        }}
        transition={{ duration: 0.4, ease: [0.25, 0.8, 0.3, 1] }}
      >
        <div
          className="relative"
          style={{ width: 170, height: 227 /* 3/4 aspect — 75% of hero */ }}
        >
          {/* Frame — tall arch, matches the IdleScreen hero */}
          <div className={`absolute inset-0 rounded-t-[50%] overflow-hidden bg-[#14151A] transition-all duration-300 ${
            speaking
              ? "ring-2 ring-[#E31837] shadow-[0_0_40px_rgba(227,24,55,0.45)]"
              : "ring-1 ring-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          }`}>
            {/* Base photo — always present, guarantees no empty frame */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PRIYA_PLACEHOLDER}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = PRIYA_FALLBACK }}
              alt="Priya"
              className="absolute inset-0 w-full h-full object-cover object-top"
            />

            {/* WebRTC video — fades in when stream is live. Muted to honour
                browser autoplay policy; audio plays through the global <audio>. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover bg-transparent transition-opacity duration-700 ${
                avatarActive ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Speaking wave dots bottom-centre */}
            {speaking && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1 z-10">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 bg-[#E31837] rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}s` }}
                  />
                ))}
              </div>
            )}

            {/* Connecting halo */}
            {avatarStarting && !avatarActive && (
              <motion.div
                className="absolute top-1/3 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-2 border-amber-400/50 pointer-events-none"
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Tiny status pill top-right */}
            {(speaking || avatarStarting || avatarActive) && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 z-10">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  speaking       ? "bg-[#E31837] animate-pulse" :
                  avatarStarting ? "bg-amber-400 animate-pulse" :
                                   "bg-green-400"
                }`} />
                <span className="text-white/70 text-[9px] font-semibold tracking-wider uppercase">
                  {speaking ? "Speaking" : avatarStarting ? "Connecting" : "Live"}
                </span>
              </div>
            )}
          </div>

          {/* Minimise toggle — small, top-right of the frame (now that Priya
              lives on the left, the minimise handle sits further from centre) */}
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m) }}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black/70 border border-white/15 text-white/60 hover:text-white/90 text-xs flex items-center justify-center transition-colors backdrop-blur-md"
            title={minimized ? "Expand Priya" : "Minimise Priya"}
          >
            {minimized ? "＋" : "−"}
          </button>

          {/* Label beneath the frame */}
          {!minimized && (
            <div className="absolute -bottom-8 left-0 right-0 flex items-center justify-center gap-2">
              <span className="text-white/80 text-[11px] font-semibold tracking-[0.28em] uppercase">
                Priya
              </span>
              <span className="text-white/25 text-[9px]">·</span>
              <span className="text-white/40 text-[9px] tracking-wide">
                {avatarActive       ? "Azure Avatar" :
                 fallback.mode === "audio"   ? "Neerja · Azure" :
                 fallback.mode === "browser" ? "Browser voice"  :
                                               "Standing by"}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
