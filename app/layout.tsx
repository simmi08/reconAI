import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReconAI",
  description: "AI-Powered Procurement Reconciliation"
};

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/ingest", label: "Ingest" },
  { href: "/documents", label: "Documents" },
  { href: "/transactions", label: "Transactions" }
] as const;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
              <div>
                <p className="text-lg font-semibold text-slate-900">ReconAI</p>
                <p className="text-xs text-slate-500">AI-Powered Procurement Reconciliation</p>
              </div>
              <nav className="flex gap-3 text-sm font-medium text-slate-700">
                {links.map((link) => (
                  <Link key={link.href} href={link.href} className="rounded px-2 py-1 hover:bg-slate-100">
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
