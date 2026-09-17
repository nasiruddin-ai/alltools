import { ToolCard } from "@/components/tool-card"
import { Globe, CalendarClock, Braces, KeyRound, Palette, QrCode } from "lucide-react"

const tools = [
  {
    href: "/tools/domain-availability",
    title: "Domain Availability",
    description: "Check whether a domain is free to register using DNS, RDAP, and WHOIS — verified, not guessed.",
    icon: Globe,
    available: true,
  },
  {
    href: "/tools/domain-age",
    title: "Domain Age",
    description: "Find out when a domain was first registered, when it expires, and exactly how old it is.",
    icon: CalendarClock,
    available: true,
  },
  {
    href: "#",
    title: "JSON Formatter",
    description: "Prettify, minify, and validate JSON with instant error highlighting.",
    icon: Braces,
    available: false,
  },
  {
    href: "#",
    title: "UUID & Token Generator",
    description: "Generate UUIDs, secure random tokens, and API keys on demand.",
    icon: KeyRound,
    available: false,
  },
  {
    href: "#",
    title: "Color Converter",
    description: "Convert between HEX, RGB, HSL, and OKLCH with live previews.",
    icon: Palette,
    available: false,
  },
  {
    href: "#",
    title: "QR Code Generator",
    description: "Turn any URL or text into a crisp, downloadable QR code.",
    icon: QrCode,
    available: false,
  },
]

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:pt-24">
      <section className="max-w-2xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          2 tools live · more on the way
        </span>
        <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          A collection of fast, free web tools.
        </h1>
        <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
          alltools is a growing set of no-nonsense micro utilities for developers and makers. No sign-ups, no clutter —
          just open a tool and go.
        </p>
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Tools</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <ToolCard key={tool.title} {...tool} />
          ))}
        </div>
      </section>
    </div>
  )
}
