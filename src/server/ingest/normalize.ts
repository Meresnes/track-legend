import { NormalizationError } from "./errors";
import {
  type CanonicalLap,
  type CanonicalSample,
  type NormalizedSessionDraft,
  type RawSample,
  type SegmentedLap,
  type SessionMetadata,
} from "./types";

const newLapDistanceDropThresholdM = 100;
const minimumLapDistanceM = 100;
const minimumLapSampleCount = 4;

function sortSamples(samples: RawSample[]) {
  return [...samples].sort((left, right) => left.ts - right.ts);
}

function detectLapNumberReliability(samples: RawSample[]) {
  const lapNumbers = new Set(
    samples
      .map((sample) => sample.lapNumber)
      .filter((lapNumber): lapNumber is number => lapNumber !== null && lapNumber >= 0),
  );

  return lapNumbers.size > 1;
}

function segmentByLapNumber(samples: RawSample[]) {
  const grouped = new Map<number, RawSample[]>();

  for (const sample of sortSamples(samples)) {
    const lapNumber = sample.lapNumber ?? 0;
    const bucket = grouped.get(lapNumber) ?? [];
    bucket.push(sample);
    grouped.set(lapNumber, bucket);
  }

  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([lapNumber, lapSamples]) => buildSegmentedLap(lapNumber, sortSamples(lapSamples)));
}

function segmentByLapDistance(samples: RawSample[]) {
  const sorted = sortSamples(samples);
  const laps: RawSample[][] = [];
  let currentLap: RawSample[] = [];
  let lapNumber = 1;

  for (const sample of sorted) {
    const previousSample = currentLap[currentLap.length - 1];

    if (
      previousSample &&
      previousSample.lapDistM - sample.lapDistM > newLapDistanceDropThresholdM &&
      sample.lapDistM < previousSample.lapDistM * 0.5
    ) {
      laps.push(currentLap);
      currentLap = [];
      lapNumber += 1;
    }

    currentLap.push({
      ...sample,
      lapNumber,
    });
  }

  if (currentLap.length > 0) {
    laps.push(currentLap);
  }

  return laps.map((lapSamples, index) => buildSegmentedLap(index + 1, lapSamples));
}

function buildSegmentedLap(lapNumber: number, samples: RawSample[]): SegmentedLap {
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const lapTimeMs =
    firstSample && lastSample && lastSample.ts > firstSample.ts
      ? lastSample.ts - firstSample.ts
      : null;
  const distanceM = lastSample?.lapDistM ?? 0;
  const isValid =
    samples.length >= minimumLapSampleCount &&
    distanceM >= minimumLapDistanceM &&
    lapTimeMs !== null &&
    lapTimeMs > 0;

  return {
    lapNumber,
    isValid,
    lapTimeMs,
    distanceM,
    samples,
  };
}

function makeDistancesMonotonic(samples: RawSample[]) {
  const normalized: RawSample[] = [];

  for (const sample of sortSamples(samples)) {
    const previous = normalized[normalized.length - 1];
    const lapDistM = previous ? Math.max(previous.lapDistM, sample.lapDistM) : sample.lapDistM;
    const nextSample = {
      ...sample,
      lapDistM,
    };

    if (previous && Math.abs(previous.lapDistM - lapDistM) < 1e-6) {
      normalized[normalized.length - 1] = nextSample;
      continue;
    }

    normalized.push(nextSample);
  }

  return normalized;
}

function interpolateNullable(
  leftValue: number | null,
  rightValue: number | null,
  ratio: number,
) {
  if (leftValue == null && rightValue == null) return null;
  if (leftValue == null) return rightValue;
  if (rightValue == null) return leftValue;
  return leftValue + (rightValue - leftValue) * ratio;
}

function nearestNullable(
  leftValue: number | null,
  rightValue: number | null,
  ratio: number,
) {
  return ratio <= 0.5 ? leftValue : rightValue;
}

function resampleLap(lap: SegmentedLap, points: number): CanonicalLap {
  const distanceM = lap.samples[lap.samples.length - 1]?.lapDistM ?? 0;

  if (lap.samples.length === 0) {
    throw new NormalizationError(
      `Lap ${lap.lapNumber} does not contain any telemetry samples.`,
      "resample",
    );
  }

  if (lap.samples.length === 1 || distanceM <= 0) {
    const single = lap.samples[0];
    return {
      lapNumber: lap.lapNumber,
      isValid: false,
      lapTimeMs: lap.lapTimeMs,
      distanceM,
      samples: Array.from({ length: points }, (_, idx) => ({
        idx,
        tMs: single.ts - lap.samples[0]!.ts,
        distM: 0,
        speedMs: single.speedMs,
        throttle: single.throttle,
        brake: single.brake,
        steering: single.steering,
        gear: single.gear,
      })),
    };
  }

  let cursor = 0;
  const baseTs = lap.samples[0]!.ts;
  const canonicalSamples: CanonicalSample[] = [];

  for (let idx = 0; idx < points; idx += 1) {
    const targetDist = points === 1 ? 0 : (distanceM * idx) / (points - 1);

    while (
      cursor < lap.samples.length - 2 &&
      lap.samples[cursor + 1]!.lapDistM < targetDist
    ) {
      cursor += 1;
    }

    const left = lap.samples[cursor]!;
    const right = lap.samples[Math.min(cursor + 1, lap.samples.length - 1)]!;
    const distSpan = right.lapDistM - left.lapDistM;
    const ratio = distSpan <= 0 ? 0 : (targetDist - left.lapDistM) / distSpan;

    canonicalSamples.push({
      idx,
      tMs: Math.round(interpolateNullable(left.ts - baseTs, right.ts - baseTs, ratio) ?? 0),
      distM: targetDist,
      speedMs: interpolateNullable(left.speedMs, right.speedMs, ratio),
      throttle: interpolateNullable(left.throttle, right.throttle, ratio),
      brake: interpolateNullable(left.brake, right.brake, ratio),
      steering: interpolateNullable(left.steering, right.steering, ratio),
      gear: nearestNullable(left.gear, right.gear, ratio),
    });
  }

  return {
    lapNumber: lap.lapNumber,
    isValid: lap.isValid,
    lapTimeMs: lap.lapTimeMs,
    distanceM,
    samples: canonicalSamples,
  };
}

export function segmentTelemetryLaps(samples: RawSample[]) {
  if (samples.length === 0) {
    throw new NormalizationError("Telemetry upload did not contain samples.", "segment_laps");
  }

  if (detectLapNumberReliability(samples)) {
    return segmentByLapNumber(samples);
  }

  return segmentByLapDistance(samples);
}

export function normalizeLapDistances(laps: SegmentedLap[]) {
  return laps.map((lap) => {
    const samples = makeDistancesMonotonic(lap.samples);
    const distanceM = samples[samples.length - 1]?.lapDistM ?? 0;

    return {
      ...lap,
      distanceM,
      isValid:
        samples.length >= minimumLapSampleCount &&
        distanceM >= minimumLapDistanceM &&
        lap.lapTimeMs !== null &&
        lap.lapTimeMs > 0,
      samples,
    } satisfies SegmentedLap;
  });
}

export function resampleTelemetryLaps(laps: SegmentedLap[], resamplePoints: number) {
  if (!Number.isInteger(resamplePoints) || resamplePoints <= 1) {
    throw new NormalizationError(
      `Resample point count must be greater than 1. Received ${resamplePoints}.`,
      "resample",
    );
  }

  return laps.map((lap) => resampleLap(lap, resamplePoints));
}

export function selectReferenceLap(laps: CanonicalLap[]) {
  const valid = laps
    .filter((lap) => lap.isValid && lap.lapTimeMs !== null)
    .sort((left, right) => (left.lapTimeMs ?? Number.MAX_SAFE_INTEGER) - (right.lapTimeMs ?? Number.MAX_SAFE_INTEGER));

  if (valid.length > 0) {
    return valid[0]!.lapNumber;
  }

  const fallback = laps
    .filter((lap) => lap.lapTimeMs !== null)
    .sort((left, right) => (left.lapTimeMs ?? Number.MAX_SAFE_INTEGER) - (right.lapTimeMs ?? Number.MAX_SAFE_INTEGER));

  return fallback[0]?.lapNumber ?? null;
}

export function normalizeTelemetrySamples(
  samples: RawSample[],
  metadata: SessionMetadata,
  resamplePoints: number,
): NormalizedSessionDraft {
  const segmented = segmentTelemetryLaps(samples);
  const normalized = normalizeLapDistances(segmented);
  const canonicalLaps = resampleTelemetryLaps(normalized, resamplePoints);

  if (canonicalLaps.length === 0) {
    throw new NormalizationError("Telemetry upload did not produce any laps.", "resample");
  }

  return {
    metadata,
    laps: canonicalLaps,
    referenceLapNumber: selectReferenceLap(canonicalLaps),
  };
}
