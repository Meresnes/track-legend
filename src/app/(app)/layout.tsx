import Link from "next/link";
import { ReactNode } from "react";
import { AppProviders } from "@/app/providers";
import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-4 md:px-6">
        <header className="sticky top-0 z-20 mb-4 rounded-xl border border-[var(--tl-border-subtle)] bg-[rgba(17,24,39,0.92)] px-4 py-3 backdrop-blur">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <Link
                href="/upload"
                className="text-base font-semibold text-[var(--tl-text-primary)]"
              >
                Track Legend
              </Link>
              <p className="text-xs text-[var(--tl-text-secondary)]">
                Core flow: upload - sessions - laps - compare
              </p>
            </div>
            <AppNav />
          </div>
        </header>

        <main className="flex-1 rounded-xl border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] p-4 md:p-6">
          {children}
        </main>
      </div>
    </AppProviders>
  );
}
