// Server-component shim — see /applications/[id]/page.tsx for the rationale.

import ClientSessionDetail from "./client-page"

export function generateStaticParams() {
  return [{ id: "_placeholder" }]
}

export const dynamic = "force-static"
export const dynamicParams = false

export default function Page() {
  return <ClientSessionDetail />
}
