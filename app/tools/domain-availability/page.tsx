import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { DomainAvailabilityTool } from "@/components/domain-availability-tool"

export const metadata: Metadata = {
  title: "Domain Availability Checker",
  description:
    "Check whether a domain name is available to register. Verified with DNS, RDAP, and WHOIS — not just a guess.",
}

export default function DomainAvailabilityPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:pt-14">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        All tools
      </Link>

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">Domain Availability</h1>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
          Enter a domain to see if it&apos;s free to register. Results are verified against DNS, the RDAP registry, and
          WHOIS — so an &ldquo;available&rdquo; means available.
        </p>
      </header>

      <div className="mt-8">
        <DomainAvailabilityTool />
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Availability is checked live against public registry data. Some country-code endings don&apos;t publish RDAP or
        WHOIS records; those results are marked unverified. Always confirm at a registrar before purchasing.
      </p>
    </div>
  )
}
