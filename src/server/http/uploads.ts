import { randomUUID } from "node:crypto";
import { type AppConfig, getAppConfig } from "../config";
import {
  createQueuedUploadRecord,
  deleteUploadRecord,
  getUploadStatusSnapshot,
  isPrismaNotFoundError,
} from "../data/uploads";
import { getErrorMessage, ServerError, toErrorResponse } from "../errors";
import { enqueueUploadForIngest, type IngestJobPayload } from "../queues/ingest";
import { deleteUpload, saveUpload } from "../storage/upload-storage";

type HandleUploadRequestDeps = {
  getConfig?: () => AppConfig;
  saveUpload?: typeof saveUpload;
  deleteUpload?: typeof deleteUpload;
  createUploadRecord?: typeof createQueuedUploadRecord;
  deleteUploadRecord?: typeof deleteUploadRecord;
  enqueueUpload?: (payload: IngestJobPayload, config: AppConfig) => Promise<void>;
  generateUploadId?: () => string;
};

type HandleUploadStatusRequestDeps = {
  getUploadStatus?: typeof getUploadStatusSnapshot;
};

function createUploadQueuedResponse(uploadId: string) {
  return Response.json(
    {
      uploadId,
      status: "queued",
      stage: "queued",
    },
    { status: 201 },
  );
}

export async function handleUploadRequest(
  request: Request,
  deps: HandleUploadRequestDeps = {},
) {
  const config = deps.getConfig?.() ?? getAppConfig();
  const persistUpload = deps.saveUpload ?? saveUpload;
  const removeUpload = deps.deleteUpload ?? deleteUpload;
  const persistUploadRecord = deps.createUploadRecord ?? createQueuedUploadRecord;
  const removeUploadRecord = deps.deleteUploadRecord ?? deleteUploadRecord;
  const enqueueUpload = deps.enqueueUpload ?? enqueueUploadForIngest;
  const uploadId = deps.generateUploadId?.() ?? randomUUID();

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return toErrorResponse(
      new ServerError(
        400,
        "UPLOAD_FORMDATA_INVALID",
        "Upload request body must be valid multipart form-data.",
      ),
    );
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return toErrorResponse(
      new ServerError(400, "UPLOAD_FILE_REQUIRED", "Field 'file' is required."),
    );
  }

  let storedPath: string;

  try {
    storedPath = await persistUpload(file, uploadId, config);
  } catch (error) {
    return toErrorResponse(error);
  }

  try {
    await persistUploadRecord({
      uploadId,
      originalFilename: file.name,
      storedPath,
      fileSizeBytes: file.size,
    });
  } catch (error) {
    await removeUpload(uploadId, config).catch(() => undefined);
    return toErrorResponse(error);
  }

  try {
    await enqueueUpload(
      {
        uploadId,
      },
      config,
    );
  } catch (error) {
    await removeUpload(uploadId, config).catch(() => undefined);
    await removeUploadRecord(uploadId).catch(() => undefined);

    return toErrorResponse(
      new ServerError(
        503,
        "UPLOAD_QUEUE_UNAVAILABLE",
        `Failed to enqueue upload for processing: ${getErrorMessage(error)}`,
      ),
    );
  }

  return createUploadQueuedResponse(uploadId);
}

export async function handleUploadStatusRequest(
  uploadId: string,
  deps: HandleUploadStatusRequestDeps = {},
) {
  const lookupStatus = deps.getUploadStatus ?? getUploadStatusSnapshot;

  try {
    const status = await lookupStatus(uploadId);

    if (!status) {
      return toErrorResponse(
        new ServerError(404, "UPLOAD_NOT_FOUND", `Upload '${uploadId}' was not found.`),
      );
    }

    return Response.json(status, { status: 200 });
  } catch (error) {
    if (isPrismaNotFoundError(error)) {
      return toErrorResponse(
        new ServerError(404, "UPLOAD_NOT_FOUND", `Upload '${uploadId}' was not found.`),
      );
    }

    return toErrorResponse(error);
  }
}
