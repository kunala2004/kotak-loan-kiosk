"use client"
import { useState } from "react"
import { useKioskStore } from "@/lib/store"

const TENURES = [
  { months: 24, label: "2 Yrs" },
  { months: 36, label: "3 Yrs" },
  { months: 48, label: "4 Yrs" },
  { months: 60, label: "5 Yrs", popular: true },
  { months: 72, label: "6 Yrs" },
]

const EMPLOYMENT_TYPES = [
  { id: "Salaried Corporate",  label: "Salaried",       sub: "Corporate / Private",    icon: "💼" },
  { id: "Salaried Government", label: "Government",     sub: "PSU / Govt Employee",    icon: "🏛️" },
  { id: "Self-Employed",       label: "Self Employed",  sub: "Freelancer / Consultant", icon: "💻" },
  { id: "Business Owner",      label: "Business Owner", sub: "Proprietor / Director",  icon: "🏪" },
]

const INCOME_RANGES = [
  { id: "Under 30K", label: "Under ₹30K / month" },
  { id: "30K - 50K", label: "₹30K – 50K / month" },
  { id: "50K - 75K", label: "₹50K – 75K / month" },
  { id: "75K - 1L",  label: "₹75K – 1L / month"  },
  { id: "Above 1L",  label: "Above ₹1L / month"  },
]

function calcEmi(principal: number, rate: number, months: number) {
  if (!principal || !months) return 0
  const r = rate / 1200
  return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1))
}

export default function FinancialDiscovery() {
  const { selectedCar, financialAnswers, setFinancialAnswers, setStage } = useKioskStore()
  const [step, setStep] = useState(0)

  const price = selectedCar?.price ?? 0
  const down  = financialAnswers.down_payment
  const tenure = financialAnswers.tenure_months || 60
  const emi = calcEmi(price - down, 9.25, tenure)

  const downPct = price > 0 ? Math.round((down / price) * 100) : 0
  const downLabel =
    downPct < 10 ? "Just starting" :
    downPct < 20 ? "Good start" :
    downPct < 30 ? "Strong" : "Excellent!"

  // Step 0 — Down payment
  if (step === 0) return (
    <div className="w-full h-full flex flex-col items-center justify-center pb-28 px-8">
      <div className="w-full max-w-xl">
        <p className="text-white/40 text-sm mb-1">Step 2 of 5 · Question 1 of 4</p>
        <h2 className="text-white font-bold text-3xl mb-8">How much down payment can you arrange?</h2>

        <div className="glass rounded-2xl p-8 mb-6 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[#F5A623] font-bold text-4xl">
              ₹{(down / 100000).toFixed(1)}L
            </span>
            <span className={`text-sm px-3 py-1 rounded-full font-medium ${
              downPct >= 20 ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/50"
            }`}>{downLabel}</span>
          </div>

          <input
            type="range"
            min={0}
            max={Math.round(price * 0.5)}
            step={10000}
            value={down}
            onChange={(e) => setFinancialAnswers({ down_payment: Number(e.target.value) })}
            className="w-full h-2 appearance-none rounded-full cursor-pointer mb-2"
            style={{
              background: `linear-gradient(to right, #E31837 ${downPct * 2}%, rgba(255,255,255,0.12) ${downPct * 2}%)`
            }}
          />
          <div className="flex justify-between text-white/30 text-xs">
            <span>₹0</span>
            <span>₹{(price * 0.5 / 100000).toFixed(0)}L</span>
          </div>

          {emi > 0 && (
            <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
              <span className="text-white/50 text-sm">Estimated EMI</span>
              <span className="text-white font-bold text-xl">₹{emi.toLocaleString("en-IN")}/mo</span>
            </div>
          )}
        </div>

        <button
          onClick={() => setStep(1)}
          className="w-full gradient-red text-white font-bold text-lg py-4 rounded-xl"
        >
          Next →
        </button>
      </div>
    </div>
  )

  // Step 1 — Tenure
  if (step === 1) return (
    <div className="w-full h-full flex flex-col items-center justify-center pb-28 px-8">
      <div className="w-full max-w-xl">
        <p className="text-white/40 text-sm mb-1">Step 2 of 5 · Question 2 of 4</p>
        <h2 className="text-white font-bold text-3xl mb-2">How long do you want to repay?</h2>
        <p className="text-white/50 text-sm mb-8">Longer tenure = lower EMI</p>

        <div className="flex flex-col gap-3 mb-6">
          {TENURES.map((t) => {
            const tEmi = calcEmi(price - down, 9.25, t.months)
            const selected = financialAnswers.tenure_months === t.months
            return (
              <button
                key={t.months}
                onClick={() => { setFinancialAnswers({ tenure_months: t.months }); setStep(2) }}
                className={`flex items-center justify-between px-6 py-4 rounded-xl border transition-all ${
                  selected
                    ? "border-[#E31837] bg-[#E31837]/15"
                    : "glass border-white/10 hover:border-white/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  {t.popular && (
                    <span className="bg-[#F5A623] text-[#080B14] text-[10px] font-black px-2 py-0.5 rounded-full">
                      POPULAR
                    </span>
                  )}
                  <span className="text-white font-semibold">{t.label}</span>
                </div>
                <span className="text-[#F5A623] font-bold">₹{tEmi.toLocaleString("en-IN")}/mo</span>
              </button>
            )
          })}
        </div>

        <button onClick={() => setStep(0)} className="text-white/30 text-sm hover:text-white/50">
          ← Back
        </button>
      </div>
    </div>
  )

  // Step 2 — Employment
  if (step === 2) return (
    <div className="w-full h-full flex flex-col items-center justify-center pb-28 px-8">
      <div className="w-full max-w-xl">
        <p className="text-white/40 text-sm mb-1">Step 2 of 5 · Question 3 of 4</p>
        <h2 className="text-white font-bold text-3xl mb-8">What's your employment type?</h2>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {EMPLOYMENT_TYPES.map((e) => (
            <button
              key={e.id}
              onClick={() => { setFinancialAnswers({ employment_type: e.id }); setStep(3) }}
              className={`p-6 rounded-xl border text-left transition-all ${
                financialAnswers.employment_type === e.id
                  ? "border-[#E31837] bg-[#E31837]/15"
                  : "glass border-white/10 hover:border-white/30"
              }`}
            >
              <div className="text-3xl mb-3">{e.icon}</div>
              <p className="text-white font-bold">{e.label}</p>
              <p className="text-white/40 text-sm">{e.sub}</p>
            </button>
          ))}
        </div>

        <button onClick={() => setStep(1)} className="text-white/30 text-sm hover:text-white/50">
          ← Back
        </button>
      </div>
    </div>
  )

  // Step 3 — Income
  return (
    <div className="w-full h-full flex flex-col items-center justify-center pb-28 px-8">
      <div className="w-full max-w-xl">
        <p className="text-white/40 text-sm mb-1">Step 2 of 5 · Question 4 of 4</p>
        <h2 className="text-white font-bold text-3xl mb-2">Monthly take-home income?</h2>
        <p className="text-white/50 text-sm mb-8">Rough estimate is fine</p>

        <div className="flex flex-col gap-3 mb-6">
          {INCOME_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => { setFinancialAnswers({ income_range: r.id }); setStage("eligibility_teaser") }}
              className="flex items-center justify-between px-6 py-4 rounded-xl glass border border-white/10 hover:border-[#E31837]/50 hover:bg-[#E31837]/10 transition-all"
            >
              <span className="text-white font-semibold text-lg">{r.label}</span>
              <span className="text-white/30 text-lg">→</span>
            </button>
          ))}
        </div>

        <button onClick={() => setStep(2)} className="text-white/30 text-sm hover:text-white/50">
          ← Back
        </button>
      </div>
    </div>
  )
}
