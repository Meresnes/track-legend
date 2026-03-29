export const processingStages = [
  "queued",
  "open_duckdb",
  "discover_schema",
  "extract_raw_signals",
  "segment_laps",
  "normalize_distance",
  "resample",
  "persist_session",
  "finalize",
] as const;

export type ProcessingStage = (typeof processingStages)[number];

export type LogicalChannel =
  | "timestamp"
  | "lapNumber"
  | "lapDistM"
  | "speed"
  | "throttle"
  | "brake"
  | "steering"
  | "gear"
  | "trackCode"
  | "carClass";

export type DiscoveredDuckDbColumn = {
  tableName: string;
  columnName: string;
  dataType: string;
  normalizedName: string;
};

export type DiscoveredDuckDbTable = {
  tableName: string;
  normalizedName: string;
  columns: DiscoveredDuckDbColumn[];
};

export type DiscoveredDuckDbSchema = {
  tables: DiscoveredDuckDbTable[];
};

export type ResolvedDuckDbColumn = {
  tableName: string;
  columnName: string;
};

export type TelemetrySchemaFormat = "wide_table" | "channel_tables";

export type ResolvedChannelTable = {
  tableName: string;
  valueColumn: string;
  tsColumn: string | null;
};

export type ResolvedMetadataTable = {
  tableName: string;
  keyColumn: string;
  valueColumn: string;
};

export type ResolvedTelemetryChannels = {
  format: TelemetrySchemaFormat;
  telemetryTable: string | null;
  timestamp: ResolvedDuckDbColumn;
  lapNumber: ResolvedDuckDbColumn | null;
  lapDistM: ResolvedDuckDbColumn;
  speedMs: ResolvedDuckDbColumn | null;
  speedKph: ResolvedDuckDbColumn | null;
  throttle: ResolvedDuckDbColumn;
  brake: ResolvedDuckDbColumn;
  steering: ResolvedDuckDbColumn;
  gear: ResolvedDuckDbColumn | null;
  trackCode: ResolvedDuckDbColumn | null;
  carClass: ResolvedDuckDbColumn | null;
  metadataTable: ResolvedMetadataTable | null;
  channelTables: {
    timestamp: ResolvedChannelTable;
    lapDistM: ResolvedChannelTable | null;
    speedMs: ResolvedChannelTable | null;
    speedKph: ResolvedChannelTable | null;
    throttle: ResolvedChannelTable | null;
    brake: ResolvedChannelTable | null;
    steering: ResolvedChannelTable | null;
    lapNumber: ResolvedChannelTable | null;
    gear: ResolvedChannelTable | null;
  } | null;
};

export type SessionMetadata = {
  sourceFilename: string;
  sim: string;
  trackCode: string;
  carClass: string;
};

export type RawSample = {
  ts: number;
  lapNumber: number | null;
  lapDistM: number;
  speedMs: number | null;
  throttle: number | null;
  brake: number | null;
  steering: number | null;
  gear: number | null;
};

export type SegmentedLap = {
  lapNumber: number;
  isValid: boolean;
  lapTimeMs: number | null;
  distanceM: number;
  samples: RawSample[];
};

export type CanonicalSample = {
  idx: number;
  tMs: number;
  distM: number;
  speedMs: number | null;
  throttle: number | null;
  brake: number | null;
  steering: number | null;
  gear: number | null;
};

export type CanonicalLap = {
  lapNumber: number;
  isValid: boolean;
  lapTimeMs: number | null;
  distanceM: number;
  samples: CanonicalSample[];
};

export type NormalizedSessionDraft = {
  metadata: SessionMetadata;
  laps: CanonicalLap[];
  referenceLapNumber: number | null;
};

export function isProcessingStage(value: unknown): value is ProcessingStage {
  return typeof value === "string" && processingStages.includes(value as ProcessingStage);
}
