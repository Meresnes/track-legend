import Link from "next/link";
import { PlaceholderCard } from "@/shared/ui";

export default function SessionsScreen() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">Sessions</h1>
        <p className="text-sm text-[var(--tl-text-secondary)]">
          Imported sessions list with quick access to laps and compare flow.
        </p>
      </div>

      <PlaceholderCard
        title="No sessions yet"
        description="This placeholder confirms the empty-state route is stable."
      >
        <p className="text-xs text-[var(--tl-text-muted)]">
          Upload your first file, then this page will show real sessions.
        </p>
      </PlaceholderCard>

      <PlaceholderCard
        title="Mock session row"
        description="Temporary row for navigation tests before real data wiring."
      >
        <div className="flex flex-col gap-3 rounded-lg border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] p-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--tl-text-primary)]">
              mock-session
            </p>
            <p className="text-xs text-[var(--tl-text-secondary)]">
              Monza GP | 14 laps | Best: 1:46.218
            </p>
          </div>
          <Link
            href="/sessions/mock-session"
            className="inline-flex w-fit rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-sm text-[var(--tl-text-primary)] hover:border-[var(--tl-accent-secondary)]"
          >
            Open laps
          </Link>
        </div>
      </PlaceholderCard>
    </div>
  );
}
