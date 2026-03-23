"use client";

import { useState, useTransition } from "react";
import { apiClient, ApiError } from "@/lib/api";

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error) {
    return new ApiError({
      status: 500,
      message: error.message,
    });
  }
  return new ApiError({
    status: 500,
    message: "Unknown error",
    details: error,
  });
}

export function ErrorProbe() {
  const [pending, startTransition] = useTransition();
  const [fatalError, setFatalError] = useState<ApiError | null>(null);

  if (fatalError) throw fatalError;

  const trigger = (status: 401 | 404 | 500) => {
    startTransition(async () => {
      try {
        await apiClient(`/api/dev/errors/${status}`);
      } catch (error) {
        setFatalError(toApiError(error));
      }
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--tl-text-secondary)]">
        Error probe: triggers toast and then throws into route ErrorBoundary.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => trigger(401)}
          disabled={pending}
          className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] px-3 py-1 text-xs text-[var(--tl-text-primary)]"
        >
          Simulate 401
        </button>
        <button
          type="button"
          onClick={() => trigger(404)}
          disabled={pending}
          className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] px-3 py-1 text-xs text-[var(--tl-text-primary)]"
        >
          Simulate 404
        </button>
        <button
          type="button"
          onClick={() => trigger(500)}
          disabled={pending}
          className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] px-3 py-1 text-xs text-[var(--tl-text-primary)]"
        >
          Simulate 500
        </button>
      </div>
    </div>
  );
}
