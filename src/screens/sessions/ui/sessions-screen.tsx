"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ApiError, getSessions } from "@/shared/api";
import { formatLapTime } from "@/shared/lib/lap-time";
import { PlaceholderCard } from "@/shared/ui";

function formatSessionDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function SessionsScreen() {
  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: getSessions,
    staleTime: 30_000,
  });

  const items = sessionsQuery.data?.items ?? [];
  const isEmpty = !sessionsQuery.isPending && items.length === 0;
  const errorMessage =
    sessionsQuery.error instanceof ApiError
      ? sessionsQuery.error.message
      : sessionsQuery.error
        ? "Failed to load sessions."
        : null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">Sessions</h1>
        <p className="text-sm text-[var(--tl-text-secondary)]">
          Review imported sessions, pick a reference lap, and move into compare mode.
        </p>
      </div>

      {errorMessage ? (
        <PlaceholderCard
          title="Unable to load sessions"
          description="The backend did not return a session list."
        >
          <p className="text-sm text-[var(--tl-error)]">{errorMessage}</p>
        </PlaceholderCard>
      ) : null}

      {sessionsQuery.isPending ? (
        <PlaceholderCard title="Loading sessions" description="Fetching telemetry uploads.">
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`session-skeleton-${index}`}
                className="h-10 w-full animate-pulse rounded-lg bg-[var(--tl-bg-elev-2)]"
              />
            ))}
          </div>
        </PlaceholderCard>
      ) : null}

      {isEmpty ? (
        <PlaceholderCard
          title="No sessions yet"
          description="Upload a .duckdb file to create your first session."
        >
          <Link
            href="/upload"
            className="inline-flex w-fit rounded-md border border-[var(--tl-accent-secondary)] bg-[rgba(92,168,255,0.14)] px-3 py-1.5 text-sm font-medium text-[var(--tl-text-primary)]"
          >
            Upload telemetry
          </Link>
        </PlaceholderCard>
      ) : null}

      {!sessionsQuery.isPending && items.length > 0 ? (
        <div className="rounded-2xl border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)]">
          <div className="grid grid-cols-6 gap-3 border-b border-[var(--tl-border-subtle)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tl-text-muted)]">
            <div>Date</div>
            <div>Track</div>
            <div>Car</div>
            <div>Laps</div>
            <div>Best lap</div>
            <div>Action</div>
          </div>
          <div className="divide-y divide-[var(--tl-border-subtle)]">
            {items.map((session) => (
              <div
                key={session.sessionId}
                className="grid grid-cols-6 items-center gap-3 px-4 py-3 text-sm text-[var(--tl-text-secondary)]"
              >
                <div className="text-[var(--tl-text-primary)]">
                  {formatSessionDate(session.createdAt)}
                </div>
                <div>
                  <p className="text-[var(--tl-text-primary)]">{session.trackCode}</p>
                  <p className="text-xs text-[var(--tl-text-muted)]">
                    {session.referenceLapId ? "Reference set" : "No reference"}
                  </p>
                </div>
                <div>{session.carClass}</div>
                <div className="font-mono text-[var(--tl-text-primary)]">
                  {session.lapsCount}
                </div>
                <div className="font-mono text-[var(--tl-text-primary)]">
                  {formatLapTime(session.bestLapTimeMs)}
                </div>
                <div>
                  <Link
                    href={`/sessions/${session.sessionId}`}
                    className="inline-flex w-fit rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-xs font-semibold text-[var(--tl-text-primary)] hover:border-[var(--tl-accent-secondary)]"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
