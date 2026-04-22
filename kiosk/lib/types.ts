export type Stage =
  | "idle"
  | "car_catalog"
  | "financial_discovery"
  | "eligibility_teaser"
  | "pan_entry"
  | "eligibility_result"
  | "emi_optimizer"
  | "phone_capture"
  | "application_review"
  | "waiting"
  | "celebration"

export interface Car {
  id: string
  brand: string
  model: string
  variant: string
  segment: string
  price: number
  image: string
  color_options: string[]
  fuel: string
  transmission: string
  mileage: string
  tagline: string
}

export interface BureauData {
  found: boolean
  name: string
  dob: string
  age: number
  cibil: number
  existing_emi_total: number
  existing_loans_count: number
  profile_label: string
  address: string
  show_cibil?: boolean
}

export interface EligibilityResult {
  eligible: boolean
  decision: string
  approved_amount: number
  interest_rate: number
  tenure_months: number
  emi: number
  cibil_band: string
  show_cibil: boolean
  cibil_score: number | null
  priya_message: string
}

export interface LoanConfig {
  approved_amount: number
  rate: number
  tenure_months: number
  emi: number
  down_payment: number
}

export interface FinancialAnswers {
  down_payment: number
  tenure_months: number
  employment_type: string
  income_range: string
}

export const STAGE_PROGRESS: Record<Stage, number> = {
  idle: 0,
  car_catalog: 15,
  financial_discovery: 35,
  eligibility_teaser: 45,
  pan_entry: 50,
  eligibility_result: 65,
  emi_optimizer: 78,
  phone_capture: 88,
  application_review: 93,
  waiting: 97,
  celebration: 100,
}

export const INFO_PANEL_DATA: Record<Stage, { system: string; aiUsed: boolean; description: string; dataHeld: string }> = {
  idle: {
    system: "None",
    aiUsed: false,
    description: "Kiosk is in standby. No processing happening.",
    dataHeld: "Nothing stored yet.",
  },
  car_catalog: {
    system: "Rules-Based Filter",
    aiUsed: false,
    description: "Filtering and sorting car catalog by brand, segment, and price. Pure database lookup.",
    dataHeld: "Nothing personal. Only browsing.",
  },
  financial_discovery: {
    system: "Rules-Based EMI Calculator",
    aiUsed: false,
    description: "EMI preview = P×r×(1+r)^n / ((1+r)^n−1). No AI involved — pure math.",
    dataHeld: "Car preference, down payment, tenure, employment type, income range.",
  },
  eligibility_teaser: {
    system: "Rules-Based Range Estimator",
    aiUsed: false,
    description: "Showing estimated eligibility range using income midpoints and average CIBIL. Not your actual offer.",
    dataHeld: "Same as above. Still no personal data.",
  },
  pan_entry: {
    system: "Bureau API → Rules Engine",
    aiUsed: false,
    description: "PAN sent to credit bureau. Returns: name, CIBIL score, existing loans. Rules engine then computes your exact eligibility.",
    dataHeld: "PAN number, name, CIBIL score, existing EMI obligations.",
  },
  eligibility_result: {
    system: "Rules Engine (decision) + LLM (message only)",
    aiUsed: true,
    description: "Rules engine made the credit decision. LLM only wrote the congratulatory message in natural language. AI cannot override eligibility.",
    dataHeld: "Full financial profile. Stored in session only — not in database until you apply.",
  },
  emi_optimizer: {
    system: "Rules-Based EMI Calculator",
    aiUsed: false,
    description: "Live EMI recalculation as you adjust sliders. Same math formula, instant results.",
    dataHeld: "Your chosen loan amount, tenure, and down payment.",
  },
  phone_capture: {
    system: "Form Validation (Rules)",
    aiUsed: false,
    description: "Phone number captured for application confirmation and follow-up only.",
    dataHeld: "Everything collected so far + your phone number.",
  },
  application_review: {
    system: "Form Validation (Rules)",
    aiUsed: false,
    description: "Reviewing your complete application before submission. No processing yet.",
    dataHeld: "Complete application ready to submit.",
  },
  waiting: {
    system: "Event Listener + LLM (dealer brief)",
    aiUsed: true,
    description: "Waiting for dealer to review. LLM generated a 2-line brief for the dealer from your profile. You are not affected by this.",
    dataHeld: "Application saved to database. Application ID generated.",
  },
  celebration: {
    system: "Rules-Based Status Update",
    aiUsed: false,
    description: "Dealer pre-approved your application. Status updated to sanctioned.",
    dataHeld: "Full application record with pre-approval status.",
  },
}
