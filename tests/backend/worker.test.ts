import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { MissingChannelsError } from "@/server/ingest/errors";
import { createIngestWorker, processIngestJob, startIngestWorker } from "@/server/worker/ingest-worker";

function createConfig(): AppConfig {
  return {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/track_legend?schema=public",
    redisUrl: "redis://localhost:6379",
    uploadDir: "/tmp/uploads",
    maxUploadMb: 200,
    maxUploadBytes: 200 * 1024 * 1024,
    ingestQueueName: "telemetry_ingest",
    defaultResamplePoints: 8,
  };
}

describe("ingest worker", () => {
  it("runs stage transitions and finalizes upload with a persisted session", async () => {
    const markRunning = vi.fn().mockResolvedValue(undefined);
    const markStage = vi.fn().mockResolvedValue(undefined);
    const markDone = vi.fn().mockResolvedValue(undefined);
    const persistSession = vi.fn().mockResolvedValue({
      sessionId: "session-1",
      referenceLapId: "lap-2",
    });

    const result = await processIngestJob(
      {
        id: "job-1",
        data: {
          uploadId: "upload-1",
        },
      },
      {
        getConfig: createConfig,
        getUpload: vi.fn().mockResolvedValue({
          uploadId: "upload-1",
          status: "queued",
          stage: "queued",
          originalFilename: "session.duckdb",
          storedPath: "/data/uploads/upload-1.duckdb",
          fileSizeBytes: 128,
          sessionId: null,
        }),
        markRunning,
        markStage,
        markDone,
        markError: vi.fn(),
        openDuckDb: vi.fn().mockResolvedValue({
          connection: {},
          instance: {},
        }),
        closeDuckDb: vi.fn(),
        discoverSchema: vi.fn().mockResolvedValue({
          tables: [],
        }),
        resolveChannels: vi.fn().mockReturnValue({
          format: "wide_table",
          telemetryTable: "telemetry_samples",
          timestamp: { tableName: "telemetry_samples", columnName: "sample_time_ms" },
          lapNumber: { tableName: "telemetry_samples", columnName: "lap_number" },
          lapDistM: { tableName: "telemetry_samples", columnName: "lap_distance_m" },
          speedMs: null,
          speedKph: { tableName: "telemetry_samples", columnName: "speed_kph" },
          throttle: { tableName: "telemetry_samples", columnName: "throttle_pct" },
          brake: { tableName: "telemetry_samples", columnName: "brake_pct" },
          steering: { tableName: "telemetry_samples", columnName: "steering_deg" },
          gear: { tableName: "telemetry_samples", columnName: "gear" },
          trackCode: { tableName: "session_meta", columnName: "track_code" },
          carClass: { tableName: "session_meta", columnName: "car_class" },
          metadataTable: null,
          channelTables: null,
        }),
        readMetadata: vi.fn().mockResolvedValue({
          sourceFilename: "session.duckdb",
          sim: "LMU",
          trackCode: "MONZA_GP",
          carClass: "HYPERCAR_2023",
        }),
        readSamples: vi.fn().mockResolvedValue([
          {
            ts: 0,
            lapNumber: 1,
            lapDistM: 0,
            speedMs: 40,
            throttle: 0.2,
            brake: 0,
            steering: 0.01,
            gear: 2,
          },
        ]),
        segmentLaps: vi.fn().mockResolvedValue([
          {
            lapNumber: 1,
            isValid: true,
            lapTimeMs: 4000,
            distanceM: 1000,
            samples: [
              {
                ts: 0,
                lapNumber: 1,
                lapDistM: 0,
                speedMs: 40,
                throttle: 0.2,
                brake: 0,
                steering: 0.01,
                gear: 2,
              },
            ],
          },
        ]),
        normalizeDistances: vi.fn().mockResolvedValue([
          {
            lapNumber: 1,
            isValid: true,
            lapTimeMs: 4000,
            distanceM: 1000,
            samples: [
              {
                ts: 0,
                lapNumber: 1,
                lapDistM: 0,
                speedMs: 40,
                throttle: 0.2,
                brake: 0,
                steering: 0.01,
                gear: 2,
              },
            ],
          },
        ]),
        resampleLaps: vi.fn().mockResolvedValue([
          {
            lapNumber: 1,
            isValid: true,
            lapTimeMs: 4000,
            distanceM: 1000,
            samples: [
              {
                idx: 0,
                tMs: 0,
                distM: 0,
                speedMs: 40,
                throttle: 0.2,
                brake: 0,
                steering: 0.01,
                gear: 2,
              },
            ],
          },
        ]),
        selectReference: vi.fn().mockReturnValue(1),
        persistSession,
      },
    );

    expect(result).toEqual({
      uploadId: "upload-1",
      sessionId: "session-1",
    });
    expect(markRunning).toHaveBeenCalledWith("upload-1", "open_duckdb");
    expect(markStage).toHaveBeenNthCalledWith(1, "upload-1", "discover_schema");
    expect(markStage).toHaveBeenNthCalledWith(2, "upload-1", "extract_raw_signals");
    expect(markStage).toHaveBeenNthCalledWith(3, "upload-1", "segment_laps");
    expect(markStage).toHaveBeenNthCalledWith(4, "upload-1", "normalize_distance");
    expect(markStage).toHaveBeenNthCalledWith(5, "upload-1", "resample");
    expect(markStage).toHaveBeenNthCalledWith(6, "upload-1", "persist_session");
    expect(persistSession).toHaveBeenCalledWith({
      metadata: {
        sourceFilename: "session.duckdb",
        sim: "LMU",
        trackCode: "MONZA_GP",
        carClass: "HYPERCAR_2023",
      },
      laps: [
        {
          lapNumber: 1,
          isValid: true,
          lapTimeMs: 4000,
          distanceM: 1000,
          samples: [
            {
              idx: 0,
              tMs: 0,
              distM: 0,
              speedMs: 40,
              throttle: 0.2,
              brake: 0,
              steering: 0.01,
              gear: 2,
            },
          ],
        },
      ],
      referenceLapNumber: 1,
    });
    expect(markDone).toHaveBeenCalledWith("upload-1", "session-1");
  });

  it("persists typed ingest failures with the failing stage", async () => {
    const markError = vi.fn().mockResolvedValue(undefined);

    await expect(
      processIngestJob(
        {
          id: "job-1",
          data: {
            uploadId: "upload-1",
          },
        },
        {
          getConfig: createConfig,
          getUpload: vi.fn().mockResolvedValue({
            uploadId: "upload-1",
            status: "queued",
            stage: "queued",
            originalFilename: "session.duckdb",
            storedPath: "/data/uploads/upload-1.duckdb",
            fileSizeBytes: 128,
            sessionId: null,
          }),
          markRunning: vi.fn().mockResolvedValue(undefined),
          markStage: vi.fn().mockResolvedValue(undefined),
          markDone: vi.fn(),
          markError,
          openDuckDb: vi.fn().mockResolvedValue({
            connection: {},
            instance: {},
          }),
          closeDuckDb: vi.fn(),
          discoverSchema: vi.fn().mockResolvedValue({
            tables: [],
          }),
          resolveChannels: vi.fn().mockReturnValue({
            format: "wide_table",
            telemetryTable: "telemetry_samples",
            timestamp: { tableName: "telemetry_samples", columnName: "sample_time_ms" },
            lapNumber: { tableName: "telemetry_samples", columnName: "lap_number" },
            lapDistM: { tableName: "telemetry_samples", columnName: "lap_distance_m" },
            speedMs: null,
            speedKph: { tableName: "telemetry_samples", columnName: "speed_kph" },
            throttle: { tableName: "telemetry_samples", columnName: "throttle_pct" },
            brake: { tableName: "telemetry_samples", columnName: "brake_pct" },
            steering: { tableName: "telemetry_samples", columnName: "steering_deg" },
            gear: { tableName: "telemetry_samples", columnName: "gear" },
            trackCode: null,
            carClass: null,
            metadataTable: null,
            channelTables: null,
          }),
          readMetadata: vi.fn().mockResolvedValue({
            sourceFilename: "session.duckdb",
            sim: "LMU",
            trackCode: "UNKNOWN_TRACK",
            carClass: "UNKNOWN_CLASS",
          }),
          readSamples: vi
            .fn()
            .mockRejectedValue(new MissingChannelsError(["brake"], "extract_raw_signals")),
        },
      ),
    ).rejects.toThrow("Required channels are missing: brake.");

    expect(markError).toHaveBeenCalledWith(
      "upload-1",
      {
        code: "MISSING_CHANNELS",
        message: "Required channels are missing: brake.",
      },
      "extract_raw_signals",
    );
  });

  it("fails clearly when worker config is invalid", () => {
    expect(() =>
      createIngestWorker({
        config: {
          ...createConfig(),
          redisUrl: "",
        },
      }),
    ).toThrow("Worker requires REDIS_URL.");
  });

  it("fails clearly when Redis readiness fails", async () => {
    await expect(
      startIngestWorker({
        config: createConfig(),
        workerFactory: () => ({
          close: vi.fn().mockResolvedValue(undefined),
          on: vi.fn(),
          waitUntilReady: vi.fn().mockRejectedValue(new Error("redis unavailable")),
        }),
      }),
    ).rejects.toThrow(
      "Worker failed to connect to Redis queue telemetry_ingest: redis unavailable",
    );
  });
});
