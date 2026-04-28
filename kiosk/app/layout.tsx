import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Car Loan Kiosk",
  description: "Drive home your dream car today",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body suppressHydrationWarning className={`${inter.className} h-full w-full overflow-hidden bg-[#080B14]`}>
        {children}
      </body>
    </html>
  )
}
