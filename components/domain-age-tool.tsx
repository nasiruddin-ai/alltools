"use client"

import { useState, type FormEvent } from "react"
import { Search, Loader2, CalendarClock } from "lucide-react"

interface AgeBreakdown {
  years: number
  months: number
  days: number
  totalDays: number
}

interface AgeResponse {
  ok: boolean
  domain?: string
  queried?: string
  registered?: string | null
  expires?: string | null
  updated?: string | null
  registrar?: string | null
  status?: string[]
  age?: AgeBreakdown | null
  note?: string | null
  error?: string
}

function fmtDate(iso?: string | null) {
  if (!iso) return "Not published"
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function ageText(age: AgeBreakdown) {
  const parts: string[] = []
  if (age.years) parts.push(plural(age.years, "year"))
  if (age.months) parts.push(plural(age.months, "month"))
  if (age.days || parts.length === 0) parts.push(plural(age.days, "day"))
  return parts.join(", ")
}

export function DomainAgeTool() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AgeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const domain = value.trim()
    if (!domain || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/age?domain=" + encodeURIComponent(domain))
      const data: AgeResponse = await res.json()
      if (!data.ok) {
        setError(data.error || "Could not check this domain.")
      } else {
        setResult(data)
      }
    } catch (err: any) {
      setError("Something went wrong. " + (err?.message || ""))
    } finally {
      setLoading(false)
    }
  }

  const rows = result
    ? [
        { label: "Registered on", value: fmtDate(result.registered) },
        { label: "Expires on", value: fmtDate(result.expires) },
        { label: "Last updated", value: fmtDate(result.updated) },
        { label: "Registrar", value: result.registrar || "Not published" },
        { label: "Status", value: result.status && result.status.length ? result.status.join(", ") : "Not published" },
      ]
    : []

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            inputMode="url"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="example.com"
            aria-label="Domain name"
            className="w-full rounded-lg border border-input bg-input py-3 pl-10 pr-4 font-mono text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          {loading ? "Checking" : "Check age"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-foreground"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border p-5 sm:p-6">
            {result.age ? (
              <>
                <p className="text-3xl font-semibold tracking-tight text-foreground">
                  {ageText(result.age)} <span className="text-base font-medium text-muted-foreground">old</span>
                </p>
                <p className="mt-1 break-all font-mono text-sm text-muted-foreground">
                  {result.domain} · {result.age.totalDays.toLocaleString()} days since registration
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-semibold tracking-tight text-warning">Age unavailable</p>
                <p className="mt-1 break-all font-mono text-sm text-muted-foreground">{result.domain}</p>
              </>
            )}
          </div>

          <dl className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 px-5 py-3 sm:px-6">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-right text-sm text-foreground/90">{row.value}</dd>
              </div>
            ))}
          </dl>

          {result.note && (
            <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground sm:px-6">{result.note}</p>
          )}
          {result.queried && result.domain !== result.queried && (
            <p className="border-t border-border px-5 py-3 text-sm text-muted-foreground sm:px-6">
              You entered <span className="font-mono text-foreground/80">{result.queried}</span>. Registration data is
              held for the main domain <span className="font-mono text-foreground/80">{result.domain}</span>, shown here.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
