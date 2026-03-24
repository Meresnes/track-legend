import Link from "next/link";

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] p-6 text-center">
      <h2 className="text-xl font-semibold text-[var(--tl-text-primary)]">Page not found</h2>
      <p className="mt-2 text-sm text-[var(--tl-text-secondary)]">
        This route does not exist in the current core flow shell.
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        <Link
          href="/"
          className="inline-flex rounded-md border border-[var(--tl-border-strong)] bg-[var(--tl-bg-elev-1)] px-3 py-1.5 text-sm text-[var(--tl-text-primary)]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
