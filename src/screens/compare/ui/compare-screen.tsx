import { ErrorProbe } from "@/features/dev/error-probe";
import { PlaceholderCard } from "@/shared/ui";

export default function CompareScreen() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">Compare</h1>
        <p className="text-sm text-[var(--tl-text-secondary)]">
          Track map + synchronized charts + corner analysis placeholders from Pencil baseline.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <PlaceholderCard
          title="Track map (always visible)"
          description="Segment click will zoom charts via startDistM/endDistM."
          className="h-[560px]"
        >
          <div className="h-[470px] rounded-lg border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-1)] p-3 text-xs text-[var(--tl-text-secondary)]">
            Polyline + segment overlays placeholder
          </div>
        </PlaceholderCard>

        <div className="space-y-4">
          <PlaceholderCard
            title="Speed chart"
            description="Shared X-axis distance, Lap A/Lap B overlay."
            className="h-32"
          />
          <PlaceholderCard
            title="Throttle chart"
            description="Shared X-axis distance, synchronized zoom."
            className="h-32"
          />
          <PlaceholderCard
            title="Brake chart"
            description="Shared X-axis distance, synchronized zoom."
            className="h-32"
          />
          <PlaceholderCard
            title="Steering chart"
            description="Shared X-axis distance, synchronized zoom."
            className="h-32"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <PlaceholderCard
          title="Corner table"
          description="Clickable corner rows will sync map highlight and chart zoom."
        >
          <p className="text-xs text-[var(--tl-text-secondary)]">
            No data yet. Corner metrics will be shown after API wiring.
          </p>
        </PlaceholderCard>
        <PlaceholderCard
          title="Insights"
          description="Rule-based recommendations with segment links."
        >
          <p className="text-xs text-[var(--tl-text-secondary)]">No insights yet.</p>
        </PlaceholderCard>
      </div>

      <PlaceholderCard
        title="Error handling probe"
        description="Use this to validate apiClient + toast + route ErrorBoundary behavior."
      >
        <ErrorProbe />
      </PlaceholderCard>
    </div>
  );
}
