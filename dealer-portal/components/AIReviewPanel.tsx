"use client"
import { useCallback, useEffect, useRef, useState } from "react"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type EventLog = {
  step: string
  at: string
  note: string
  status?: string
}

type VerificationCheck = {
  field: string
  sources: string
  match: boolean
  detail: string
}

type Verification = {
  checks: VerificationCheck[]
  passed: number
  total: number
  flags: string[]
  confidence: number
  narrative?: string
}

type Recommendation = {
  decision: string
  confidence: number
  verified_income: number
  foir_pct: number
  foir_max_pct: number
  within_policy: boolean
}

type ReviewState = {
  application_id: string
  status: "not_started" | "running" | "waiting" | "completed" | "flagged"
  waiting_for: string | null
  prompt: string | null
  demo_hint: string | null
  events: EventLog[]
  docs: Record<string, Record<string, any>>
  verification: Verification | null
  recommendation: Recommendation | null
  brief: string | null
}

const STEP_ICONS: Record<string, string> = {
  start:            "▶",
  request_aadhaar:  "🪪",
  fetch_aadhaar:    "✓",
  request_aa:       "🏦",
  fetch_aa:         "✓",
  request_itr:      "📄",
  fetch_itr:        "✓",
  verify:           "🔍",
  underwrite:       "⚖️",
  brief:            "✍️",
  done:             "🎉",
  flagged:          "⚠",
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch { return iso }
}

interface Props {
  applicationId: string
  onSanctioned?: () => void
}

export default function AIReviewPanel({ applicationId, onSanctioned }: Props) {
  const [state, setState]         = useState<ReviewState | null>(null)
  const [loading, setLoading]     = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [otp, setOtp]             = useState("")
  const [sanctioning, setSanctioning] = useState(false)
  const [sanctionMsg, setSanctionMsg] = useState("")
  const logEndRef = useRef<HTMLDivElement>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch(`${API}/review/state/${applicationId}`)
      if (!res.ok) return
      setState(await res.json())
    } finally {
      setLoading(false)
    }
  }, [applicationId])

  useEffect(() => { fetchState() }, [fetchState])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [state?.events?.length])

  const start = async () => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/review/start/${applicationId}`, { method: "POST" })
      setState(await res.json())
    } finally {
      setActionLoading(false)
    }
  }

  const resume = async () => {
    if (!otp.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/review/resume/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: otp.trim() }),
      })
      setState(await res.json())
      setOtp("")
    } finally {
      setActionLoading(false)
    }
  }

  const reset = async () => {
    setActionLoading(true)
    try {
      await fetch(`${API}/review/reset/${applicationId}`, { method: "POST" })
      setState(null)
      await fetchState()
    } finally {
      setActionLoading(false)
    }
  }

  const sanction = async () => {
    setSanctioning(true); setSanctionMsg("")
    try {
      const res = await fetch(`${API}/dealer/applications/${applicationId}/sanction`, { method: "POST" })
      const data = await res.json()
      setSanctionMsg(`Sanctioned · customer notified at ${data.notification?.phone}`)
      onSanctioned?.()
    } catch {
      setSanctionMsg("Sanction failed — try again")
    } finally {
      setSanctioning(false)
    }
  }

  if (loading) {
    return <div className="p-6 bg-white border border-slate-200 rounded-xl text-slate-400 text-sm">Loading review…</div>
  }

  const notStarted = !state || state.status === "not_started"
  const waiting    = state?.status === "waiting"
  const completed  = state?.status === "completed"
  const flagged    = state?.status === "flagged"

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-[#E31837]/80 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <p className="font-bold">AI Review</p>
            <p className="text-white/60 text-xs">
              LangGraph · 5-agent pipeline · {completed ? "Complete" : flagged ? "Flagged for human" : waiting ? "Waiting for input" : notStarted ? "Ready to start" : "Running"}
            </p>
          </div>
        </div>
        {state && state.status !== "not_started" && (
          <button
            onClick={reset}
            className="text-white/50 text-xs hover:text-white transition-colors"
          >
            ↻ Restart
          </button>
        )}
      </div>

      <div className="p-6">
        {notStarted && (
          <div className="text-center py-6">
            <p className="text-slate-600 text-sm mb-4">
              One click, and 5 agents fetch Aadhaar, bank statements and ITR, cross-verify them, and recommend a decision.
            </p>
            <ul className="text-left text-slate-500 text-xs max-w-md mx-auto mb-5 space-y-1">
              <li>1. 🪪  Aadhaar eKYC — UIDAI OTP</li>
              <li>2. 🏦  Account Aggregator — 6 months of bank statements</li>
              <li>3. 📄  Form 26AS — Income Tax portal</li>
              <li>4. 🔍  Cross-verification (name, income, employment)</li>
              <li>5. ⚖️  Re-run underwriter rules on verified income</li>
              <li>6. ✍️  Compose dealer brief</li>
            </ul>
            <button
              onClick={start}
              disabled={actionLoading}
              className="bg-[#E31837] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#c41530] disabled:opacity-50 transition-colors"
            >
              {actionLoading ? "Starting…" : "▶ Start AI Review"}
            </button>
          </div>
        )}

        {state && state.status !== "not_started" && (
          <>
            {/* Event log */}
            <div className="bg-slate-900 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto font-mono">
              {state.events.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs mb-1.5">
                  <span className="text-slate-500 min-w-[60px]">{fmtTime(e.at)}</span>
                  <span className="w-5 text-center">{STEP_ICONS[e.step] || "•"}</span>
                  <span className={`flex-1 ${
                    e.status === "error"   ? "text-red-400" :
                    e.status === "warning" ? "text-amber-400" :
                    e.status === "success" ? "text-green-400" :
                                             "text-slate-200"
                  }`}>{e.note}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>

            {/* Waiting for OTP / consent */}
            {waiting && (
              <div className="border-2 border-amber-400 rounded-lg p-4 mb-4 bg-amber-50">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl">📱</span>
                  <div className="flex-1">
                    <p className="font-bold text-amber-900 text-sm">{state.prompt}</p>
                    {state.demo_hint && (
                      <p className="text-amber-700 text-xs mt-1 font-semibold bg-amber-100 inline-block px-2 py-0.5 rounded">
                        💡 {state.demo_hint}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter 6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-800 text-base font-mono tracking-widest focus:border-[#E31837] focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && resume()}
                  />
                  <button
                    onClick={resume}
                    disabled={otp.length < 6 || actionLoading}
                    className="bg-[#E31837] text-white font-semibold px-5 rounded-lg hover:bg-[#c41530] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? "…" : "Submit"}
                  </button>
                </div>
              </div>
            )}

            {/* Verification matrix */}
            {state.verification && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-slate-900 text-sm">Cross-verification</p>
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    state.verification.passed === state.verification.total
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {state.verification.passed}/{state.verification.total} passed
                  </span>
                </div>
                {state.verification.narrative && (
                  <p className="text-slate-600 text-xs italic mb-3">{state.verification.narrative}</p>
                )}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      {state.verification.checks.map((c, i) => (
                        <tr key={i} className={c.match ? "" : "bg-red-50"}>
                          <td className="px-3 py-2 w-6 text-center">
                            {c.match ? <span className="text-green-600 font-bold">✓</span>
                                     : <span className="text-red-600 font-bold">✕</span>}
                          </td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{c.field}</td>
                          <td className="px-3 py-2 text-slate-500">{c.sources}</td>
                          <td className="px-3 py-2 text-slate-600 font-mono text-[11px]">{c.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {state.verification.flags.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <p className="font-semibold mb-1">Flags:</p>
                    <ul className="list-disc list-inside">
                      {state.verification.flags.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recommendation + brief */}
            {state.recommendation && state.brief && (
              <div className={`rounded-lg border-2 p-4 mb-4 ${
                state.recommendation.decision === "SANCTION"
                  ? "border-green-300 bg-green-50"
                  : "border-amber-300 bg-amber-50"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-slate-900">
                    Agent Recommendation: <span className={state.recommendation.decision === "SANCTION" ? "text-green-700" : "text-amber-700"}>
                      {state.recommendation.decision}
                    </span>
                  </p>
                  <span className="text-xs text-slate-500">
                    {Math.round(state.recommendation.confidence * 100)}% confidence
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3 text-xs">
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Verified Income</p>
                    <p className="text-slate-800 font-semibold">₹{state.recommendation.verified_income.toLocaleString("en-IN")}/mo</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">FOIR (verified)</p>
                    <p className="text-slate-800 font-semibold">{state.recommendation.foir_pct}%</p>
                  </div>
                  <div>
                    <p className="text-slate-400 uppercase tracking-wide">Policy Cap</p>
                    <p className="text-slate-800 font-semibold">{state.recommendation.foir_max_pct}%</p>
                  </div>
                </div>
                <p className="text-slate-700 text-sm leading-relaxed border-t border-slate-200 pt-3">
                  {state.brief}
                </p>
              </div>
            )}

            {/* Sanction one-click */}
            {completed && state.recommendation?.decision === "SANCTION" && (
              <button
                onClick={sanction}
                disabled={sanctioning}
                className="w-full bg-green-600 text-white font-bold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {sanctioning ? "Sanctioning…" : "✓ Sanction & Notify Customer"}
              </button>
            )}

            {sanctionMsg && (
              <p className="text-green-600 text-sm font-semibold mt-3 text-center">{sanctionMsg}</p>
            )}

            {flagged && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4 text-center">
                <p className="font-bold text-amber-900 mb-1">⚠ Flagged for Human Review</p>
                <p className="text-amber-700 text-xs">
                  The agent detected discrepancies and stopped. Manual verification required.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
