import { describe, expect, it, vi } from "vitest";
import { enqueueIngestJob, INGEST_JOB_NAME } from "@/server/queues/ingest";

describe("ingest queue producer", () => {
  it("creates BullMQ jobs with the expected payload", async () => {
    const add = vi.fn().mockResolvedValue(undefined);

    await enqueueIngestJob(
      { add },
      {
        uploadId: "upload-1",
      },
    );

    expect(add).toHaveBeenCalledWith(
      INGEST_JOB_NAME,
      {
        uploadId: "upload-1",
      },
      expect.objectContaining({
        removeOnComplete: 25,
        removeOnFail: 100,
      }),
    );
  });
});
