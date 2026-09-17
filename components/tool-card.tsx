import Link from "next/link"
import { ArrowUpRight, type LucideIcon } from "lucide-react"

interface ToolCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
  available?: boolean
}

export function ToolCard({ href, title, description, icon: Icon, available = true }: ToolCardProps) {
  const inner = (
    <div className="group relative flex h-full flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
          <Icon className="h-5 w-5" />
        </span>
        {available ? (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
        ) : (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        )}
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )

  if (!available) {
    return <div className="h-full cursor-not-allowed opacity-60">{inner}</div>
  }

  return (
    <Link href={href} className="h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </Link>
  )
}
