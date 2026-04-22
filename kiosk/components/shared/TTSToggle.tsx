"use client"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Provider = "mock" | "elevenlabs" | "azure"

interface TTSConfig {
  provider: Provider
  env_default: Provider
  elevenlabs_configured: boolean
  azure_configured: boolean
}

/**
 * Runtime ON/OFF switch for ElevenLabs TTS.
 * OFF = mock mode (browser speech, zero API cost).
 * ON  = whatever cloud provider the .env is configured with.
 */
export default function TTSToggle() {
  const [config, setConfig] = useState<TTSConfig | null>(null)
  const [loading, setLoading] = useState(false)

  // Fetch current state on mount
  useEffect(() => {
    fetch(`${API}/tts/config`)
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => {})
  }, [])

  const toggle = async () => {
    if (!config || loading) return
    setLoading(true)
    // Flip: cloud providers ↔ mock. Remember the env default as "on" target.
    const cloudTarget: Provider =
      config.env_default === "mock"
        ? (config.elevenlabs_configured ? "elevenlabs" : "azure")
        : config.env_default
    const next: Provider = config.provider === "mock" ? cloudTarget : "mock"
    try {
      const res = await fetch(`${API}/tts/provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      })
      const data = await res.json()
      if (data.active) setConfig((c) => c ? { ...c, provider: data.active } : c)
    } finally {
      setLoading(false)
    }
  }

  if (!config) return null

  const isCloud = config.provider !== "mock"
  const cloudName = config.provider === "elevenlabs" ? "ElevenLabs" : config.provider === "azure" ? "Azure" : "Cloud"

  return (
    <motion.button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
        isCloud
          ? "bg-[#E31837]/15 border-[#E31837]/40 text-[#FF6B7A] hover:bg-[#E31837]/25"
          : "bg-white/5 border-white/15 text-white/50 hover:bg-white/10"
      } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
      whileTap={{ scale: 0.95 }}
      title={isCloud ? `${cloudName} voice is ON — click to save credits` : `Browser voice (free) — click to enable ${config.env_default}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${isCloud ? "bg-[#E31837] animate-pulse" : "bg-white/30"}`}
      />
      {isCloud ? `🎙 ${cloudName}` : "🔇 Browser"}
    </motion.button>
  )
}
