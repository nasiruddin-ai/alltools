import type { Metadata } from "next"
import type { ReactNode } from "react"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { SiteHeader } from "@/components/site-header"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "alltools — a collection of fast, free web tools",
    template: "%s · alltools",
  },
  description:
    "alltools is a growing collection of fast, no-nonsense micro tools for developers and makers. Check domain availability, look up domain age, and more.",
  metadataBase: new URL("https://alltools.vercel.app"),
  openGraph: {
    title: "alltools — a collection of fast, free web tools",
    description:
      "A growing collection of fast, no-nonsense micro tools for developers and makers.",
    type: "website",
  },
}

export const viewport = {
  themeColor: "#111318",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh font-sans antialiased">
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  )
}
