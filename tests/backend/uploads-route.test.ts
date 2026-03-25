import { describe, expect, it, vi } from "vitest";
import type { AppConfig } from "@/server/config";
import { handleUploadRequest, handleUploadStatusRequest } from "@/server/http/uploads";

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

function createInvalidUploadRequest() {
  return new Request("http://localhost/api/uploads", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
    },
    body: "invalid",
  });
}

describe("POST /api/uploads", () => {
  it("accepts a valid .duckdb upload and enqueues it", async () => {
    const saveUpload = vi.fn().mockResolvedValue("/data/uploads/upload-1.duckdb");
    const createUploadRecord = vi.fn().mockResolvedValue(undefined);
    const enqueueUpload = vi.fn().mockResolvedValue(undefined);

    const response = await handleUploadRequest(
      createUploadRequest(new File([Buffer.from("telemetry")], "session.duckdb")),
      {
        getConfig: createConfig,
        saveUpload,
        createUploadRecord,
        enqueueUpload,
        generateUploadId: () => "upload-1",
      },
    );

    const body = await response.json();

    expect(response.status).toBe(201);
    expect(saveUpload).toHaveBeenCalledOnce();
    expect(createUploadRecord).toHaveBeenCalledWith({
      uploadId: "upload-1",
      originalFilename: "session.duckdb",
      storedPath: "/data/uploads/upload-1.duckdb",
    });
    expect(enqueueUpload).toHaveBeenCalledWith(
      {
        uploadId: "upload-1",
      },
      expect.objectContaining({
        ingestQueueName: "telemetry_ingest",
      }),
    );
    expect(body).toEqual({
      status: "queued",
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

  it("rejects invalid multipart payloads", async () => {
    const response = await handleUploadRequest(createInvalidUploadRequest(), {
      getConfig: createConfig,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_FORMDATA_INVALID",
      message: "Upload request body must be valid multipart form-data.",
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
    const deleteUploadRecord = vi.fn().mockResolvedValue(undefined);

    const response = await handleUploadRequest(
      createUploadRequest(new File([Buffer.from("telemetry")], "session.duckdb")),
      {
        getConfig: createConfig,
        saveUpload: vi.fn().mockResolvedValue("/data/uploads/upload-1.duckdb"),
        createUploadRecord: vi.fn().mockResolvedValue(undefined),
        enqueueUpload: vi.fn().mockRejectedValue(new Error("redis unavailable")),
        deleteUpload,
        deleteUploadRecord,
        generateUploadId: () => "upload-1",
      },
    );

    expect(response.status).toBe(503);
    expect(deleteUpload).toHaveBeenCalledWith("upload-1", expect.any(Object));
    expect(deleteUploadRecord).toHaveBeenCalledWith("upload-1");
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_QUEUE_UNAVAILABLE",
      message: "Failed to enqueue upload for processing: redis unavailable",
    });
  });

  it("returns the current upload status snapshot", async () => {
    const response = await handleUploadStatusRequest("upload-1", {
      getUploadStatus: vi.fn().mockResolvedValue({
        uploadId: "upload-1",
        status: "done",
        sessionId: "session-1",
        error: null,
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      uploadId: "upload-1",
      status: "done",
      sessionId: "session-1",
      error: null,
    });
  });

  it("returns 404 for unknown upload status", async () => {
    const response = await handleUploadStatusRequest("missing-upload", {
      getUploadStatus: vi.fn().mockResolvedValue(null),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "UPLOAD_NOT_FOUND",
      message: "Upload 'missing-upload' was not found.",
    });
  });
});
