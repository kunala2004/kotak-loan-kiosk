import { create } from "zustand"
import { Stage, Car, BureauData, EligibilityResult, LoanConfig, FinancialAnswers } from "./types"

interface KioskState {
  // Navigation
  currentStage: Stage
  setStage: (stage: Stage) => void

  // Car selection
  selectedCar: Car | null
  setCar: (car: Car) => void

  // Financial discovery answers
  financialAnswers: FinancialAnswers
  setFinancialAnswers: (answers: Partial<FinancialAnswers>) => void

  // Bureau data (from PAN fetch)
  bureauData: BureauData | null
  setBureauData: (data: BureauData) => void
  pan: string
  setPan: (pan: string) => void

  // Eligibility result
  eligibilityResult: EligibilityResult | null
  setEligibilityResult: (result: EligibilityResult) => void

  // Final loan configuration (after optimizer)
  loanConfig: LoanConfig | null
  setLoanConfig: (config: LoanConfig) => void

  // Phone
  phone: string
  setPhone: (phone: string) => void

  // Application
  applicationId: string | null
  setApplicationId: (id: string) => void

  // Chat history for kiosk agent
  chatHistory: { role: string; content: string }[]
  addChatMessage: (msg: { role: string; content: string }) => void

  // Reset (new customer)
  resetSession: () => void
}

const defaultFinancialAnswers: FinancialAnswers = {
  down_payment: 0,
  tenure_months: 60,
  employment_type: "",
  income_range: "",
}

export const useKioskStore = create<KioskState>((set) => ({
  currentStage: "idle",
  setStage: (stage) => set({ currentStage: stage }),

  selectedCar: null,
  setCar: (car) => set({ selectedCar: car }),

  financialAnswers: defaultFinancialAnswers,
  setFinancialAnswers: (answers) =>
    set((s) => ({ financialAnswers: { ...s.financialAnswers, ...answers } })),

  bureauData: null,
  setBureauData: (data) => set({ bureauData: data }),
  pan: "",
  setPan: (pan) => set({ pan }),

  eligibilityResult: null,
  setEligibilityResult: (result) => set({ eligibilityResult: result }),

  loanConfig: null,
  setLoanConfig: (config) => set({ loanConfig: config }),

  phone: "",
  setPhone: (phone) => set({ phone }),

  applicationId: null,
  setApplicationId: (id) => set({ applicationId: id }),

  chatHistory: [],
  addChatMessage: (msg) => set((s) => ({ chatHistory: [...s.chatHistory, msg] })),

  resetSession: () =>
    set({
      currentStage: "idle",
      selectedCar: null,
      financialAnswers: defaultFinancialAnswers,
      bureauData: null,
      pan: "",
      eligibilityResult: null,
      loanConfig: null,
      phone: "",
      applicationId: null,
      chatHistory: [],
    }),
}))
