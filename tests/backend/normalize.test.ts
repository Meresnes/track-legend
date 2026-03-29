import { describe, expect, it } from "vitest";
import {
  normalizeLapDistances,
  normalizeTelemetrySamples,
  resampleTelemetryLaps,
  segmentTelemetryLaps,
  selectReferenceLap,
} from "@/server/ingest/normalize";
import type { RawSample, SessionMetadata } from "@/server/ingest/types";

function createMetadata(): SessionMetadata {
  return {
    sourceFilename: "session.duckdb",
    sim: "LMU",
    trackCode: "MONZA_GP",
    carClass: "HYPERCAR_2023",
  };
}

function createRawSamples(): RawSample[] {
  return [
    { ts: 0, lapNumber: null, lapDistM: 0, speedMs: 40, throttle: 0, brake: 0, steering: 0, gear: 2 },
    { ts: 1000, lapNumber: null, lapDistM: 250, speedMs: 42, throttle: 0.2, brake: 0, steering: 0.02, gear: 3 },
    { ts: 2000, lapNumber: null, lapDistM: 500, speedMs: 45, throttle: 0.4, brake: 0, steering: 0.03, gear: 3 },
    { ts: 3000, lapNumber: null, lapDistM: 800, speedMs: 44, throttle: 0.3, brake: 0.1, steering: 0.01, gear: 3 },
    { ts: 4000, lapNumber: null, lapDistM: 5, speedMs: 41, throttle: 0, brake: 0, steering: 0, gear: 2 },
    { ts: 4900, lapNumber: null, lapDistM: 280, speedMs: 43, throttle: 0.25, brake: 0, steering: 0.04, gear: 3 },
    { ts: 5800, lapNumber: null, lapDistM: 510, speedMs: 46, throttle: 0.6, brake: 0, steering: 0.05, gear: 4 },
    { ts: 6700, lapNumber: null, lapDistM: 790, speedMs: 45, throttle: 0.32, brake: 0.08, steering: 0.02, gear: 4 },
  ];
}

describe("telemetry normalization", () => {
  it("segments laps by distance reset when lap numbers are absent", () => {
    const laps = segmentTelemetryLaps(createRawSamples());

    expect(laps).toHaveLength(2);
    expect(laps[0]?.lapNumber).toBe(1);
    expect(laps[1]?.lapNumber).toBe(2);
  });

  it("normalizes distance and resamples laps to a fixed grid", () => {
    const segmented = segmentTelemetryLaps([
      { ts: 0, lapNumber: 7, lapDistM: 0, speedMs: 40, throttle: 0, brake: 0, steering: 0, gear: 2 },
      { ts: 1000, lapNumber: 7, lapDistM: 250, speedMs: 42, throttle: 0.2, brake: 0, steering: 0.02, gear: 3 },
      { ts: 2000, lapNumber: 7, lapDistM: 220, speedMs: 45, throttle: 0.4, brake: 0, steering: 0.03, gear: 3 },
      { ts: 3000, lapNumber: 7, lapDistM: 800, speedMs: 44, throttle: 0.3, brake: 0.1, steering: 0.01, gear: 3 },
    ]);
    const normalized = normalizeLapDistances(segmented);
    const resampled = resampleTelemetryLaps(normalized, 6);

    expect(normalized[0]?.samples.map((sample) => sample.lapDistM)).toEqual([0, 250, 800]);
    expect(resampled[0]?.samples).toHaveLength(6);
    expect(resampled[0]?.samples[0]?.distM).toBe(0);
    expect(resampled[0]?.samples.at(-1)?.distM).toBe(800);
  });

  it("selects the fastest valid lap as the reference lap", () => {
    const session = normalizeTelemetrySamples(createRawSamples(), createMetadata(), 5);

    expect(session.laps).toHaveLength(2);
    expect(selectReferenceLap(session.laps)).toBe(2);
    expect(session.referenceLapNumber).toBe(2);
    expect(session.laps[0]?.samples).toHaveLength(5);
  });
});
