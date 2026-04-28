"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Event = {
  stage: string
  label: string
  at: string
  data: Record<string, any>
}

type SessionDetail = {
  session_id: string
  started_at: string
  last_seen_at: string
  current_stage: string
  status: "active" | "dropped" | "completed"
  phone: string | null
  application_id: string | null
  snapshot: Record<string, any>
  events: Event[]
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  } catch { return iso }
}

function diffSeconds(a: string, b: string) {
  try {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)
  } catch { return 0 }
}

function asLakh(n: number | undefined) {
  if (!n && n !== 0) return ""
  return `₹${(n / 100000).toFixed(1)}L`
}

function inr(n: number | undefined) {
  if (!n && n !== 0) return ""
  return `₹${n.toLocaleString("en-IN")}`
}

function pretty(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

type Field = { icon: string; label: string; value: string }

/**
 * Turns raw event / snapshot JSON into human-readable rows.
 * Skips empty / absent fields. Output is UI-ready.
 */
function readable(data: Record<string, any>): Field[] {
  if (!data) return []
  const out: Field[] = []

  if (data.car) {
    const c = data.car
    const parts = [
      [c.brand, c.model].filter(Boolean).join(" "),
      c.variant,
      c.price ? asLakh(c.price) : null,
    ].filter(Boolean)
    out.push({ icon: "🚗", label: "Car picked", value: parts.join(" · ") })
  }

  if (data.financial) {
    const f = data.financial
    const parts: string[] = []
    if (f.down_payment) parts.push(`Down payment ${asLakh(f.down_payment)}`)
    if (f.tenure_months) parts.push(`${f.tenure_months} month tenure`)
    if (f.employment_type) parts.push(pretty(f.employment_type))
    if (f.income_range) parts.push(`Income ${f.income_range}`)
    if (parts.length) out.push({ icon: "💰", label: "Financial answers", value: parts.join(" · ") })
  }

  if (data.pan_masked) {
    out.push({ icon: "🆔", label: "PAN entered", value: String(data.pan_masked) })
  }

  if (data.bureau) {
    const b = data.bureau
    const parts: string[] = []
    if (b.name) parts.push(b.name)
    if (b.age) parts.push(`age ${b.age}`)
    if (b.cibil_band) parts.push(`${pretty(b.cibil_band)} credit profile`)
    if (parts.length) out.push({ icon: "📊", label: "Bureau profile", value: parts.join(" · ") })
  }

  if (data.eligibility) {
    const e = data.eligibility
    const value =
      e.decision === "approved"
        ? `Approved ${asLakh(e.approved_amount)} at ${e.rate}% p.a.`
        : e.decision === "declined"
          ? "Declined — soft rejection"
          : pretty(String(e.decision || "—"))
    out.push({ icon: "✅", label: "Eligibility", value })
  }

  if (data.loan) {
    const l = data.loan
    const parts = [
      l.amount ? asLakh(l.amount) : null,
      l.emi ? `EMI ${inr(l.emi)}/mo` : null,
      l.tenure ? `${l.tenure} months` : null,
    ].filter(Boolean)
    if (parts.length) out.push({ icon: "🧮", label: "Final loan config", value: parts.join(" · ") })
  }

  if (data.phone) {
    out.push({ icon: "📞", label: "Phone shared", value: String(data.phone) })
  }

  if (data.application_id) {
    out.push({ icon: "📝", label: "Application submitted", value: String(data.application_id) })
  }

  return out
}

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  dropped:   "bg-orange-100 text-orange-700",
}

/* ── Component ──────────────────────────────────────────────────────────── */

export default function ClientSessionDetail() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/analytics/session/${id}`)
      .then((r) => r.json())
      .then(setSession)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-12 text-center text-slate-400">Loading…</div>
  if (!session || !session.session_id) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-600 font-semibold">Session not found</p>
        <Link href="/analytics" className="text-[#E31837] text-sm mt-2 inline-block">← Back to analytics</Link>
      </div>
    )
  }

  const totalSec = diffSeconds(session.started_at, session.last_seen_at)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60

  const snapshotRows = readable(session.snapshot)
  const customerName  = session.snapshot?.bureau?.name
  const customerCar   = session.snapshot?.car
  const customerCibil = session.snapshot?.bureau?.cibil_band
  const customerPhone = session.phone

  return (
    <div>
      <Link href="/analytics" className="text-slate-500 text-sm hover:text-slate-700 inline-flex items-center gap-1">
        ← All Sessions
      </Link>

      <div className="grid grid-cols-3 gap-6 mt-4">
        <div className="col-span-2 space-y-6">

          {/* Header card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide mb-1">Customer</p>
                <h1 className="text-xl font-bold text-slate-900">
                  {customerName || <span className="text-slate-400 font-normal">Anonymous visitor</span>}
                </h1>
                <p className="text-slate-500 text-sm mt-0.5">
                  {customerPhone ? <>📞 {customerPhone}</> : "No phone captured"}
                  {customerCar && <> · {customerCar.brand} {customerCar.model}</>}
                  {customerCibil && <> · {pretty(customerCibil)} credit</>}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[session.status] || "bg-slate-100 text-slate-600"}`}>
                {session.status === "active" ? "Live on kiosk" : pretty(session.status)}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 text-sm">
              {[
                { label: "Started",     value: fmtTime(session.started_at) },
                { label: "Last seen",   value: fmtTime(session.last_seen_at) },
                { label: "Duration",    value: `${mins}m ${secs}s` },
                { label: "Stages",      value: `${session.events.length} events` },
                { label: "Reached",     value: pretty(session.current_stage) },
                { label: "Application", value: session.application_id || "—" },
                { label: "Session ID",  value: <span className="font-mono text-xs text-slate-500">{session.session_id}</span> },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">{item.label}</p>
                  <p className="text-slate-800 font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Event timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-1">Journey Timeline</h2>
            <p className="text-slate-400 text-xs mb-5">What happened at each step, in order.</p>

            <ol className="relative">
              {session.events.map((e, i) => {
                const prev = i > 0 ? session.events[i - 1].at : session.started_at
                const delta = diffSeconds(prev, e.at)
                const fields = readable(e.data || {})
                const isLast = i === session.events.length - 1

                return (
                  <li key={i} className="relative pl-10 pb-6 last:pb-0">
                    {/* connector line */}
                    {!isLast && (
                      <span className="absolute left-3 top-5 bottom-0 w-px bg-slate-200" />
                    )}
                    {/* dot */}
                    <span className="absolute left-1.5 top-1.5 w-3.5 h-3.5 rounded-full bg-gradient-to-br from-[#E31837] to-amber-500 ring-4 ring-white" />

                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{e.label}</span>
                      <span className="text-slate-400 text-xs">{fmtTime(e.at)}</span>
                      {i > 0 && (
                        <span className="text-slate-300 text-xs">
                          {delta < 60 ? `+${delta}s` : `+${Math.floor(delta / 60)}m ${delta % 60}s`}
                        </span>
                      )}
                    </div>

                    {fields.length > 0 && (
                      <ul className="mt-2 space-y-1.5">
                        {fields.map((f, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm">
                            <span className="text-base leading-tight w-5 text-center">{f.icon}</span>
                            <div>
                              <span className="text-slate-400 text-xs uppercase tracking-wide mr-2">{f.label}</span>
                              <span className="text-slate-700">{f.value}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>

        {/* Right panel — customer snapshot */}
        <div>
          <div className="bg-white rounded-xl border border-slate-200 p-6 sticky top-24">
            <h2 className="font-bold text-slate-900 mb-1">Customer Snapshot</h2>
            <p className="text-slate-400 text-xs mb-4">Everything we know about this customer so far.</p>

            {snapshotRows.length === 0 ? (
              <p className="text-slate-400 text-sm italic">
                Customer left before sharing any details.
              </p>
            ) : (
              <ul className="space-y-3">
                {snapshotRows.map((f, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-xl leading-none">{f.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">{f.label}</p>
                      <p className="text-slate-800 text-sm font-medium break-words">{f.value}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {session.application_id && (
              <Link
                href={`/applications/${session.application_id}`}
                className="mt-5 block text-center bg-[#E31837] text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-[#c41530] transition-colors"
              >
                Open Full Application →
              </Link>
            )}

            {session.status === "dropped" && session.phone && (
              <div className="mt-5 p-3 rounded-lg bg-orange-50 border border-orange-100">
                <p className="text-orange-700 text-xs font-semibold">Dropped — follow-up ready</p>
                <p className="text-orange-600 text-xs mt-1">
                  The follow-up agent will reach out to {session.phone} with a personalised message.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
