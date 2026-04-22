"use client"
import { motion, AnimatePresence } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { useKioskStore } from "@/lib/store"
import { useSpeech } from "@/lib/useSpeech"
import { useAvatarContext } from "@/lib/avatarContext"

// Captured frame of Lisa (our live Azure avatar) — lives at /public so the
// static photo and the WebRTC video have the same face. No jarring swap.
const PRIYA_PLACEHOLDER = "/priya-placeholder.png"
const PRIYA_FALLBACK    = "https://randomuser.me/api/portraits/women/44.jpg"

const GREETING =
  "Hello. I'm Priya, your Kotak loan assistant. Let's find your dream car together."

export default function IdleScreen() {
  const { setStage } = useKioskStore()
  const avatar = useAvatarContext()
  const fallbackSpeech = useSpeech()
  const [advancing, setAdvancing] = useState(false)
  const greetedRef   = useRef(false)
  const hasSpokenRef = useRef(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Note: auto-start happens in AvatarProvider — WebRTC handshake begins
  // the instant the kiosk loads, not on tap. We just wire streams here.
  // Wire WebRTC streams into the video/audio elements as they arrive
  useEffect(() => {
    if (videoRef.current && avatar.videoStream) videoRef.current.srcObject = avatar.videoStream
  }, [avatar.videoStream])
  useEffect(() => {
    if (audioRef.current && avatar.audioStream) audioRef.current.srcObject = avatar.audioStream
  }, [avatar.audioStream])

  const avatarActive   = Boolean(avatar.videoStream) && avatar.state !== "failed"
  const avatarStarting = avatar.state === "starting" || (avatar.state === "idle" && !avatarActive)
  const avatarFailed   = avatar.state === "failed"
  const avatarSpeaking = avatar.state === "speaking"
  const speaking       = avatarSpeaking || fallbackSpeech.speaking
  const subtitle       = avatarSpeaking ? GREETING : fallbackSpeech.subtitle

  // Greeting fires on first tap — browser autoplay policy blocks audio
  // without a user gesture. WebRTC handshake itself runs on page load from
  // AvatarProvider, so "tap" just unlocks the audio element.
  const handleBegin = async () => {
    if (greetedRef.current) return
    greetedRef.current = true
    setAdvancing(true)

    // Unlock the audio element
    try { await audioRef.current?.play() } catch {}

    // Fire greeting — avatar if ready, else Neerja fallback. If avatar is
    // still connecting, the useEffect below speaks the moment it becomes ready.
    if (avatar.state === "ready" || avatar.state === "speaking") {
      avatar.speak(GREETING)
    } else if (avatar.state === "failed") {
      fallbackSpeech.speak(GREETING)
    }

    // Hard timeout — always advance to car catalog 9 seconds after tap,
    // regardless of what happened with the speech. Gives Lisa time to finish
    // the greeting (~5s) with a comfortable buffer.
    setTimeout(() => setStage("car_catalog"), 9000)
  }

  // If user tapped while avatar was still warming up, speak once it's ready.
  useEffect(() => {
    if (!greetedRef.current) return
    if (hasSpokenRef.current) return
    if (avatar.state === "ready") {
      avatar.speak(GREETING)
    } else if (avatar.state === "failed") {
      fallbackSpeech.speak(GREETING)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatar.state])

  // Track whether we've actually seen her speak (for the hard-timeout skip
  // path — not strictly needed anymore but kept for diagnostics).
  useEffect(() => {
    if (speaking) hasSpokenRef.current = true
  }, [speaking])

  return (
    <motion.div
      onClick={handleBegin}
      className="w-full h-full relative overflow-hidden cursor-pointer bg-[#0A0B0E]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Hidden WebRTC audio sink — only plays if avatar is started later */}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />

      {/* Background — subtle, not distracting */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(227,24,55,0.08),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(245,166,35,0.04),_transparent_55%)]" />
        <motion.div
          className="absolute top-[18%] left-[8%] w-[480px] h-[480px] rounded-full bg-[#E31837]/6 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Editorial two-column layout */}
      <div className="relative z-10 w-full h-full grid grid-cols-2 gap-0">
        {/* LEFT — hero portrait */}
        <div className="relative flex items-center justify-center pl-12">
          <motion.div
            className="relative w-full max-w-[540px]"
            style={{ aspectRatio: "3 / 4" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.25, 0.8, 0.3, 1] }}
          >
            {/* Base layer — the static Priya portrait. Always rendered so there
                is never an empty state. Video layers on top when avatar is live. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={PRIYA_PLACEHOLDER}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = PRIYA_FALLBACK }}
              alt="Priya"
              className="absolute inset-0 w-full h-full object-cover object-top rounded-t-[50%] bg-[#14151A]"
            />

            {/* Avatar video overlay — fades in once the stream is live, fades
                back to 0 if it fails. The photo beneath stays as the ground truth.
                MUTED so browser autoplay policy lets the video play without
                user gesture. The audio track plays through the <audio> element. */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover rounded-t-[50%] bg-transparent transition-opacity duration-1000 ${
                avatarActive ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Soft connecting halo during WebRTC handshake */}
            {avatarStarting && !avatarActive && (
              <motion.div
                className="absolute top-[30%] left-1/2 -translate-x-1/2 w-40 h-40 rounded-full border-2 border-[#E31837]/55 pointer-events-none"
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.7, 0.2] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Subtle speaking halo */}
            {speaking && (
              <motion.div
                className="absolute inset-0 rounded-t-[50%] ring-2 ring-[#E31837]/55 pointer-events-none"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Minimal live-status pill (top-right of portrait) — only visible
                while something is happening, avoids duplicating the label that's
                baked into Lisa's captured screenshot. */}
            {(speaking || avatar.state === "starting" || avatarActive) && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  speaking                      ? "bg-[#E31837] animate-pulse" :
                  avatar.state === "starting"   ? "bg-amber-400 animate-pulse" :
                                                  "bg-green-400"
                }`} />
                <span className="text-white/70 text-[10px] font-medium tracking-wider uppercase">
                  {speaking                     ? "Speaking" :
                   avatar.state === "starting"  ? "Connecting" :
                                                  "Live"}
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* RIGHT — copy + CTA */}
        <div className="flex flex-col justify-center pr-20 pl-8">
          <motion.div
            className="flex items-center gap-3 mb-10"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="w-1 h-6 bg-[#E31837] rounded-full" />
            <span className="text-white/50 text-[11px] uppercase tracking-[0.35em] font-semibold">
              Kotak · Showroom Kiosk
            </span>
          </motion.div>

          <motion.h1
            className="text-white font-black text-7xl leading-[1.05] tracking-tight mb-8"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.25, 0.8, 0.3, 1] }}
          >
            Drive home
            <br />
            <span className="text-white/60">your dream car,</span>
            <br />
            <span className="text-[#E31837]">today.</span>
          </motion.h1>

          <motion.p
            className="text-white/60 text-lg leading-relaxed mb-12 max-w-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            Pre-approved in under 5 minutes. No paperwork until you drive.
          </motion.p>

          {/* Feature strip — tight, editorial */}
          <motion.div
            className="flex items-center gap-8 mb-14"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            {[
              { big: "5", small: "min", sub: "to pre-approval" },
              { big: "0", small: "₹",   sub: "upfront paperwork" },
              { big: "20", small: "",   sub: "cars to choose from" },
            ].map((f, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-white font-black text-3xl">{f.big}</span>
                  {f.small && <span className="text-white/40 text-sm font-medium">{f.small}</span>}
                </div>
                <span className="text-white/40 text-[11px] uppercase tracking-wider">{f.sub}</span>
              </div>
            ))}
          </motion.div>

          <motion.button
            onClick={(e) => { e.stopPropagation(); handleBegin() }}
            className={`group self-start inline-flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-base transition-all ${
              greetedRef.current
                ? "bg-white/10 text-white/50 cursor-default"
                : "bg-white text-[#0A0B0E] hover:bg-[#E31837] hover:text-white"
            }`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            whileTap={!greetedRef.current ? { scale: 0.97 } : {}}
            disabled={greetedRef.current}
          >
            <span>
              {advancing                   ? "Starting your journey…" :
               avatar.state === "speaking" ? "Priya is speaking…" :
               greetedRef.current          ? "Connecting Priya…" :
                                             "Begin"}
            </span>
            {!greetedRef.current && <span className="transition-transform group-hover:translate-x-1">→</span>}
          </motion.button>

          <motion.p
            className="text-white/25 text-[11px] mt-6 tracking-wide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            Priya is connecting in the background · Tap Begin when ready
          </motion.p>
        </div>
      </div>

      {/* Subtitle strip — only while Priya speaks */}
      <AnimatePresence>
        {subtitle && (
          <motion.div
            key={subtitle}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 pointer-events-none z-30"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white/5 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl">
              <p className="text-white/90 text-sm text-center font-medium tracking-wide max-w-xl">
                {subtitle}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimal footer */}
      <div className="absolute bottom-4 right-8 text-white/15 text-[10px] tracking-widest uppercase">
        Kotak Mahindra Bank · RBI Licensed
      </div>
    </motion.div>
  )
}
