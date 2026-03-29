import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { processIngestJob } from "@/server/worker/ingest-worker";
import { createDuckDbFixture } from "./helpers/duckdb-fixture";

const cleanupFns: Array<() => Promise<void>> = [];

function createConfig(): AppConfig {
  return {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/track_legend?schema=public",
    redisUrl: "redis://localhost:6379",
    uploadDir: "/tmp/uploads",
    maxUploadMb: 200,
    maxUploadBytes: 200 * 1024 * 1024,
    ingestQueueName: "telemetry_ingest",
    defaultResamplePoints: 6,
  };
}

afterEach(async () => {
  while (cleanupFns.length > 0) {
    const cleanup = cleanupFns.pop();
    await cleanup?.();
  }
});

describe("processIngestJob integration", () => {
  it("processes a real duckdb fixture through discovery and normalization", async () => {
    const fixture = await createDuckDbFixture({ format: "wide_table" });
    cleanupFns.push(fixture.cleanup);
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
          originalFilename: "fixture.duckdb",
          storedPath: fixture.filePath,
          fileSizeBytes: 4096,
          sessionId: null,
        }),
        markRunning,
        markStage,
        markDone,
        markError: vi.fn(),
        persistSession,
      },
    );

    expect(result).toEqual({
      uploadId: "upload-1",
      sessionId: "session-1",
    });
    expect(markRunning).toHaveBeenCalledWith("upload-1", "open_duckdb");
    expect(markStage).toHaveBeenCalledWith("upload-1", "persist_session");
    expect(markDone).toHaveBeenCalledWith("upload-1", "session-1");
    expect(persistSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          sourceFilename: "fixture.duckdb",
          trackCode: "MONZA_GP",
          carClass: "HYPERCAR_2023",
        }),
        referenceLapNumber: 2,
      }),
    );
    const persistedDraft = persistSession.mock.calls[0]?.[0];
    expect(persistedDraft.laps).toHaveLength(2);
    expect(persistedDraft.laps[0].samples).toHaveLength(6);
  });

  it("processes LMU channel-table fixture and preserves metadata from key/value table", async () => {
    const fixture = await createDuckDbFixture({ format: "channel_tables" });
    cleanupFns.push(fixture.cleanup);
    const markRunning = vi.fn().mockResolvedValue(undefined);
    const markStage = vi.fn().mockResolvedValue(undefined);
    const markDone = vi.fn().mockResolvedValue(undefined);
    const persistSession = vi.fn().mockResolvedValue({
      sessionId: "session-1",
      referenceLapId: "lap-2",
    });

    await processIngestJob(
      {
        id: "job-2",
        data: {
          uploadId: "upload-2",
        },
      },
      {
        getConfig: createConfig,
        getUpload: vi.fn().mockResolvedValue({
          uploadId: "upload-2",
          status: "queued",
          stage: "queued",
          originalFilename: "fixture.duckdb",
          storedPath: fixture.filePath,
          fileSizeBytes: 4096,
          sessionId: null,
        }),
        markRunning,
        markStage,
        markDone,
        markError: vi.fn(),
        persistSession,
      },
    );

    expect(markRunning).toHaveBeenCalledWith("upload-2", "open_duckdb");
    expect(markStage).toHaveBeenCalledWith("upload-2", "persist_session");
    expect(markDone).toHaveBeenCalledWith("upload-2", "session-1");
    expect(persistSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          sourceFilename: "fixture.duckdb",
          trackCode: "MONZA_GP",
          carClass: "GT3",
        }),
      }),
    );
  });
});
