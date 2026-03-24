import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { createIngestWorker, processIngestJob, startIngestWorker } from "@/server/worker/ingest-worker";

function createConfig(): AppConfig {
  return {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/track_legend?schema=public",
    redisUrl: "redis://localhost:6379",
    uploadDir: "/tmp/uploads",
    maxUploadMb: 200,
    maxUploadBytes: 200 * 1024 * 1024,
    ingestQueueName: "telemetry_ingest",
    defaultResamplePoints: 2000,
  };
}

describe("ingest worker", () => {
  it("processes the expected ingest payload shape", async () => {
    const result = await processIngestJob({
      id: "job-1",
      data: {
        uploadId: "upload-1",
        originalFilename: "session.duckdb",
        storedPath: "/data/uploads/upload-1.duckdb",
        enqueuedAt: "2026-03-24T12:00:00.000Z",
      },
    });

    expect(result).toEqual({
      uploadId: "upload-1",
      storedPath: "/data/uploads/upload-1.duckdb",
    });
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
