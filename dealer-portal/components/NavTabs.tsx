"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { href: "/",          label: "Applications" },
  { href: "/analytics", label: "Analytics" },
]

export default function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="max-w-7xl mx-auto px-6 border-b border-slate-200 bg-white">
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/" || pathname.startsWith("/applications")
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? "text-[#E31837] border-[#E31837]"
                  : "text-slate-500 border-transparent hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
