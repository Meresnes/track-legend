import { apiClient } from "./client";
import { ApiError } from "./errors";

export type UploadProcessingStatus = "queued" | "running" | "done" | "error";
export type UploadProcessingStage =
  | "queued"
  | "open_duckdb"
  | "discover_schema"
  | "extract_raw_signals"
  | "segment_laps"
  | "normalize_distance"
  | "resample"
  | "persist_session"
  | "finalize";

export type CreateUploadResponse = {
  uploadId: string;
  status: "queued";
  stage: "queued";
};

export type UploadStatusError = {
  code: string;
  message: string;
};

type RawUploadStatusResponse = {
  uploadId?: unknown;
  status?: unknown;
  stage?: unknown;
  sessionId?: unknown;
  error?: unknown;
};

export type UploadStatusResponse = {
  uploadId: string;
  status: UploadProcessingStatus;
  stage: UploadProcessingStage;
  sessionId: string | null;
  error: UploadStatusError | null;
};

function isUploadStatus(value: unknown): value is UploadProcessingStatus {
  return value === "queued" || value === "running" || value === "done" || value === "error";
}

function isUploadStage(value: unknown): value is UploadProcessingStage {
  return (
    value === "queued" ||
    value === "open_duckdb" ||
    value === "discover_schema" ||
    value === "extract_raw_signals" ||
    value === "segment_laps" ||
    value === "normalize_distance" ||
    value === "resample" ||
    value === "persist_session" ||
    value === "finalize"
  );
}

function parseUploadError(value: unknown): UploadStatusError | null {
  if (value == null) return null;

  if (typeof value === "string" && value.trim().length > 0) {
    return {
      code: "UPLOAD_ERROR",
      message: value,
    };
  }

  if (typeof value === "object" && value !== null) {
    const code =
      "code" in value && typeof value.code === "string" ? value.code : "UPLOAD_ERROR";
    const message =
      "message" in value && typeof value.message === "string" ? value.message : null;

    if (message) {
      return { code, message };
    }
  }

  return null;
}

function parseUploadStatusResponse(payload: RawUploadStatusResponse): UploadStatusResponse {
  if (
    typeof payload.uploadId !== "string" ||
    !isUploadStatus(payload.status) ||
    !isUploadStage(payload.stage)
  ) {
    throw new ApiError({
      status: 500,
      code: "UPLOAD_STATUS_INVALID",
      message: "Upload status response is invalid.",
      details: payload,
    });
  }

  return {
    uploadId: payload.uploadId,
    status: payload.status,
    stage: payload.stage,
    sessionId: typeof payload.sessionId === "string" ? payload.sessionId : null,
    error: parseUploadError(payload.error),
  };
}

export async function createUpload(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiClient<CreateUploadResponse>("/api/uploads", {
    method: "POST",
    body: formData,
  });
}

export async function getUploadStatus(uploadId: string) {
  const payload = await apiClient<RawUploadStatusResponse>(`/api/uploads/${uploadId}`);
  return parseUploadStatusResponse(payload);
}
