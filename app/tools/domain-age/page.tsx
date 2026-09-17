import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { DomainAgeTool } from "@/components/domain-age-tool"

export const metadata: Metadata = {
  title: "Domain Age Checker",
  description: "Find out when a domain was first registered, when it expires, and exactly how old it is.",
}

export default function DomainAgePage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">Domain Age</h1>
        <p className="mt-2 text-pretty leading-relaxed text-muted-foreground">
          Find out when a domain was first registered and how old it is, along with its expiry, registrar, and status.
        </p>
      </header>

      <div className="mt-8">
        <DomainAgeTool />
      </div>

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Registration data comes from the public RDAP registry system. Some country-code domains don&apos;t publish
        registration dates.
      </p>
    </div>
  )
}
