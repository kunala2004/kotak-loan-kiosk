const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function post(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`)
  return res.json()
}

export const api = {
  getCars: (params?: { brand?: string; segment?: string; max_price?: number }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString()
    return get(`/cars${q ? "?" + q : ""}`)
  },

  getCarReaction: (carId: string) => post(`/cars/${carId}/reaction`, {}),

  fetchBureau: (pan: string) => post("/bureau/fetch", { pan }),

  checkEligibility: (data: {
    income_range: string
    employment_type: string
    down_payment: number
    vehicle_price: number
    tenure_months: number
    cibil: number
    existing_emi: number
    age: number
    customer_name: string
    car_brand: string
    car_model: string
    car_variant: string
  }) => post("/eligibility/check", data),

  calculateEmi: (principal: number, annual_rate: number, tenure_months: number) =>
    post("/emi/calculate", { principal, annual_rate, tenure_months }),

  submitApplication: (data: object) => post("/application/submit", data),

  registerDropoff: (phone: string, stage: string, snapshot: object) =>
    post("/application/dropoff", {
      phone,
      current_stage: stage,
      session_snapshot: snapshot,
    }),

  recommendCars: (query: string) =>
    post("/cars/recommend", { query }),

  sendChatMessage: (message: string, session_data: object, stage: string, history: object[]) =>
    post("/chat/message", {
      message,
      session_data,
      current_stage: stage,
      message_history: history,
    }),
}
