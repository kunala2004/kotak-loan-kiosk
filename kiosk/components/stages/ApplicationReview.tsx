"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { api } from "@/lib/api"

export default function ApplicationReview() {
  const { selectedCar, bureauData, loanConfig, phone, pan, setApplicationId, setStage } = useKioskStore()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const r = await api.submitApplication({
        customer_name: bureauData?.name,
        phone,
        pan,
        bureau_data: bureauData,
        car: selectedCar,
        loan: {
          approved_amount: loanConfig?.approved_amount,
          rate: loanConfig?.rate,
          tenure_months: loanConfig?.tenure_months,
          emi: loanConfig?.emi,
          down_payment: loanConfig?.down_payment,
        },
      })
      setApplicationId(r.application_id)
      setStage("waiting")
    } catch {
      setSubmitting(false)
    }
  }

  if (!selectedCar || !bureauData || !loanConfig) return null

  const rows = [
    { label: "Car", value: `${selectedCar.brand} ${selectedCar.model} ${selectedCar.variant}` },
    { label: "Ex-showroom Price", value: `₹${(selectedCar.price / 100000).toFixed(2)}L` },
    { label: "Down Payment", value: `₹${(loanConfig.down_payment / 100000).toFixed(2)}L` },
    { label: "Loan Amount", value: `₹${(loanConfig.approved_amount / 100000).toFixed(2)}L` },
    { label: "Interest Rate", value: `${loanConfig.rate}% p.a.` },
    { label: "Tenure", value: `${loanConfig.tenure_months} months` },
    { label: "Monthly EMI", value: `₹${loanConfig.emi.toLocaleString()}` },
    { label: "Applicant", value: bureauData.name },
    { label: "Mobile", value: `+91 ${phone}` },
  ]

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28 px-8"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
    >
      <div className="max-w-lg w-full">
        <p className="text-white/40 text-sm mb-1">Step 5 of 5</p>
        <h2 className="text-white font-bold text-3xl mb-2">Review your application 📋</h2>
        <p className="text-white/50 text-base mb-6">Everything look good? Tap confirm to submit.</p>

        <div className="glass rounded-2xl border border-white/10 divide-y divide-white/8 mb-6 overflow-hidden">
          {rows.map((row, i) => (
            <motion.div
              key={row.label}
              className="flex items-center justify-between px-6 py-4"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <span className="text-white/50 text-sm">{row.label}</span>
              <span className={`text-sm font-semibold ${
                row.label === "Monthly EMI" ? "text-[#F5A623] text-base" : "text-white"
              }`}>{row.value}</span>
            </motion.div>
          ))}
        </div>

        <p className="text-white/30 text-xs text-center mb-5">
          Pre-approval subject to document verification · Offer valid 48 hours
        </p>

        <motion.button
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full py-5 rounded-2xl font-bold text-xl transition-all ${
            submitting ? "bg-white/10 text-white/40" : "gradient-red glow-red text-white"
          }`}
          whileTap={!submitting ? { scale: 0.97 } : {}}
        >
          {submitting ? "Submitting..." : "✅ Confirm & Submit Application"}
        </motion.button>

        <button
          onClick={() => setStage("emi_optimizer")}
          className="w-full text-white/30 text-sm mt-3 py-2 hover:text-white/50 transition-colors"
        >
          ← Go back and edit
        </button>
      </div>
    </motion.div>
  )
}
