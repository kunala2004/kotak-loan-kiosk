"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Overview = {
  total_sessions: number
  active: number
  completed: number
  dropped: number
  stale: number
  conversion_rate: number
  avg_duration_sec: number
  funnel: { stage: string; label: string; count: number; conversion: number }[]
  dropoff_hotspot: { stage: string; label: string; count: number; pct: number } | null
  popular_cars: { car: string; count: number }[]
}

type SessionRow = {
  session_id: string
  started_at: string
  last_seen_at: string
  current_stage: string
  current_label: string
  status: "active" | "dropped" | "completed"
  phone: string | null
  application_id: string | null
  car: { brand: string; model: string; variant: string } | null
  eligibility: { approved_amount: number; rate: number } | null
  events_count: number
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  dropped:   "bg-orange-100 text-orange-700",
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [insights, setInsights] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const load = async () => {
    try {
      const [o, s, i] = await Promise.all([
        fetch(`${API}/analytics/overview`).then((r) => r.json()),
        fetch(`${API}/analytics/sessions?limit=50`).then((r) => r.json()),
        fetch(`${API}/analytics/insights`).then((r) => r.json()),
      ])
      setOverview(o)
      setSessions(s)
      setInsights(i.bullets || [])
      setError("")
    } catch {
      setError("Could not reach backend — make sure it's running on port 8000.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading analytics…</div>
  }

  if (error || !overview) {
    return (
      <div className="p-12 text-center">
        <p className="text-red-500 font-medium mb-1">Connection Error</p>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    )
  }

  const maxFunnel = Math.max(1, ...overview.funnel.map((f) => f.count))
  const cr = Math.round(overview.conversion_rate * 100)
  const avgMin = overview.avg_duration_sec > 0 ? (overview.avg_duration_sec / 60).toFixed(1) : "—"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">
          Every kiosk visitor tracked — including drop-offs. Refreshes every 15 seconds.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Total Sessions", value: overview.total_sessions,              color: "text-slate-900" },
          { label: "Active Now",     value: overview.active,                      color: "text-blue-600"  },
          { label: "Completed",      value: overview.completed,                   color: "text-green-600" },
          { label: "Dropped",        value: overview.dropped,                     color: "text-orange-600" },
          { label: "Conversion",     value: overview.total_sessions ? `${cr}%` : "—", color: "text-[#E31837]" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="bg-gradient-to-br from-[#E31837]/5 to-amber-50 rounded-xl border border-[#E31837]/20 p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-[#E31837] flex items-center justify-center text-white text-xs font-bold">AI</div>
            <h2 className="font-bold text-slate-900">Insights</h2>
            <span className="text-slate-400 text-xs">generated over the funnel</span>
          </div>
          <ul className="space-y-2 text-slate-700 text-sm">
            {insights.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#E31837] font-bold">·</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-bold text-slate-900 mb-1">Journey Funnel</h2>
          <p className="text-slate-400 text-xs mb-5">Sessions that reached each stage at least once</p>
          <div className="space-y-2">
            {overview.funnel.map((f) => {
              const width = (f.count / maxFunnel) * 100
              const pct = Math.round(f.conversion * 100)
              return (
                <div key={f.stage} className="flex items-center gap-3">
                  <div className="w-36 text-xs text-slate-500 text-right">{f.label}</div>
                  <div className="flex-1 h-7 bg-slate-50 rounded relative overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#E31837] to-amber-500 rounded"
                      style={{ width: `${width}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-slate-700">
                      {f.count} {overview.total_sessions > 0 && <span className="text-slate-400 ml-2">({pct}%)</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Side panels */}
        <div className="space-y-6">
          {overview.dropoff_hotspot && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-2">Drop-off Hotspot</h3>
              <p className="text-2xl font-bold text-orange-600">{overview.dropoff_hotspot.label}</p>
              <p className="text-slate-500 text-sm mt-1">
                {overview.dropoff_hotspot.count} sessions left here ({overview.dropoff_hotspot.pct}%)
              </p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-3">Popular Cars</h3>
            {overview.popular_cars.length === 0 ? (
              <p className="text-slate-400 text-sm">No selections yet.</p>
            ) : (
              <ul className="space-y-2">
                {overview.popular_cars.map((c) => (
                  <li key={c.car} className="flex justify-between text-sm">
                    <span className="text-slate-700">{c.car}</span>
                    <span className="text-slate-500 font-semibold">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-2">Avg Time on Kiosk</h3>
            <p className="text-2xl font-bold text-slate-800">{avgMin}<span className="text-base text-slate-400 ml-1">min</span></p>
          </div>
        </div>
      </div>

      {/* Sessions table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-6 pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900">Recent Sessions</h2>
          <p className="text-slate-400 text-xs mt-0.5">Including drop-offs. Click a row to see the full timeline.</p>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No kiosk sessions yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {["Started", "Status", "Reached", "Car", "Eligibility", "Phone", "Steps", ""].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.session_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 text-slate-700">{timeAgo(s.started_at)}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[s.status] || "bg-slate-100 text-slate-600"}`}>
                      {s.status === "active" ? "Live" : s.status[0].toUpperCase() + s.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{s.current_label}</td>
                  <td className="px-5 py-3 text-slate-700">
                    {s.car ? `${s.car.brand} ${s.car.model}` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-700">
                    {s.eligibility ? `₹${(s.eligibility.approved_amount / 100000).toFixed(1)}L @ ${s.eligibility.rate}%` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {s.phone || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3 text-slate-500">{s.events_count}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/analytics/sessions/${s.session_id}`}
                      className="text-[#E31837] font-semibold text-sm hover:underline"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
