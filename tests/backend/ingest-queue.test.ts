import { describe, expect, it, vi } from "vitest";
import { enqueueIngestJob, INGEST_JOB_NAME } from "@/server/queues/ingest";

describe("ingest queue producer", () => {
  it("creates BullMQ jobs with the expected payload", async () => {
    const add = vi.fn().mockResolvedValue(undefined);

    await enqueueIngestJob(
      { add },
      {
        uploadId: "upload-1",
        originalFilename: "session.duckdb",
        storedPath: "/data/uploads/upload-1.duckdb",
        enqueuedAt: "2026-03-24T12:00:00.000Z",
      },
    );

    expect(add).toHaveBeenCalledWith(
      INGEST_JOB_NAME,
      {
        uploadId: "upload-1",
        originalFilename: "session.duckdb",
        storedPath: "/data/uploads/upload-1.duckdb",
        enqueuedAt: "2026-03-24T12:00:00.000Z",
      },
      expect.objectContaining({
        removeOnComplete: 25,
        removeOnFail: 100,
      }),
    );
  });
});
