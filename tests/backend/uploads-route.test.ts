import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { handleUploadRequest } from "@/server/http/uploads";

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

function createUploadRequest(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return new Request("http://localhost/api/uploads", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/uploads", () => {
  it("accepts a valid .duckdb upload and enqueues it", async () => {
    const saveUpload = vi.fn().mockResolvedValue("/data/uploads/upload-1.duckdb");
    const enqueueUpload = vi.fn().mockResolvedValue(undefined);

    const response = await handleUploadRequest(
      createUploadRequest(new File([Buffer.from("telemetry")], "session.duckdb")),
      {
        getConfig: createConfig,
        saveUpload,
        enqueueUpload,
        generateUploadId: () => "upload-1",
      },
    );

    const body = await response.json();

    expect(response.status).toBe(202);
    expect(saveUpload).toHaveBeenCalledOnce();
    expect(enqueueUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadId: "upload-1",
        originalFilename: "session.duckdb",
        storedPath: "/data/uploads/upload-1.duckdb",
      }),
      expect.objectContaining({
        ingestQueueName: "telemetry_ingest",
      }),
    );
    expect(body).toEqual({
      queueName: "telemetry_ingest",
      status: "accepted",
      uploadId: "upload-1",
    });
  });

  it("rejects non-duckdb uploads", async () => {
    const response = await handleUploadRequest(
      createUploadRequest(new File([Buffer.from("telemetry")], "session.txt")),
      {
        getConfig: createConfig,
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_FILE_TYPE_UNSUPPORTED",
      message: "Only .duckdb uploads are supported.",
    });
  });

  it("rejects uploads above MAX_UPLOAD_MB", async () => {
    const response = await handleUploadRequest(
      createUploadRequest(
        new File([Buffer.alloc(2 * 1024 * 1024)], "session.duckdb"),
      ),
      {
        getConfig: () => ({
          ...createConfig(),
          maxUploadMb: 1,
          maxUploadBytes: 1024 * 1024,
        }),
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_FILE_TOO_LARGE",
      message: "Uploaded file exceeds 1MB limit.",
    });
  });

  it("returns a 503 when queueing fails and deletes the stored upload", async () => {
    const deleteUpload = vi.fn().mockResolvedValue(undefined);

    const response = await handleUploadRequest(
      createUploadRequest(new File([Buffer.from("telemetry")], "session.duckdb")),
      {
        getConfig: createConfig,
        saveUpload: vi.fn().mockResolvedValue("/data/uploads/upload-1.duckdb"),
        enqueueUpload: vi.fn().mockRejectedValue(new Error("redis unavailable")),
        deleteUpload,
        generateUploadId: () => "upload-1",
      },
    );

    expect(response.status).toBe(503);
    expect(deleteUpload).toHaveBeenCalledWith("upload-1", expect.any(Object));
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_QUEUE_UNAVAILABLE",
      message: "Failed to enqueue upload for processing: redis unavailable",
    });
  });
});
