"use client"

import { useState, type FormEvent } from "react"
import { Search, Loader2, CheckCircle2, XCircle, HelpCircle, ShieldCheck, ShieldAlert } from "lucide-react"

type Status = "available" | "taken" | "unknown"

interface CheckResponse {
  ok: boolean
  domain?: string
  status?: Status
  verified?: boolean
  source?: string
  note?: string
  cached?: boolean
  error?: string
}

const statusMeta: Record<Status, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  available: { label: "Available", className: "text-success", icon: CheckCircle2 },
  taken: { label: "Taken", className: "text-danger", icon: XCircle },
  unknown: { label: "Unknown", className: "text-warning", icon: HelpCircle },
}

export function DomainAvailabilityTool() {
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const domain = value.trim()
    if (!domain || loading) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch("/api/check?domain=" + encodeURIComponent(domain))
      const data: CheckResponse = await res.json()
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

  const meta = result?.status ? statusMeta[result.status] : null
  const StatusIcon = meta?.icon

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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Checking" : "Check"}
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

      {result && meta && StatusIcon && (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start gap-4 border-b border-border p-5 sm:p-6">
            <StatusIcon className={`mt-0.5 h-8 w-8 shrink-0 ${meta.className}`} aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`text-2xl font-semibold tracking-tight ${meta.className}`}>{meta.label}</span>
                {result.cached && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    cached
                  </span>
                )}
              </div>
              <p className="mt-1 break-all font-mono text-sm text-muted-foreground">{result.domain}</p>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-foreground/90">{result.note}</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                {result.verified ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                )}
                {result.verified ? "Verified by registry" : "Unverified — confirm at registrar"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                Source: <span className="font-mono uppercase text-foreground/80">{result.source}</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
