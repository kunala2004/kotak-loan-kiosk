// Server-component shim — only purpose is to export generateStaticParams()
// so `next build` with output: 'export' succeeds. The actual UI lives in
// ./client-page.tsx (a Client Component that reads the id from useParams()
// at runtime, so a single placeholder pre-render covers all real ids
// once CloudFront serves /index.html as the SPA fallback for unknown paths).

import ClientApplicationDetail from "./client-page"

export function generateStaticParams() {
  return [{ id: "_placeholder" }]
}

export const dynamic = "force-static"
export const dynamicParams = false

export default function Page() {
  return <ClientApplicationDetail />
}
