import type { Metadata } from "next"
import { Geist } from "next/font/google"
import "./globals.css"
import NavTabs from "@/components/NavTabs"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Kotak Bank — Dealer Portal",
  description: "Loan application management for Kotak Bank dealerships",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geist.className} min-h-full bg-slate-50 text-slate-900`}>
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 bg-[#E31837] rounded-md flex items-center justify-center">
                <span className="text-white font-black text-xs">K</span>
              </div>
              <span className="font-bold text-slate-900">Kotak Bank</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-sm">Dealer Portal</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
              Live
            </div>
          </div>
        </header>
        <NavTabs />
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
