"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useKioskStore } from "@/lib/store"
import { api } from "@/lib/api"
import { Car } from "@/lib/types"

const BRANDS = ["All", "Maruti Suzuki", "Hyundai", "Tata", "Honda", "Toyota"]
const SEGMENTS = ["All", "Hatchback", "Sedan", "SUV", "MUV"]

const CAR_EMOJIS: Record<string, string> = {
  "Maruti Suzuki": "🚗",
  "Hyundai": "🚙",
  "Tata": "🏎️",
  "Honda": "🚘",
  "Toyota": "🚐",
}

const BRAND_COLORS: Record<string, string> = {
  "Maruti Suzuki": "from-blue-900/40 to-blue-800/20",
  "Hyundai": "from-sky-900/40 to-sky-800/20",
  "Tata": "from-purple-900/40 to-purple-800/20",
  "Honda": "from-red-900/40 to-red-800/20",
  "Toyota": "from-slate-800/40 to-slate-700/20",
}

export default function CarCatalog() {
  const { setStage, setCar, setFinancialAnswers } = useKioskStore()
  const [cars, setCars] = useState<Car[]>([])
  const [filtered, setFiltered] = useState<Car[]>([])
  const [activeBrand, setActiveBrand] = useState("All")
  const [activeSegment, setActiveSegment] = useState("All")
  const [selected, setSelected] = useState<Car | null>(null)
  const [reaction, setReaction] = useState("")
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [aiMatches, setAiMatches] = useState<string[]>([])
  const [aiReason, setAiReason] = useState("")

  useEffect(() => {
    api.getCars().then((data) => {
      setCars(data)
      setFiltered(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    let result = cars
    if (activeBrand !== "All") result = result.filter((c) => c.brand === activeBrand)
    if (activeSegment !== "All") result = result.filter((c) => c.segment === activeSegment)
    setFiltered(result)
  }, [activeBrand, activeSegment, cars])

  const handleSelect = async (car: Car) => {
    setSelected(car)
    setReaction("✨ Great choice! Let me get that ready for you...")
    try {
      const r = await api.getCarReaction(car.id)
      setReaction(r.reaction)
    } catch {
      setReaction(`Great choice! The ${car.brand} ${car.model} is a fantastic pick.`)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    setAiMatches([])
    setAiReason("")
    try {
      const result = await api.recommendCars(searchQuery.trim())
      setAiMatches(result.ids ?? [])
      setAiReason(result.reason ?? "")
      // Clear brand/segment filters so AI picks are visible
      setActiveBrand("All")
      setActiveSegment("All")
    } catch {
      setAiReason("Could not connect — try the filters above.")
    } finally {
      setSearching(false)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setAiMatches([])
    setAiReason("")
  }

  const handleConfirm = () => {
    if (!selected) return
    setCar(selected)
    setFinancialAnswers({ down_payment: Math.round(selected.price * 0.15) })
    setStage("financial_discovery")
  }

  return (
    <motion.div
      className="w-full h-full flex flex-col pt-24 pb-32 px-8"
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-6">
        <p className="text-white/40 text-sm mb-1">Step 1 of 5</p>
        <h2 className="text-white font-bold text-3xl">Which car caught your eye? 👀</h2>
        <p className="text-white/50 text-base mt-1">Tap to select your dream car</p>
      </div>

      {/* AI Search */}
      <div className="mb-5">
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 glass rounded-xl border border-white/10 px-4 py-3">
            <span className="text-white/40 text-sm">✨</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder='Describe your ideal car — "family SUV under ₹15L" or "sporty hatchback"'
              className="flex-1 bg-transparent text-white placeholder-white/30 text-sm outline-none"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="text-white/30 hover:text-white/60 text-xs">✕</button>
            )}
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="gradient-red text-white font-semibold px-5 py-3 rounded-xl disabled:opacity-40 transition-all text-sm"
          >
            {searching ? "..." : "Ask AI"}
          </button>
        </div>
        {aiReason && (
          <p className="text-white/50 text-xs mt-2 ml-1">
            <span className="text-[#F5A623]">✨ AI:</span> {aiReason}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-6 mb-6">
        <div className="flex gap-2 flex-wrap">
          {BRANDS.map((b) => (
            <button
              key={b}
              onClick={() => setActiveBrand(b)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeBrand === b
                  ? "gradient-red text-white glow-red"
                  : "glass text-white/60 hover:text-white"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
        <div className="w-px bg-white/10" />
        <div className="flex gap-2 flex-wrap">
          {SEGMENTS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveSegment(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeSegment === s
                  ? "bg-white/15 text-white border border-white/30"
                  : "glass text-white/50 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Car Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl h-44 shimmer" />
            ))}
          </div>
        ) : (
          <motion.div className="grid grid-cols-4 gap-4 pb-4">
            <AnimatePresence>
              {filtered.map((car, i) => (
                <motion.div
                  key={car.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => handleSelect(car)}
                  className={`relative cursor-pointer rounded-2xl p-5 border transition-all duration-200 ${
                    selected?.id === car.id
                      ? "border-[#E31837] glow-red bg-gradient-to-br from-[#E31837]/20 to-[#E31837]/5"
                      : "glass border-white/8 hover:border-white/20"
                  } bg-gradient-to-br ${BRAND_COLORS[car.brand] || "from-gray-900/40 to-gray-800/20"}`}
                >
                  {selected?.id === car.id && (
                    <motion.div
                      className="absolute top-3 right-3 w-6 h-6 gradient-red rounded-full flex items-center justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <span className="text-white text-xs">✓</span>
                    </motion.div>
                  )}
                  {aiMatches.includes(car.id) && selected?.id !== car.id && (
                    <div className="absolute top-3 right-3 bg-[#F5A623] text-[#080B14] text-[9px] font-black px-2 py-0.5 rounded-full">
                      ✨ AI
                    </div>
                  )}

                  <div className="text-4xl mb-3">{CAR_EMOJIS[car.brand] || "🚗"}</div>
                  <p className="text-white/40 text-xs mb-0.5">{car.brand}</p>
                  <p className="text-white font-bold text-base leading-tight">{car.model}</p>
                  <p className="text-white/50 text-xs mb-3">{car.variant}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-[#F5A623] font-bold text-sm">
                      ₹{(car.price / 100000).toFixed(1)}L
                    </p>
                    <span className="text-white/30 text-[10px] bg-white/5 px-2 py-0.5 rounded-full">
                      {car.segment}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Selected Car + CTA */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed bottom-28 left-8 right-8 glass rounded-2xl p-5 flex items-center justify-between border border-white/15"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">{CAR_EMOJIS[selected.brand]}</div>
              <div>
                <p className="text-white font-bold">{selected.brand} {selected.model} {selected.variant}</p>
                <p className="text-white/50 text-sm">{reaction}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-white/40 text-xs">Ex-showroom</p>
                <p className="text-[#F5A623] font-bold text-xl">₹{(selected.price / 100000).toFixed(2)}L</p>
              </div>
              <motion.button
                onClick={handleConfirm}
                className="gradient-red glow-red text-white font-bold px-8 py-3 rounded-xl"
                whileTap={{ scale: 0.96 }}
              >
                Let's Go →
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
