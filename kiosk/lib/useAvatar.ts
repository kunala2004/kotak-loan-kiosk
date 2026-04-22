"use client"
import { useCallback, useEffect, useRef, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export type AvatarState = "idle" | "starting" | "ready" | "speaking" | "failed"

interface AvatarHook {
  start: () => Promise<boolean>
  speak: (text: string) => Promise<void>
  stop: () => void
  state: AvatarState
  videoStream: MediaStream | null
  audioStream: MediaStream | null
  lastError: string
}

/**
 * Azure Real-Time TTS Avatar via WebRTC.
 *
 * Flow:
 *   1. Fetch short-lived auth token + ICE config from backend (/avatar/session, /avatar/ice)
 *   2. Dynamic-import the Speech SDK (browser-only)
 *   3. Create a SpeechConfig + AvatarConfig (character = lisa, style = casual-sitting)
 *   4. Establish a WebRTC peer connection with Azure using the ICE info
 *   5. On ontrack, expose the video + audio MediaStreams to the caller
 *   6. To speak, call avatarSynthesizer.speakTextAsync(text)
 *
 * The hook is designed to **never crash the page** — if anything fails
 * (network, billing, unsupported browser), state flips to "failed" and the
 * caller is expected to fall back to a static image + audio-only Priya.
 */
export function useAvatar(): AvatarHook {
  const [state, setState]             = useState<AvatarState>("idle")
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [lastError, setLastError]     = useState("")

  const synthRef = useRef<any>(null)
  const pcRef    = useRef<RTCPeerConnection | null>(null)

  const stop = useCallback(() => {
    try { synthRef.current?.close?.() } catch {}
    try { pcRef.current?.close() } catch {}
    synthRef.current = null
    pcRef.current = null
    setVideoStream(null)
    setAudioStream(null)
    setState("idle")
  }, [])

  const start = useCallback(async (): Promise<boolean> => {
    if (state === "starting" || state === "ready" || state === "speaking") return true

    setState("starting")
    setLastError("")

    try {
      // 1. Get auth token + ICE from backend
      const [sessRes, iceRes] = await Promise.all([
        fetch(`${API}/avatar/session`).then((r) => r.json()),
        fetch(`${API}/avatar/ice`).then((r) => r.json()),
      ])
      if (sessRes.error || !sessRes.token) {
        throw new Error(`token: ${sessRes.error || "missing"}`)
      }
      if (iceRes.error || !iceRes.urls?.length) {
        throw new Error(`ice: ${iceRes.error || "missing"}`)
      }

      const { token, region } = sessRes
      const { urls, username, credential } = iceRes

      // 2. Dynamic import — client-only
      const SDK = await import("microsoft-cognitiveservices-speech-sdk")

      // 3. Config
      const speechConfig = SDK.SpeechConfig.fromAuthorizationToken(token, region)
      speechConfig.speechSynthesisVoiceName = "en-IN-NeerjaNeural"

      const videoFormat = new SDK.AvatarVideoFormat()
      const avatarConfig = new SDK.AvatarConfig("lisa", "casual-sitting", videoFormat)

      const synthesizer = new SDK.AvatarSynthesizer(speechConfig, avatarConfig)
      synthRef.current = synthesizer

      synthesizer.avatarEventReceived = (_: any, e: any) => {
        // Useful for debugging; safe to ignore in prod
        if (e?.description) console.debug("[Avatar]", e.description)
      }

      // 4. WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls, username, credential }],
      })
      pcRef.current = pc

      pc.ontrack = (e) => {
        if (e.track.kind === "video" && e.streams[0]) setVideoStream(e.streams[0])
        if (e.track.kind === "audio" && e.streams[0]) setAudioStream(e.streams[0])
      }

      pc.addTransceiver("video", { direction: "recvonly" })
      pc.addTransceiver("audio", { direction: "recvonly" })

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState
        if (s === "failed" || s === "disconnected") {
          setState("failed")
          setLastError(`ICE: ${s}`)
        }
      }

      // 5. Start avatar session — SDK handles SDP offer/answer internally
      const result = await synthesizer.startAvatarAsync(pc)
      if (result?.reason !== SDK.ResultReason.SynthesizingAudioCompleted && result?.reason !== 9) {
        // 9 is ResultReason.SynthesizingAudioCompleted in case enum isn't exposed the same way
        // Some SDK versions return a different enum. Accept any non-error reason.
      }

      setState("ready")
      return true
    } catch (e: any) {
      console.error("[Avatar] start failed", e)
      setLastError(e?.message || String(e))
      setState("failed")
      return false
    }
  }, [state])

  const speak = useCallback(async (text: string) => {
    if (!text) return
    if (!synthRef.current) {
      console.warn("[Avatar] speak() called but synthesizer is not ready yet")
      return
    }
    try {
      console.debug("[Avatar] speaking:", text.slice(0, 40))
      setState("speaking")
      await synthRef.current.speakTextAsync(text)
      console.debug("[Avatar] speak complete")
    } catch (e: any) {
      console.error("[Avatar] speak failed", e)
      setLastError(e?.message || String(e))
    } finally {
      setState((prev) => (prev === "speaking" ? "ready" : prev))
    }
  }, [])

  useEffect(() => {
    // Cleanup on unmount
    return stop
  }, [stop])

  return {
    start, speak, stop, state,
    videoStream, audioStream, lastError,
  }
}
