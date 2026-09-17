import { NextResponse } from "next/server"
import { cleanDomain, looksLikeDomain, checkDomain } from "@/lib/domain-check"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const domain = cleanDomain(searchParams.get("domain") || "")

  if (!domain) {
    return NextResponse.json({ ok: false, error: "Please enter a domain name." }, { status: 400 })
  }
  if (!looksLikeDomain(domain)) {
    return NextResponse.json(
      { ok: false, domain, error: `"${domain}" does not look like a valid domain name.` },
      { status: 400 },
    )
  }

  try {
    const result = await checkDomain(domain)
    return NextResponse.json({ ok: true, domain, ...result }, { headers: { "Cache-Control": "no-store" } })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, domain, error: "Check failed: " + (err?.message || "unknown error") },
      { status: 502 },
    )
  }
}
