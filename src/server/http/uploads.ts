import { randomUUID } from "node:crypto";
import { type AppConfig, getAppConfig } from "../config";
import { getErrorMessage, ServerError, toErrorResponse } from "../errors";
import { enqueueUploadForIngest, type IngestJobPayload } from "../queues/ingest";
import { deleteUpload, saveUpload } from "../storage/upload-storage";

type HandleUploadRequestDeps = {
  getConfig?: () => AppConfig;
  saveUpload?: typeof saveUpload;
  deleteUpload?: typeof deleteUpload;
  enqueueUpload?: (payload: IngestJobPayload, config: AppConfig) => Promise<void>;
  generateUploadId?: () => string;
};

function createAcceptedResponse(uploadId: string, queueName: string) {
  return Response.json(
    {
      uploadId,
      queueName,
      status: "accepted",
    },
    { status: 202 },
  );
}

export async function handleUploadRequest(
  request: Request,
  deps: HandleUploadRequestDeps = {},
) {
  const config = deps.getConfig?.() ?? getAppConfig();
  const persistUpload = deps.saveUpload ?? saveUpload;
  const removeUpload = deps.deleteUpload ?? deleteUpload;
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
    await enqueueUpload(
      {
        uploadId,
        originalFilename: file.name,
        storedPath,
        enqueuedAt: new Date().toISOString(),
      },
      config,
    );
  } catch (error) {
    await removeUpload(uploadId, config).catch(() => undefined);

    return toErrorResponse(
      new ServerError(
        503,
        "UPLOAD_QUEUE_UNAVAILABLE",
        `Failed to enqueue upload for processing: ${getErrorMessage(error)}`,
      ),
    );
  }

  return createAcceptedResponse(uploadId, config.ingestQueueName);
}
