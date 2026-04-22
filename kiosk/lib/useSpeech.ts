"use client"
import { useCallback, useEffect, useRef, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type SpeechMode = "audio" | "browser" | "idle"

interface SpeechState {
  speak: (text: string) => Promise<void>
  stop: () => void
  speaking: boolean
  subtitle: string
  mode: SpeechMode
}

/**
 * Unified speech hook used by both the Stage 0 hero Priya and the
 * corner-widget Priya. Tries backend /tts first; if the backend returns
 * JSON (mock mode), falls back to browser Web Speech API.
 */
export function useSpeech(): SpeechState {
  const [speaking, setSpeaking] = useState(false)
  const [subtitle, setSubtitle] = useState("")
  const [mode, setMode] = useState<SpeechMode>("idle")

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef   = useRef<string | null>(null)
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }
    utterRef.current = null
  }, [])

  const stop = useCallback(() => {
    cleanup()
    setSpeaking(false)
    setSubtitle("")
    setMode("idle")
  }, [cleanup])

  const speakBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.0
    u.pitch = 1.1
    u.volume = 0.95
    const voices = window.speechSynthesis.getVoices()
    const pick =
      voices.find((v) => /en-IN/i.test(v.lang)) ||
      voices.find((v) => v.lang.startsWith("en") && /female|zira|samantha|karen|victoria/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en"))
    if (pick) u.voice = pick
    u.onstart = () => setSpeaking(true)
    u.onend   = () => { setSpeaking(false); setSubtitle("") }
    u.onerror = () => { setSpeaking(false); setSubtitle("") }
    utterRef.current = u
    window.speechSynthesis.speak(u)
    setMode("browser")
  }, [])

  const speak = useCallback(
    async (text: string) => {
      if (!text) return
      cleanup()
      setSubtitle(text)
      setSpeaking(true)

      try {
        const res = await fetch(`${API}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        const ct = res.headers.get("content-type") || ""

        // Cloud audio response
        if (ct.includes("audio")) {
          const blob = await res.blob()
          const url = URL.createObjectURL(blob)
          urlRef.current = url
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => { setSpeaking(false); setSubtitle(""); cleanup() }
          audio.onerror = () => { setSpeaking(false); setSubtitle(""); cleanup() }
          await audio.play()
          setMode("audio")
          return
        }

        // Mock / fallback JSON response → use browser speech
        speakBrowser(text)
      } catch {
        speakBrowser(text)
      }
    },
    [cleanup, speakBrowser]
  )

  useEffect(() => cleanup, [cleanup])

  return { speak, stop, speaking, subtitle, mode }
}
