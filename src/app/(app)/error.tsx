"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-[var(--tl-error)] bg-[rgba(69,27,37,0.8)] p-6">
      <h2 className="text-lg font-semibold text-[var(--tl-text-primary)]">
        Something went wrong in the app shell
      </h2>
      <p className="mt-2 text-sm text-[var(--tl-text-secondary)]">
        The route-level boundary caught an unexpected error.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-4 rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-sm text-[var(--tl-text-primary)]"
      >
        Try again
      </button>
    </div>
  );
}
