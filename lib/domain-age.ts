// Domain age / registration lookup via the public RDAP registry system.
// Ported to TypeScript from the original zero-dependency server.

const USER_AGENT = "alltools-DomainAgeChecker/1.0"

export function cleanDomain(input: string): string {
  let s = String(input || "").trim().toLowerCase()
  s = s.replace(/^[a-z]+:\/\//, "")
  s = s.split("/")[0].split("?")[0].split("#")[0]
  s = s.split("@").pop() as string
  s = s.split(":")[0]
  s = s.replace(/^www\./, "")
  s = s.replace(/\.+$/, "")
  return s
}

export function looksLikeDomain(d: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(d)
}

interface JsonResponse {
  status: number
  data: any
}

async function fetchJson(url: string): Promise<JsonResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/rdap+json, application/json", "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    })
    let data: any = null
    try {
      data = await res.json()
    } catch {
      data = null
    }
    return { status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

let bootstrapCache: [string[], string[]][] | null = null
let bootstrapLoadedAt = 0
async function rdapBaseForTld(tld: string): Promise<string | null> {
  const oneDay = 86400000
  if (!bootstrapCache || Date.now() - bootstrapLoadedAt > oneDay) {
    try {
      const { status, data } = await fetchJson("https://data.iana.org/rdap/dns.json")
      if (status === 200 && data && Array.isArray(data.services)) {
        bootstrapCache = data.services
        bootstrapLoadedAt = Date.now()
      }
    } catch {
      /* keep old cache if any */
    }
  }
  if (!bootstrapCache) return null
  for (const [tlds, urls] of bootstrapCache) {
    if (tlds.includes(tld) && urls.length) {
      const https = urls.find((u) => u.startsWith("https://")) || urls[0]
      return https.endsWith("/") ? https : https + "/"
    }
  }
  return null
}

async function rdapLookup(domain: string): Promise<JsonResponse> {
  let result: JsonResponse = { status: 0, data: null }
  try {
    result = await fetchJson("https://rdap.org/domain/" + encodeURIComponent(domain))
    if (result.status === 200 || result.status === 404) return result
  } catch {
    /* fall through to direct lookup */
  }

  const tld = domain.split(".").pop() as string
  const base = await rdapBaseForTld(tld)
  if (!base) return result.status ? result : { status: 404, data: null }
  return fetchJson(base + "domain/" + encodeURIComponent(domain))
}

async function findDomainRecord(domain: string): Promise<{ domain: string; data: any; status?: number }> {
  const labels = domain.split(".")
  let lastStatus = 0
  for (let i = 0; i <= labels.length - 2; i++) {
    const candidate = labels.slice(i).join(".")
    const { status, data } = await rdapLookup(candidate)
    lastStatus = status
    if (status === 200 && data) return { domain: candidate, data }
    if (status !== 404) break
  }
  return { domain, data: null, status: lastStatus }
}

function pickEvent(events: any, action: string): string | null {
  if (!Array.isArray(events)) return null
  const hit = events.find((e) => e && e.eventAction === action && e.eventDate)
  return hit ? hit.eventDate : null
}

function registrarName(entities: any): string | null {
  if (!Array.isArray(entities)) return null
  const reg = entities.find((e) => Array.isArray(e.roles) && e.roles.includes("registrar"))
  if (!reg) return null
  const card = reg.vcardArray && reg.vcardArray[1]
  if (Array.isArray(card)) {
    const fn = card.find((f: any) => f[0] === "fn")
    if (fn && fn[3]) return fn[3]
  }
  return reg.handle || null
}

export interface AgeBreakdown {
  years: number
  months: number
  days: number
  totalDays: number
}

function ageBreakdown(fromIso: string): AgeBreakdown | null {
  const from = new Date(fromIso)
  const now = new Date()
  if (isNaN(from.getTime())) return null

  let years = now.getUTCFullYear() - from.getUTCFullYear()
  let months = now.getUTCMonth() - from.getUTCMonth()
  let days = now.getUTCDate() - from.getUTCDate()
  if (days < 0) {
    months -= 1
    const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
    days += prevMonth.getUTCDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  const totalDays = Math.floor((now.getTime() - from.getTime()) / 86400000)
  return { years, months, days, totalDays }
}

export interface AgeResult {
  ok: boolean
  domain: string
  queried?: string
  registered?: string | null
  expires?: string | null
  updated?: string | null
  registrar?: string | null
  status?: string[]
  age?: AgeBreakdown | null
  note?: string | null
  error?: string
  code: number
}

export async function lookupAge(rawDomain: string): Promise<AgeResult> {
  const domain = cleanDomain(rawDomain)

  if (!domain) return { ok: false, domain: "", error: "Please enter a domain name.", code: 400 }
  if (!looksLikeDomain(domain)) return { ok: false, domain, error: `"${domain}" does not look like a valid domain name.`, code: 400 }

  try {
    const found = await findDomainRecord(domain)
    if (!found.data) {
      if (found.status === 404) {
        return { ok: false, domain, error: "No registration record found. The domain may be unregistered, or its registry does not publish RDAP data.", code: 404 }
      }
      if (found.status === 429) {
        return { ok: false, domain, error: "The registry is rate-limiting lookups. Please wait a minute and try again.", code: 429 }
      }
      return { ok: false, domain, error: `The registry returned an unexpected response (${found.status}).`, code: 502 }
    }

    const d = found.data
    const registered = pickEvent(d.events, "registration")
    const expires = pickEvent(d.events, "expiration")
    const updated = pickEvent(d.events, "last changed")

    return {
      ok: true,
      domain: found.domain,
      queried: domain,
      registered,
      expires,
      updated,
      registrar: registrarName(d.entities),
      status: Array.isArray(d.status) ? d.status : [],
      age: registered ? ageBreakdown(registered) : null,
      note: registered ? null : "This registry does not publish the registration date.",
      code: 200,
    }
  } catch (err: any) {
    const msg =
      err && err.name === "AbortError"
        ? "The registry took too long to respond. Please try again."
        : "Lookup failed: " + (err && err.message ? err.message : "unknown error")
    return { ok: false, domain, error: msg, code: 502 }
  }
}
