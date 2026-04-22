"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type Application = {
  application_id: string
  customer_name: string
  phone: string
  status: string
  stage: string
  car: { brand: string; model: string; variant: string }
  loan: { approved_amount: number; emi: number; rate: number; tenure_months: number }
  bureau_data: { cibil: number; profile_label: string; age: number }
  created_at: string
}

const STATUS_COLOR: Record<string, string> = {
  submitted:  "bg-blue-100 text-blue-700",
  sanctioned: "bg-green-100 text-green-700",
  disbursed:  "bg-purple-100 text-purple-700",
}

const STATUS_LABEL: Record<string, string> = {
  submitted:  "Pending Review",
  sanctioned: "Sanctioned",
  disbursed:  "Disbursed",
}

export default function DealerDashboard() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchApps = async () => {
    try {
      const res = await fetch(`${API}/dealer/applications`)
      if (!res.ok) throw new Error("API error")
      const data = await res.json()
      setApps(data)
    } catch {
      setError("Could not reach backend — make sure the server is running on port 8000.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApps()
    const interval = setInterval(fetchApps, 10000) // poll every 10s
    return () => clearInterval(interval)
  }, [])

  const total     = apps.length
  const pending   = apps.filter((a) => a.status === "submitted").length
  const sanctioned = apps.filter((a) => a.status === "sanctioned").length
  const disbursed = apps.filter((a) => a.status === "disbursed").length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
        <p className="text-slate-500 text-sm mt-1">Real-time feed from the kiosk. Refreshes every 10 seconds.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total",      value: total,     color: "text-slate-900" },
          { label: "Pending",    value: pending,   color: "text-blue-600"  },
          { label: "Sanctioned", value: sanctioned, color: "text-green-600" },
          { label: "Disbursed",  value: disbursed, color: "text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5">
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading applications…</div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-red-500 font-medium mb-1">Connection Error</p>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        ) : apps.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-4xl mb-4">📋</p>
            <p className="text-slate-600 font-semibold">No applications yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Applications will appear here as customers complete the kiosk journey.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {["Customer", "Car", "Loan Amount", "EMI", "CIBIL", "Status", "Action"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.map((app) => (
                <tr key={app.application_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{app.customer_name}</p>
                    <p className="text-slate-400 text-xs">{app.phone}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-700">{app.car.brand} {app.car.model}</p>
                    <p className="text-slate-400 text-xs">{app.car.variant}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-slate-900">
                    ₹{(app.loan.approved_amount / 100000).toFixed(1)}L
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    ₹{app.loan.emi.toLocaleString("en-IN")}/mo
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      app.bureau_data.cibil >= 750 ? "bg-green-100 text-green-700" :
                      app.bureau_data.cibil >= 700 ? "bg-yellow-100 text-yellow-700" :
                      "bg-orange-100 text-orange-700"
                    }`}>
                      {app.bureau_data.cibil}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      STATUS_COLOR[app.status] || "bg-slate-100 text-slate-600"
                    }`}>
                      {STATUS_LABEL[app.status] || app.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/applications/${app.application_id}`}
                      className="text-[#E31837] font-semibold hover:underline text-sm"
                    >
                      Review →
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
