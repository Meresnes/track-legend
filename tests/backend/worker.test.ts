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
  it("marks upload running, creates a session, and completes upload", async () => {
    const markRunning = vi.fn().mockResolvedValue(undefined);
    const createSession = vi.fn().mockResolvedValue({
      id: "session-1",
      sourceFilename: "session.duckdb",
    });
    const markDone = vi.fn().mockResolvedValue(undefined);

    const result = await processIngestJob({
      id: "job-1",
      data: {
        uploadId: "upload-1",
      },
    }, {
      getUpload: vi.fn().mockResolvedValue({
        uploadId: "upload-1",
        status: "queued",
        originalFilename: "session.duckdb",
        storedPath: "/data/uploads/upload-1.duckdb",
        sessionId: null,
      }),
      markRunning,
      createSession,
      markDone,
      markError: vi.fn(),
    });

    expect(result).toEqual({
      uploadId: "upload-1",
      sessionId: "session-1",
    });
    expect(markRunning).toHaveBeenCalledWith("upload-1");
    expect(createSession).toHaveBeenCalledWith("session.duckdb");
    expect(markDone).toHaveBeenCalledWith("upload-1", "session-1");
  });

  it("persists ingest errors on the upload", async () => {
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
          getUpload: vi.fn().mockResolvedValue({
            uploadId: "upload-1",
            status: "queued",
            originalFilename: "session.duckdb",
            storedPath: "/data/uploads/upload-1.duckdb",
            sessionId: null,
          }),
          markRunning: vi.fn().mockResolvedValue(undefined),
          createSession: vi.fn().mockRejectedValue(new Error("db unavailable")),
          markDone: vi.fn(),
          markError,
        },
      ),
    ).rejects.toThrow("db unavailable");

    expect(markError).toHaveBeenCalledWith("upload-1", {
      code: "INTERNAL_INGEST_ERROR",
      message: "db unavailable",
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
