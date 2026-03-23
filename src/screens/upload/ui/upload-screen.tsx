import { PlaceholderCard } from "@/shared/ui";

export default function UploadScreen() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">
          Upload & Ingestion
        </h1>
        <p className="text-sm text-[var(--tl-text-secondary)]">
          Upload Le Mans Ultimate telemetry export as .duckdb and monitor ingestion state.
        </p>
      </div>

      <PlaceholderCard
        title="Dropzone placeholder"
        description="File input UI will be connected in the next sprint."
        className="min-h-44"
      >
        <div className="rounded-lg border border-dashed border-[var(--tl-border-strong)] bg-[rgba(39,211,162,0.06)] p-6 text-sm text-[var(--tl-text-secondary)]">
          Drop .duckdb file here or click to browse.
        </div>
      </PlaceholderCard>

      <div className="grid gap-4 md:grid-cols-4">
        <PlaceholderCard title="Queued" description="Waiting for worker slot" />
        <PlaceholderCard title="Running" description="Parsing telemetry payload" />
        <PlaceholderCard title="Done" description="Session is ready for review" />
        <PlaceholderCard title="Error" description="Validation or backend failure" />
      </div>
    </div>
  );
}
