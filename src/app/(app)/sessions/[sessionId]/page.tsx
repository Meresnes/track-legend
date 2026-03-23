import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceholderCard } from "@/components/placeholder-card";

type SessionDetailPageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { sessionId } = await params;

  if (!sessionId) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">
            Session Laps: {sessionId}
          </h1>
          <p className="text-sm text-[var(--tl-text-secondary)]">
            Placeholder for lap list, best lap marker and reference lap action.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/sessions"
            className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] px-3 py-1.5 text-sm text-[var(--tl-text-secondary)] hover:text-[var(--tl-text-primary)]"
          >
            Back to sessions
          </Link>
          <Link
            href="/compare"
            className="rounded-md border border-[var(--tl-accent-primary)] bg-[rgba(39,211,162,0.12)] px-3 py-1.5 text-sm text-[var(--tl-text-primary)]"
          >
            Go to compare
          </Link>
        </div>
      </div>

      <PlaceholderCard
        title="Lap table placeholder"
        description="Rows, best lap badge, reference lap badge and actions will be wired next."
      >
        <div className="space-y-2 text-xs text-[var(--tl-text-secondary)]">
          <p>Lap 7 - 1:46.218 - Best</p>
          <p>Lap 9 - 1:46.503 - Reference</p>
          <p>Lap 11 - 1:46.887</p>
        </div>
      </PlaceholderCard>
    </div>
  );
}
