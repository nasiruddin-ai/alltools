// Shared domain-availability logic (ported to TypeScript for Next.js).
//
// How a domain is checked (cheapest step first):
//   Step 1 - DNS. If the domain has name servers it is definitely registered.
//   Step 2 - RDAP. The public registry lookup system that replaced WHOIS.
//            A "404 not found" answer from the registry means nobody owns it.
//   Step 3 - WHOIS. For endings whose registry has no RDAP (.io, .co, .me, ...)
//            the tool asks the classic WHOIS server instead.
//   If none of those can answer, the tool falls back to "probably available"
//   based on DNS alone, and marks it as unverified.

import net from "node:net"
import dns from "node:dns/promises"

const USER_AGENT = "alltools-DomainFinder/1.0"

const settings = {
  timeoutMs: 12000,
  maxParallel: 4,
  cacheTtlMs: 10 * 60 * 1000,
}

export type CheckStatus = "available" | "taken" | "unknown"

export interface CheckResult {
  status: CheckStatus
  verified: boolean
  source: string
  note: string
  cached?: boolean
}

// ---------- helpers ----------

export function cleanDomain(input: string): string {
  let s = String(input || "").trim().toLowerCase()
  s = s.replace(/^[a-z]+:\/\//, "")
  s = s.split("/")[0].split("?")[0].split("#")[0]
  s = s.split("@").pop() as string
  s = s.split(":")[0]
  s = s.replace(/^www\./, "")
  s = s.replace(/^\.+|\.+$/g, "")
  return s
}

export function looksLikeDomain(d: string): boolean {
  return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63}$/.test(d)
}

interface JsonResponse {
  status: number
  data: any
  error?: string
}

async function fetchJson(url: string): Promise<JsonResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs)
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

// A tiny "semaphore" so we never hammer a registry with too many requests at once.
let inFlight = 0
const waiting: Array<() => void> = []
function acquire(): Promise<void> {
  if (inFlight < settings.maxParallel) {
    inFlight++
    return Promise.resolve()
  }
  return new Promise((resolve) => waiting.push(resolve))
}
function release() {
  const next = waiting.shift()
  if (next) next()
  else inFlight--
}

// ---------- RDAP bootstrap ----------

let bootstrapCache: Map<string, string> | null = null
let bootstrapLoadedAt = 0
let bootstrapLoading: Promise<Map<string, string> | null> | null = null

async function loadBootstrap(): Promise<Map<string, string> | null> {
  const oneDay = 86400000
  if (bootstrapCache && Date.now() - bootstrapLoadedAt < oneDay) return bootstrapCache
  if (bootstrapLoading) return bootstrapLoading

  bootstrapLoading = (async () => {
    try {
      const { status, data } = await fetchJson("https://data.iana.org/rdap/dns.json")
      if (status === 200 && data && Array.isArray(data.services)) {
        const map = new Map<string, string>()
        for (const [tlds, urls] of data.services as [string[], string[]][]) {
          if (!urls || !urls.length) continue
          const base = urls.find((u) => u.startsWith("https://")) || urls[0]
          for (const tld of tlds) map.set(tld.toLowerCase(), base.endsWith("/") ? base : base + "/")
        }
        bootstrapCache = map
        bootstrapLoadedAt = Date.now()
      }
    } catch {
      /* keep the old cache if there is one */
    } finally {
      bootstrapLoading = null
    }
    return bootstrapCache
  })()
  return bootstrapLoading
}

async function rdapBaseFor(domain: string): Promise<{ base: string | null; known: boolean | null }> {
  const map = await loadBootstrap()
  if (!map) return { base: null, known: null }
  const labels = domain.split(".")
  for (let i = 1; i < labels.length; i++) {
    const suffix = labels.slice(i).join(".")
    if (map.has(suffix)) return { base: map.get(suffix)!, known: true }
  }
  return { base: null, known: false }
}

// ---------- the checks ----------

async function dnsCheck(domain: string): Promise<"registered" | "no-records" | "unknown"> {
  try {
    const ns = await dns.resolveNs(domain)
    return ns && ns.length ? "registered" : "no-records"
  } catch (err: any) {
    const code = err && err.code
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN") return "no-records"
    return "unknown"
  }
}

interface RegistryVerdict {
  verdict: CheckStatus
  source: string
  detail: string | null
}

async function rdapCheck(domain: string): Promise<RegistryVerdict> {
  const { base, known } = await rdapBaseFor(domain)

  if (known === false) {
    return { verdict: "unknown", source: "no-rdap", detail: "This domain ending has no RDAP registry." }
  }

  const urls: string[] = []
  if (base) urls.push(base + "domain/" + encodeURIComponent(domain))
  urls.push("https://rdap.org/domain/" + encodeURIComponent(domain))

  let last: JsonResponse = { status: 0, data: null }
  for (const url of urls) {
    await acquire()
    try {
      last = await fetchJson(url)
    } catch (err: any) {
      last = { status: 0, data: null, error: err && err.name === "AbortError" ? "timeout" : "network" }
    } finally {
      release()
    }
    if (last.status === 200 && last.data) {
      return { verdict: "taken", source: "rdap", detail: registrarName(last.data.entities) }
    }
    if (last.status === 404) {
      const title = last.data && typeof last.data.title === "string" ? last.data.title : ""
      if (/no rdap service/i.test(title)) {
        return { verdict: "unknown", source: "no-rdap", detail: "This domain ending has no RDAP registry." }
      }
      return { verdict: "available", source: "rdap", detail: null }
    }
  }

  if (last.status === 429) {
    return { verdict: "unknown", source: "rdap", detail: "The registry is rate-limiting lookups. Wait a minute and check this one again." }
  }
  if (last.status) {
    return { verdict: "unknown", source: "rdap", detail: "The registry returned an unexpected response (" + last.status + ")." }
  }
  return { verdict: "unknown", source: "rdap", detail: last.error === "timeout" ? "The registry took too long to respond." : "Could not reach the registry." }
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

// ---------- WHOIS ----------

function whoisQuery(server: string, query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: server, port: 43 })
    let buf = ""
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("timeout"))
    }, settings.timeoutMs)
    socket.setEncoding("utf8")
    socket.on("connect", () => socket.write(query + "\r\n"))
    socket.on("data", (d) => (buf += d))
    socket.on("end", () => {
      clearTimeout(timer)
      resolve(buf)
    })
    socket.on("error", (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}

const whoisServerCache = new Map<string, string | null>()
async function whoisServerFor(tld: string): Promise<string | null> {
  if (whoisServerCache.has(tld)) return whoisServerCache.get(tld)!
  let server: string | null = null
  try {
    const text = await whoisQuery("whois.iana.org", tld)
    const m = /^whois:\s*(\S+)/im.exec(text)
    if (m) server = m[1].toLowerCase()
  } catch {
    return null
  }
  whoisServerCache.set(tld, server)
  return server
}

const WHOIS_FREE =
  /^[\s%#>*]*(domain not found|no data found|no match|not found|no entries found|nothing found|no such domain|no object found|object does not exist|status:\s*(free|available)|.*(is available for registration|not registered|is free|queried object does not exist|domain not found))/im
const WHOIS_TAKEN =
  /^[\s%#>*]*(domain name|domain|registrar|registry domain id|creation date|created|registered on|nserver|name server)\s*:/im
const WHOIS_LIMIT = /^[\s%#>*]*.*(rate limit|too many|query limit|quota exceeded|exceeded the|try again later)/im

async function whoisCheck(domain: string): Promise<RegistryVerdict> {
  const tld = domain.split(".").pop() as string
  const server = await whoisServerFor(tld)
  if (!server) return { verdict: "unknown", source: "no-whois", detail: "No WHOIS server is listed for this ending." }

  await acquire()
  let text: string
  try {
    text = await whoisQuery(server, domain)
  } catch (err: any) {
    return {
      verdict: "unknown",
      source: "whois",
      detail: err.message === "timeout" ? "The WHOIS server took too long to respond." : "Could not reach the WHOIS server.",
    }
  } finally {
    release()
  }

  if (WHOIS_FREE.test(text)) return { verdict: "available", source: "whois", detail: null }
  if (WHOIS_TAKEN.test(text)) {
    const reg = /^\s*registrar:\s*(.+)$/im.exec(text)
    return { verdict: "taken", source: "whois", detail: reg ? reg[1].trim() : null }
  }
  if (WHOIS_LIMIT.test(text)) {
    return { verdict: "unknown", source: "whois", detail: "The WHOIS server is rate-limiting lookups. Wait a minute and check this one again." }
  }
  return { verdict: "unknown", source: "whois", detail: "The WHOIS server gave an answer the tool did not understand." }
}

// ---------- combine the checks ----------

const cache = new Map<string, { at: number; result: CheckResult }>()

export async function checkDomain(domain: string): Promise<CheckResult> {
  const hit = cache.get(domain)
  if (hit && Date.now() - hit.at < settings.cacheTtlMs) return { ...hit.result, cached: true }

  let result: CheckResult
  const dnsResult = await dnsCheck(domain)

  if (dnsResult === "registered") {
    result = { status: "taken", verified: true, source: "dns", note: "This domain has live name servers, so it is already registered." }
  } else {
    let r = await rdapCheck(domain)
    if (r.verdict === "unknown") {
      const w = await whoisCheck(domain)
      if (w.verdict !== "unknown" || r.source === "no-rdap") r = w
    }

    if (r.verdict === "available") {
      result = { status: "available", verified: true, source: r.source, note: "The registry has no record for this name. It should be free to register." }
    } else if (r.verdict === "taken") {
      result = { status: "taken", verified: true, source: r.source, note: r.detail ? "Registered through " + r.detail + "." : "The registry has a record for this name." }
    } else if (dnsResult === "no-records") {
      result = {
        status: "available",
        verified: false,
        source: "dns",
        note: "Probably available: no name servers found, but the registry could not confirm it. " + (r.detail || "") + " Confirm at the registrar before you rely on it.",
      }
    } else {
      result = { status: "unknown", verified: false, source: r.source, note: r.detail || "Could not determine availability." }
    }
  }

  cache.set(domain, { at: Date.now(), result })
  return result
}
