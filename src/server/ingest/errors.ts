import { type LogicalChannel, type ProcessingStage } from "./types";

type IngestErrorCode =
  | "UNSUPPORTED_FILE"
  | "MISSING_CHANNELS"
  | "DUCKDB_READ_ERROR"
  | "NORMALIZATION_ERROR"
  | "TRACK_NOT_SUPPORTED"
  | "INTERNAL_INGEST_ERROR";

export class IngestError extends Error {
  readonly code: IngestErrorCode;
  readonly stage: ProcessingStage;

  constructor(code: IngestErrorCode, stage: ProcessingStage, message: string) {
    super(message);
    this.name = "IngestError";
    this.code = code;
    this.stage = stage;
  }
}

export class UnsupportedFileError extends IngestError {
  constructor(message: string, stage: ProcessingStage = "open_duckdb") {
    super("UNSUPPORTED_FILE", stage, message);
    this.name = "UnsupportedFileError";
  }
}

export class MissingChannelsError extends IngestError {
  readonly missingChannels: LogicalChannel[];

  constructor(missingChannels: LogicalChannel[], stage: ProcessingStage = "discover_schema") {
    super(
      "MISSING_CHANNELS",
      stage,
      `Required channels are missing: ${missingChannels.join(", ")}.`,
    );
    this.name = "MissingChannelsError";
    this.missingChannels = missingChannels;
  }
}

export class DuckDbReadError extends IngestError {
  constructor(message: string, stage: ProcessingStage) {
    super("DUCKDB_READ_ERROR", stage, message);
    this.name = "DuckDbReadError";
  }
}

export class NormalizationError extends IngestError {
  constructor(message: string, stage: ProcessingStage) {
    super("NORMALIZATION_ERROR", stage, message);
    this.name = "NormalizationError";
  }
}

export class TrackNotSupportedError extends IngestError {
  constructor(message: string, stage: ProcessingStage) {
    super("TRACK_NOT_SUPPORTED", stage, message);
    this.name = "TrackNotSupportedError";
  }
}

export class InternalIngestError extends IngestError {
  constructor(message: string, stage: ProcessingStage = "finalize") {
    super("INTERNAL_INGEST_ERROR", stage, message);
    this.name = "InternalIngestError";
  }
}

export function toIngestError(
  error: unknown,
  fallbackStage: ProcessingStage = "finalize",
) {
  if (error instanceof IngestError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalIngestError(error.message, fallbackStage);
  }

  return new InternalIngestError("Unknown ingest error.", fallbackStage);
}
