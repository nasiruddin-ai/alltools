import Link from "next/link"
import { Boxes } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-inset ring-primary/25">
            <Boxes className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            all<span className="text-primary">tools</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/tools/domain-availability"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Availability
          </Link>
          <Link
            href="/tools/domain-age"
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Age
          </Link>
        </nav>
      </div>
    </header>
  )
}
