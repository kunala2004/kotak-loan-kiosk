"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import AIReviewPanel from "@/components/AIReviewPanel"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Notification = {
  sent_at: string
  channel: string
  phone: string | null
  message: string
  status: string
}

type DocRequirement = {
  id: string
  label: string
  desc: string
  icon: string
  source: string
  eta_seconds: number
}

type DocState = {
  fetching: boolean
  fetched:  boolean
  data:     Record<string, any> | null
  error:    string
}

type Application = {
  application_id: string
  customer_name: string
  phone: string
  pan: string
  status: string
  stage: string
  car: { brand: string; model: string; variant: string; price: number }
  loan: { approved_amount: number; emi: number; rate: number; tenure_months: number; down_payment: number }
  bureau_data: {
    cibil: number
    profile_label: string
    age: number
    employment_verified?: string
    existing_emi_total?: number
    existing_emi?: number
    _internal?: { employment_verified?: string; monthly_income_verified?: number }
  }
  financial_answers?: { income_range: string; employment_type: string }
  documents: Record<string, { data: Record<string, any>; source: string; verified_at: string }>
  notifications?: Notification[]
  timeline: Array<{ stage: string; at: string }>
  created_at: string
  sanctioned_at?: string
  disbursed_at?: string
}

function fmt(amount: number) {
  return `₹${(amount / 100000).toFixed(1)}L`
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function renderDocData(data: Record<string, any>) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mt-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2">
          <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}</span>
          <span className="text-slate-700 font-medium text-right truncate">
            {typeof v === "boolean"  ? (v ? "Yes" : "No")
             : v === null             ? "—"
             : typeof v === "number"  ? v.toLocaleString("en-IN")
             : String(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ClientApplicationDetail() {
  const { id } = useParams<{ id: string }>()
  const [app,        setApp]           = useState<Application | null>(null)
  const [docReqs,    setDocReqs]       = useState<DocRequirement[]>([])
  const [docs,       setDocs]          = useState<Record<string, DocState>>({})
  const [brief,      setBrief]         = useState("")
  const [briefLoading, setBriefLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionMsg,  setActionMsg]     = useState("")
  const [loading,    setLoading]       = useState(true)

  const reload = async () => {
    try {
      const [appRes, reqRes] = await Promise.all([
        fetch(`${API}/dealer/applications/${id}`).then((r) => r.json()),
        fetch(`${API}/dealer/applications/${id}/doc-requirements`).then((r) => r.json()),
      ])
      setApp(appRes)
      const reqs: DocRequirement[] = reqRes.docs || []
      setDocReqs(reqs)
      // Seed / merge doc state
      setDocs((prev) => {
        const next: Record<string, DocState> = {}
        for (const r of reqs) {
          const already = appRes?.documents?.[r.id]
          next[r.id] = prev[r.id] || {
            fetching: false,
            fetched:  !!already,
            data:     already?.data || null,
            error:    "",
          }
          if (already && !next[r.id].data) next[r.id] = { ...next[r.id], fetched: true, data: already.data }
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [id])

  const fetchBrief = async () => {
    setBriefLoading(true)
    try {
      const res = await fetch(`${API}/dealer/applications/${id}/brief`)
      const data = await res.json()
      setBrief(data.brief)
    } catch {
      setBrief("Could not generate brief — check backend connection.")
    } finally {
      setBriefLoading(false)
    }
  }

  const fetchDoc = async (docId: string) => {
    setDocs((p) => ({ ...p, [docId]: { fetching: true, fetched: false, data: null, error: "" } }))
    const spec = docReqs.find((d) => d.id === docId)
    // Simulated network latency so the dealer "sees" the fetch happening
    await new Promise((r) => setTimeout(r, (spec?.eta_seconds || 2) * 1000))
    try {
      const res = await fetch(`${API}/dealer/applications/${id}/fetch-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "fetch failed")
      setDocs((p) => ({ ...p, [docId]: { fetching: false, fetched: true, data: data.data, error: "" } }))
      reload()
    } catch (e: any) {
      setDocs((p) => ({ ...p, [docId]: { fetching: false, fetched: false, data: null, error: e.message || "fetch failed" } }))
    }
  }

  const handleSanction = async () => {
    setActionLoading(true); setActionMsg("")
    try {
      const res = await fetch(`${API}/dealer/applications/${id}/sanction`, { method: "POST" })
      const data = await res.json()
      setActionMsg(`Sanctioned ✓ — ${fmt(data.approved_amount)} at ${data.rate}% · customer notified on ${data.notification?.phone}`)
      reload()
    } catch {
      setActionMsg("Sanction failed — try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleDisburse = async () => {
    setActionLoading(true); setActionMsg("")
    try {
      const res = await fetch(`${API}/dealer/applications/${id}/disburse`, { method: "POST" })
      const data = await res.json()
      setActionMsg(data.message + (data.notification ? ` · customer notified` : ""))
      reload()
    } catch {
      setActionMsg("Disbursement failed — try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const allFetched = docReqs.length > 0 && docReqs.every((r) => docs[r.id]?.fetched)

  if (loading) return <div className="p-12 text-center text-slate-400">Loading…</div>
  if (!app) {
    return (
      <div className="p-12 text-center">
        <p className="text-slate-600 font-semibold">Application not found</p>
        <Link href="/" className="text-[#E31837] text-sm mt-2 inline-block">← Back to dashboard</Link>
      </div>
    )
  }

  const bureau = app.bureau_data || {} as Application["bureau_data"]
  const loan   = app.loan || {} as Application["loan"]
  const car    = app.car  || {} as Application["car"]
  const cibil  = bureau.cibil ?? 0

  const cibilColor =
    cibil >= 750 ? "text-green-600" :
    cibil >= 700 ? "text-yellow-600" : "text-orange-600"

  const employmentText =
    app.financial_answers?.employment_type ||
    bureau.employment_verified ||
    bureau._internal?.employment_verified ||
    ""
  const isSalaried = employmentText.toLowerCase().includes("salaried") && !employmentText.toLowerCase().includes("self")
  const existingEmiValue = bureau.existing_emi ?? bureau.existing_emi_total ?? 0

  return (
    <div>
      <Link href="/" className="text-slate-500 text-sm hover:text-slate-700 mb-6 inline-flex items-center gap-1">
        ← All Applications
      </Link>

      <div className="grid grid-cols-3 gap-6 mt-4">
        <div className="col-span-2 space-y-6">

          {/* Customer card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{app.customer_name || "Customer"}</h1>
                <p className="text-slate-500 text-sm">
                  {app.phone || "—"} · Age {bureau.age ?? "—"} · {isSalaried ? "Salaried" : "Self-Employed"}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                app.status === "disbursed"  ? "bg-purple-100 text-purple-700" :
                app.status === "sanctioned" ? "bg-green-100 text-green-700"  :
                                              "bg-blue-100 text-blue-700"
              }`}>
                {app.status === "disbursed" ? "Disbursed" : app.status === "sanctioned" ? "Sanctioned" : "Pending Review"}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
              {[
                { label: "Car",           value: `${car.brand || "—"} ${car.model || ""}`.trim() },
                { label: "Loan Amount",   value: fmt(loan.approved_amount ?? 0) },
                { label: "EMI",           value: `₹${(loan.emi ?? 0).toLocaleString("en-IN")}/mo` },
                { label: "Rate",          value: `${loan.rate ?? 0}% p.a.` },
                { label: "Tenure",        value: `${loan.tenure_months ?? 0} months` },
                { label: "Down Payment",  value: fmt(loan.down_payment ?? 0) },
                { label: "CIBIL",         value: <span className={`font-bold ${cibilColor}`}>{cibil || "—"}</span> },
                { label: "Employment",    value: employmentText || "—" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-0.5">{item.label}</p>
                  <p className="text-slate-800 font-semibold text-sm">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* LangGraph Agentic Review */}
          <AIReviewPanel applicationId={id} onSanctioned={reload} />

          {/* AI Brief */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold text-slate-900">AI Dealer Brief</h2>
                <p className="text-slate-400 text-xs mt-0.5">Approach guide generated from this customer&apos;s structured profile.</p>
              </div>
              {!brief && (
                <button
                  onClick={fetchBrief}
                  disabled={briefLoading}
                  className="bg-[#E31837] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#c41530] disabled:opacity-50 transition-colors"
                >
                  {briefLoading ? "Generating…" : "Generate Brief"}
                </button>
              )}
            </div>
            {brief ? (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{brief}</p>
                <p className="text-slate-400 text-xs mt-3 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                  AI-generated · Credit decision made by rules engine
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center text-slate-400 text-sm">
                Click &quot;Generate Brief&quot; to get an AI-written customer approach guide.
              </div>
            )}
          </div>

          {/* Digital Document Collection */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="font-bold text-slate-900">Document Collection</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                allFetched ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}>
                {docReqs.filter((r) => docs[r.id]?.fetched).length}/{docReqs.length} complete
              </span>
            </div>
            <p className="text-slate-400 text-xs mb-5">
              Fetched digitally — no paperwork. {isSalaried ? "Salaried path: Form 16 from IT dept." : "Self-employed path: ITR with business details."}
            </p>

            <div className="space-y-3">
              {docReqs.map((doc) => {
                const d = docs[doc.id] || { fetching: false, fetched: false, data: null, error: "" }

                return (
                  <div
                    key={doc.id}
                    className={`p-4 rounded-xl border transition-all ${
                      d.fetched    ? "border-green-200 bg-green-50"  :
                      d.fetching   ? "border-blue-200 bg-blue-50"    :
                      d.error      ? "border-red-200 bg-red-50"      :
                                     "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{doc.icon}</span>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800 text-sm">{doc.label}</p>
                        <p className="text-slate-400 text-xs">{doc.desc}</p>
                        <p className="text-slate-400 text-[10px] mt-0.5 uppercase tracking-wide">Source: {doc.source}</p>
                      </div>
                      <div>
                        {d.fetched ? (
                          <span className="text-green-600 font-bold text-sm">✓ Fetched</span>
                        ) : d.fetching ? (
                          <span className="text-blue-600 text-sm inline-flex items-center gap-2">
                            <span className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            Fetching…
                          </span>
                        ) : (
                          <button
                            onClick={() => fetchDoc(doc.id)}
                            className="bg-white border border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg hover:border-[#E31837] hover:text-[#E31837] transition-colors"
                          >
                            Fetch Digitally
                          </button>
                        )}
                      </div>
                    </div>

                    {d.error && (
                      <p className="text-red-500 text-xs mt-2 font-medium">✕ {d.error}</p>
                    )}

                    {d.fetched && d.data && renderDocData(d.data)}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          {app.status !== "disbursed" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="font-bold text-slate-900 mb-4">Actions</h2>
              <div className="flex gap-3">
                {app.status === "submitted" && (
                  <button
                    onClick={handleSanction}
                    disabled={actionLoading || !allFetched}
                    className="bg-green-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? "Processing…" : "Sanction & Notify Customer"}
                  </button>
                )}
                {app.status === "sanctioned" && (
                  <button
                    onClick={handleDisburse}
                    disabled={actionLoading}
                    className="bg-purple-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-purple-700 disabled:opacity-40 transition-colors"
                  >
                    {actionLoading ? "Processing…" : "Disburse Amount"}
                  </button>
                )}
              </div>
              {!allFetched && app.status === "submitted" && (
                <p className="text-slate-400 text-xs mt-3">Fetch all {docReqs.length} documents to enable sanction.</p>
              )}
              {actionMsg && (
                <p className="text-green-600 font-semibold text-sm mt-3">{actionMsg}</p>
              )}
            </div>
          )}

          {app.status === "disbursed" && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-purple-700 font-bold">Disbursed Successfully</p>
              <p className="text-purple-500 text-sm mt-1">
                {fmt(loan.approved_amount ?? 0)} sent to dealer account
                {app.disbursed_at ? ` · ${timeAgo(app.disbursed_at)}` : ""}
              </p>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Notifications to customer */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-1">Customer Notifications</h2>
            <p className="text-slate-400 text-xs mb-4">Messages we&apos;ve sent to the customer&apos;s phone.</p>

            {(!app.notifications || app.notifications.length === 0) ? (
              <p className="text-slate-400 text-sm italic">
                No messages yet — send the first one by sanctioning the loan.
              </p>
            ) : (
              <ul className="space-y-3">
                {app.notifications.map((n, i) => (
                  <li key={i} className="border-l-2 border-green-500 pl-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-semibold">
                        📱 {n.channel === "mock_sms" ? "SMS" : n.channel}
                      </span>
                      <span className="text-slate-400">{timeAgo(n.sent_at)}</span>
                      <span className="text-green-600 font-semibold">· {n.status}</span>
                    </div>
                    <p className="text-slate-700 text-sm mt-1.5">{n.message}</p>
                    <p className="text-slate-400 text-xs mt-1">to {n.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-4">Timeline</h2>
            <div className="space-y-4">
              {(app.timeline || []).map((t, i, arr) => (
                <div key={i} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      t.stage.includes("disburse") ? "bg-purple-500" :
                      t.stage.includes("sanction") ? "bg-green-500"  :
                      t.stage.includes("doc")      ? "bg-blue-500"   :
                                                     "bg-slate-300"
                    }`} />
                    {i < arr.length - 1 && <div className="w-px flex-1 bg-slate-100 mt-1" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-slate-700 font-medium capitalize">
                      {t.stage.replace(/_/g, " ")}
                    </p>
                    <p className="text-slate-400 text-xs">{timeAgo(t.at)}</p>
                  </div>
                </div>
              ))}
              {(!app.timeline || app.timeline.length === 0) && (
                <p className="text-slate-400 text-xs italic">No timeline events yet.</p>
              )}
            </div>
          </div>

          {/* Profile */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="font-bold text-slate-900 mb-3">Customer Profile</h2>
            <div className="space-y-2 text-sm">
              {[
                { label: "Income",       value: app.financial_answers?.income_range || "—" },
                { label: "Employment",   value: employmentText || "—" },
                { label: "Existing EMI", value: existingEmiValue > 0 ? `₹${existingEmiValue.toLocaleString("en-IN")}/mo` : "None" },
                { label: "CIBIL Band",   value: bureau.profile_label || "—" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-slate-700 font-medium text-right max-w-[60%]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
