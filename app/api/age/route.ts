import { NextResponse } from "next/server"
import { lookupAge } from "@/lib/domain-age"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const { code, ...body } = await lookupAge(searchParams.get("domain") || "")
  return NextResponse.json(body, { status: code, headers: { "Cache-Control": "no-store" } })
}
