"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ApiError,
  getSessionLaps,
  setReferenceLap,
  type SessionLapListResponse,
} from "@/shared/api";
import { formatLapTime } from "@/shared/lib/lap-time";
import { PlaceholderCard } from "@/shared/ui";

type SessionParams = {
  sessionId?: string | string[];
};

function getSessionId(params: SessionParams) {
  if (typeof params.sessionId === "string") return params.sessionId;
  if (Array.isArray(params.sessionId)) return params.sessionId[0];
  return null;
}

export default function SessionDetailScreen() {
  const params = useParams<SessionParams>();
  const sessionId = getSessionId(params);
  const queryClient = useQueryClient();
  const [inlineError, setInlineError] = useState<string | null>(null);

  const lapsQuery = useQuery({
    queryKey: ["session-laps", sessionId],
    queryFn: () => getSessionLaps(sessionId!),
    enabled: Boolean(sessionId),
    staleTime: 15_000,
  });

  const referenceMutation = useMutation({
    mutationFn: (lapId: string) => setReferenceLap(sessionId!, lapId),
    onMutate: async (lapId) => {
      setInlineError(null);
      await queryClient.cancelQueries({ queryKey: ["session-laps", sessionId] });
      const previous = queryClient.getQueryData<SessionLapListResponse>([
        "session-laps",
        sessionId,
      ]);

      if (previous) {
        queryClient.setQueryData<SessionLapListResponse>(["session-laps", sessionId], {
          ...previous,
          referenceLapId: lapId,
        });
      }

      return { previous };
    },
    onError: (error, _lapId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["session-laps", sessionId], context.previous);
      }
      setInlineError(
        error instanceof ApiError ? error.message : "Failed to update reference lap.",
      );
    },
    onSuccess: (response) => {
      queryClient.setQueryData<SessionLapListResponse>(["session-laps", sessionId], (old) =>
        old
          ? {
              ...old,
              referenceLapId: response.referenceLapId,
            }
          : old,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["session-laps", sessionId] });
    },
  });

  const lapsData = lapsQuery.data;

  if (!sessionId) {
    return (
      <PlaceholderCard
        title="Session not found"
        description="No session id was provided in the route."
      />
    );
  }

  const errorMessage =
    inlineError ??
    (lapsQuery.error instanceof ApiError
      ? lapsQuery.error.message
      : lapsQuery.error
        ? "Unable to load laps."
        : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">
            Session Laps
          </h1>
          <p className="text-sm text-[var(--tl-text-secondary)]">
            Session {sessionId} | {lapsData?.items.length ?? 0} laps | Best{" "}
            {formatLapTime(lapsData?.bestLapTimeMs ?? null)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sessions"
            className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-sm text-[var(--tl-text-secondary)] hover:text-[var(--tl-text-primary)]"
          >
            Back to sessions
          </Link>
        </div>
      </div>

      {errorMessage ? (
        <PlaceholderCard
          title="Unable to load laps"
          description="The session laps could not be loaded."
        >
          <p className="text-sm text-[var(--tl-error)]">{errorMessage}</p>
        </PlaceholderCard>
      ) : null}

      {lapsQuery.isPending ? (
        <PlaceholderCard title="Loading laps" description="Fetching lap telemetry.">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={`lap-skeleton-${index}`}
                className="h-10 w-full animate-pulse rounded-lg bg-[var(--tl-bg-elev-2)]"
              />
            ))}
          </div>
        </PlaceholderCard>
      ) : null}

      {lapsData ? (
        <div className="rounded-2xl border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)]">
          <div className="grid grid-cols-6 gap-3 border-b border-[var(--tl-border-subtle)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tl-text-muted)]">
            <div>Lap</div>
            <div>Time</div>
            <div>Status</div>
            <div>Flags</div>
            <div>Reference</div>
            <div>Compare</div>
          </div>
          <div className="divide-y divide-[var(--tl-border-subtle)]">
            {lapsData.items.map((lap) => {
              const isReference = lapsData.referenceLapId === lap.lapId;
              const isBest = lapsData.bestLapId === lap.lapId;
              const canCompare =
                Boolean(lapsData.referenceLapId) && lapsData.referenceLapId !== lap.lapId;

              return (
                <div
                  key={lap.lapId}
                  className="grid grid-cols-6 items-center gap-3 px-4 py-3 text-sm text-[var(--tl-text-secondary)]"
                >
                  <div className="font-mono text-[var(--tl-text-primary)]">
                    #{lap.lapNumber}
                  </div>
                  <div className="font-mono text-[var(--tl-text-primary)]">
                    {formatLapTime(lap.lapTimeMs)}
                  </div>
                  <div
                    className={
                      lap.isValid
                        ? "text-[var(--tl-text-primary)]"
                        : "text-[var(--tl-error)]"
                    }
                  >
                    {lap.isValid ? "Valid" : "Invalid"}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isBest ? (
                      <span className="rounded-full border border-[var(--tl-accent-secondary)] bg-[rgba(92,168,255,0.18)] px-2 py-0.5 text-xs text-[var(--tl-text-primary)]">
                        Best
                      </span>
                    ) : null}
                    {isReference ? (
                      <span className="rounded-full border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-2)] px-2 py-0.5 text-xs text-[var(--tl-text-primary)]">
                        Reference
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <button
                      type="button"
                      disabled={isReference || referenceMutation.isPending}
                      onClick={() => referenceMutation.mutate(lap.lapId)}
                      className="inline-flex w-fit rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-xs font-semibold text-[var(--tl-text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isReference ? "Selected" : "Set as reference"}
                    </button>
                  </div>
                  <div>
                    <Link
                      href={
                        canCompare
                          ? `/compare?lapA=${lap.lapId}&lapB=${lapsData.referenceLapId}`
                          : "#"
                      }
                      className={`inline-flex w-fit rounded-md border px-3 py-1.5 text-xs font-semibold ${
                        canCompare
                          ? "border-[var(--tl-accent-secondary)] bg-[rgba(92,168,255,0.14)] text-[var(--tl-text-primary)]"
                          : "cursor-not-allowed border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] text-[var(--tl-text-muted)]"
                      }`}
                      aria-disabled={!canCompare}
                    >
                      Compare
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
