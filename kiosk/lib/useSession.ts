"use client"
import { useEffect, useRef, useState } from "react"
import { useKioskStore } from "./store"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

/**
 * Creates a kiosk session on mount and sends an event to the backend on
 * every stage transition. Sends a relevant snapshot of store state with
 * each event so the analytics dashboard can show "who picked what, when."
 *
 * The phone number sent is whatever is in the store at the time — if the
 * customer captured phone + dropped, we know who to follow up with.
 */
export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const lastStageRef = useRef<string>("")

  const {
    currentStage,
    selectedCar,
    financialAnswers,
    pan,
    bureauData,
    eligibilityResult,
    loanConfig,
    phone,
    applicationId,
  } = useKioskStore()

  // Start session on mount
  useEffect(() => {
    fetch(`${API}/session/start`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => setSessionId(data.session_id))
      .catch(() => {})
  }, [])

  // Log an event on every stage change
  useEffect(() => {
    if (!sessionId) return
    if (lastStageRef.current === currentStage) return
    lastStageRef.current = currentStage

    const data: Record<string, unknown> = {}

    if (selectedCar) {
      data.car = {
        brand:   selectedCar.brand,
        model:   selectedCar.model,
        variant: selectedCar.variant,
        price:   selectedCar.price,
      }
    }
    if (financialAnswers.employment_type || financialAnswers.income_range) {
      data.financial = financialAnswers
    }
    if (pan) {
      data.pan_masked = pan.length >= 5 ? `${pan.slice(0, 3)}XXX${pan.slice(-1)}` : "***"
    }
    if (bureauData) {
      data.bureau = {
        name:          bureauData.name,
        cibil_band:    bureauData.profile_label,
        age:           bureauData.age,
      }
    }
    if (eligibilityResult) {
      data.eligibility = {
        approved_amount: eligibilityResult.approved_amount,
        rate:            eligibilityResult.interest_rate,
        decision:        eligibilityResult.decision,
      }
    }
    if (loanConfig) {
      data.loan = {
        amount: loanConfig.approved_amount,
        emi:    loanConfig.emi,
        tenure: loanConfig.tenure_months,
      }
    }
    if (phone)          data.phone = phone
    if (applicationId)  data.application_id = applicationId

    fetch(`${API}/session/event`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ session_id: sessionId, stage: currentStage, data }),
    }).catch(() => {})
  }, [currentStage, sessionId, selectedCar, financialAnswers, pan, bureauData, eligibilityResult, loanConfig, phone, applicationId])

  // Register dropoff on unload if not completed
  useEffect(() => {
    if (!sessionId) return
    const handler = () => {
      if (currentStage !== "celebration") {
        const body = JSON.stringify({ session_id: sessionId, phone: phone || null })
        navigator.sendBeacon?.(
          `${API}/session/dropoff`,
          new Blob([body], { type: "application/json" })
        )
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [sessionId, currentStage, phone])

  return sessionId
}
