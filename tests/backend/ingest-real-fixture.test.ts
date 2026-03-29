import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { processIngestJob } from "@/server/worker/ingest-worker";

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

describe("processIngestJob real LMU fixture", () => {
  it("ingests the Monza export without MissingChannelsError", async () => {
    const fixturePath = join(
      process.cwd(),
      "tests/backend/fixtures/monza-lmu-2026-02-05.duckdb",
    );

    expect(existsSync(fixturePath)).toBe(true);

    const markError = vi.fn().mockResolvedValue(undefined);
    const markDone = vi.fn().mockResolvedValue(undefined);
    const persistSession = vi.fn().mockResolvedValue({
      sessionId: "session-real-1",
      referenceLapId: "lap-real-1",
    });

    const result = await processIngestJob(
      {
        id: "job-real-1",
        data: {
          uploadId: "upload-real-1",
        },
      },
      {
        getConfig: createConfig,
        getUpload: vi.fn().mockResolvedValue({
          uploadId: "upload-real-1",
          status: "queued",
          stage: "queued",
          originalFilename: "monza-lmu-2026-02-05.duckdb",
          storedPath: fixturePath,
          fileSizeBytes: 9_285_632,
          sessionId: null,
        }),
        markRunning: vi.fn().mockResolvedValue(undefined),
        markStage: vi.fn().mockResolvedValue(undefined),
        markDone,
        markError,
        persistSession,
      },
    );

    expect(result).toEqual({
      uploadId: "upload-real-1",
      sessionId: "session-real-1",
    });
    expect(markError).not.toHaveBeenCalled();
    expect(markDone).toHaveBeenCalledWith("upload-real-1", "session-real-1");

    const persistedDraft = persistSession.mock.calls[0]?.[0];
    expect(persistedDraft.metadata.trackCode).not.toBe("UNKNOWN_TRACK");
    expect(persistedDraft.metadata.carClass).toBe("GT3");
    expect(persistedDraft.laps.length).toBeGreaterThan(0);
  });
});
