"use client"
import { createContext, useContext, useEffect, useRef, ReactNode } from "react"
import { useAvatar } from "./useAvatar"

type AvatarCtx = ReturnType<typeof useAvatar>

const AvatarContext = createContext<AvatarCtx | null>(null)

export function AvatarProvider({ children }: { children: ReactNode }) {
  const avatar = useAvatar()
  // Fire the WebRTC handshake the moment the kiosk loads.
  // Ref guard makes this idempotent — survives React StrictMode's double-invoke
  // in dev without ever kicking off two parallel sessions.
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    avatar.start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AvatarContext.Provider value={avatar}>
      {children}
    </AvatarContext.Provider>
  )
}

export function useAvatarContext(): AvatarCtx {
  const ctx = useContext(AvatarContext)
  if (!ctx) throw new Error("useAvatarContext must be used inside <AvatarProvider>")
  return ctx
}
