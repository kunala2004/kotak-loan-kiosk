"use client"
import { useState } from "react"
import { motion } from "framer-motion"
import { useKioskStore } from "@/lib/store"

const PLANS = [
  { id: "conservative", label: "Conservative", icon: "🛡️", tenureMod: 12, desc: "Lower EMI, longer tenure" },
  { id: "balanced",     label: "Balanced",     icon: "⚖️", tenureMod: 0,  desc: "Recommended", popular: true },
  { id: "fasttrack",    label: "Fast Track",   icon: "🚀", tenureMod: -12, desc: "Pay off faster" },
]

function calcEmi(principal: number, rate: number, months: number): number {
  if (!principal || principal <= 0 || !months || months <= 0) return 0
  const r = rate / 1200
  if (r === 0) return Math.round(principal / months)
  return Math.round(
    (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  )
}

function pct(value: number, min: number, max: number): number {
  if (max <= min) return 100
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

export default function EMIOptimizer() {
  const { eligibilityResult, loanConfig, financialAnswers, setLoanConfig, setStage } = useKioskStore()

  // Safe defaults — never crash even if state is missing
  const rate      = eligibilityResult?.interest_rate ?? 9.25
  const maxAmount = eligibilityResult?.approved_amount ?? 1000000
  const minAmount = 100000

  const [amount, setAmount] = useState<number>(
    loanConfig?.approved_amount ?? maxAmount
  )
  const [tenure, setTenure] = useState<number>(
    loanConfig?.tenure_months ?? 60
  )
  const [activePlan, setActivePlan] = useState("balanced")

  const emi = calcEmi(amount, rate, tenure)
  const amountPct = pct(amount, minAmount, maxAmount)
  const tenurePct = pct(tenure, 24, 84)

  const applyPlan = (planId: string) => {
    const plan = PLANS.find((p) => p.id === planId)
    if (!plan) return
    setActivePlan(planId)
    const base = loanConfig?.tenure_months ?? 60
    setTenure(Math.min(84, Math.max(24, base + plan.tenureMod)))
  }

  const handleContinue = () => {
    setLoanConfig({
      approved_amount: amount,
      rate,
      tenure_months: tenure,
      emi,
      down_payment: loanConfig?.down_payment ?? financialAnswers.down_payment,
    })
    setStage("phone_capture")
  }

  return (
    <motion.div
      className="w-full h-full flex flex-col items-center justify-center pb-28 px-8"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.35 }}
    >
      <div className="max-w-2xl w-full">
        <p className="text-white/40 text-sm mb-1">Step 4 of 5</p>
        <h2 className="text-white font-bold text-3xl mb-2">Customize your loan ⚙️</h2>
        <p className="text-white/50 text-base mb-8">Adjust sliders to find your perfect EMI</p>

        {/* Quick Plans */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {PLANS.map((plan) => (
            <motion.button
              key={plan.id}
              onClick={() => applyPlan(plan.id)}
              className={`relative p-5 rounded-2xl border text-center transition-all ${
                activePlan === plan.id
                  ? "border-[#E31837] bg-[#E31837]/15 glow-red"
                  : "glass border-white/10 hover:border-white/25"
              }`}
              whileTap={{ scale: 0.96 }}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#F5A623] text-[#080B14] text-[10px] font-black px-3 py-0.5 rounded-full">
                  RECOMMENDED
                </span>
              )}
              <div className="text-2xl mb-2">{plan.icon}</div>
              <p className="text-white font-bold">{plan.label}</p>
              <p className="text-white/40 text-xs mt-1">{plan.desc}</p>
            </motion.button>
          ))}
        </div>

        {/* Live EMI Display */}
        <div className="glass rounded-3xl p-8 mb-8 border border-white/10 text-center">
          <p className="text-white/40 text-sm mb-1">Your Monthly EMI</p>
          <motion.p
            key={emi}
            className="text-white font-black text-6xl mb-4"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            ₹{emi > 0 ? emi.toLocaleString("en-IN") : "—"}
          </motion.p>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Loan Amount", value: `₹${(amount / 100000).toFixed(1)}L` },
              { label: "Rate",        value: `${rate}% p.a.` },
              { label: "Tenure",      value: `${tenure} months` },
            ].map((item) => (
              <div key={item.label} className="glass rounded-xl p-3 text-center">
                <p className="text-white/40 text-xs">{item.label}</p>
                <p className="text-white font-bold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div className="flex flex-col gap-6 mb-8">

          {/* Loan Amount slider */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white/60 text-sm">Loan Amount</span>
              <span className="text-white font-bold">₹{(amount / 100000).toFixed(1)}L</span>
            </div>
            <input
              type="range"
              min={minAmount}
              max={maxAmount}
              step={10000}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-2 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #E31837 ${amountPct}%, rgba(255,255,255,0.12) ${amountPct}%)`,
              }}
            />
            <div className="flex justify-between mt-1 text-white/30 text-xs">
              <span>₹{(minAmount / 100000).toFixed(0)}L</span>
              <span>₹{(maxAmount / 100000).toFixed(1)}L (max approved)</span>
            </div>
          </div>

          {/* Tenure slider */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-white/60 text-sm">Tenure</span>
              <span className="text-white font-bold">{tenure} months ({Math.round(tenure / 12)} yrs)</span>
            </div>
            <input
              type="range"
              min={24}
              max={84}
              step={12}
              value={tenure}
              onChange={(e) => setTenure(Number(e.target.value))}
              className="w-full h-2 appearance-none rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, #E31837 ${tenurePct}%, rgba(255,255,255,0.12) ${tenurePct}%)`,
              }}
            />
            <div className="flex justify-between mt-1 text-white/30 text-xs">
              <span>2 years</span>
              <span>7 years</span>
            </div>
          </div>
        </div>

        <motion.button
          onClick={handleContinue}
          className="gradient-red glow-red text-white font-bold text-xl px-12 py-5 rounded-2xl w-full"
          whileTap={{ scale: 0.97 }}
        >
          Lock in this EMI →
        </motion.button>
      </div>
    </motion.div>
  )
}
