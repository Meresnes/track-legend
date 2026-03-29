import { Prisma, type PrismaClient, type Upload, type UploadStatus } from "@prisma/client";
import { getPrismaClient } from "../prisma";
import { type ProcessingStage } from "../ingest/types";

export type UploadErrorPayload = {
  code: string;
  message: string;
};

export type UploadStatusSnapshot = {
  uploadId: string;
  status: UploadStatus;
  stage: ProcessingStage;
  sessionId: string | null;
  error: UploadErrorPayload | null;
};

export type UploadRecordForProcessing = {
  uploadId: string;
  status: UploadStatus;
  stage: ProcessingStage;
  originalFilename: string;
  storedPath: string;
  fileSizeBytes: number;
  sessionId: string | null;
};

type PrismaLike = Pick<
  PrismaClient,
  "upload" | "session"
>;

type UploadRecordInput = {
  uploadId: string;
  originalFilename: string;
  storedPath: string;
  fileSizeBytes: number;
};

function getClient(client?: PrismaLike) {
  return client ?? getPrismaClient();
}

function mapUploadStatus(
  upload: Pick<
    Upload,
    "id" | "status" | "processingStage" | "sessionId" | "errorCode" | "errorMessage"
  >,
) {
  return {
    uploadId: upload.id,
    status: upload.status,
    stage: upload.processingStage,
    sessionId: upload.sessionId,
    error:
      upload.errorCode && upload.errorMessage
        ? {
            code: upload.errorCode,
            message: upload.errorMessage,
          }
        : null,
  } satisfies UploadStatusSnapshot;
}

export async function createQueuedUploadRecord(
  input: UploadRecordInput,
  client?: PrismaLike,
) {
  return getClient(client).upload.create({
    data: {
      id: input.uploadId,
      originalFilename: input.originalFilename,
      storedPath: input.storedPath,
      fileSizeBytes: input.fileSizeBytes,
      status: "queued",
      processingStage: "queued",
    },
  });
}

export async function deleteUploadRecord(uploadId: string, client?: PrismaLike) {
  await getClient(client).upload.delete({
    where: {
      id: uploadId,
    },
  });
}

export async function getUploadStatusSnapshot(
  uploadId: string,
  client?: PrismaLike,
) {
  const upload = await getClient(client).upload.findUnique({
    where: {
      id: uploadId,
    },
    select: {
      id: true,
      status: true,
      processingStage: true,
      sessionId: true,
      errorCode: true,
      errorMessage: true,
    },
  });

  return upload ? mapUploadStatus(upload) : null;
}

export async function getUploadForProcessing(
  uploadId: string,
  client?: PrismaLike,
) {
  const upload = await getClient(client).upload.findUnique({
    where: {
      id: uploadId,
    },
    select: {
      id: true,
      status: true,
      processingStage: true,
      originalFilename: true,
      storedPath: true,
      fileSizeBytes: true,
      sessionId: true,
    },
  });

  if (!upload) return null;

  return {
    uploadId: upload.id,
    status: upload.status,
    stage: upload.processingStage,
    originalFilename: upload.originalFilename,
    storedPath: upload.storedPath,
    fileSizeBytes: upload.fileSizeBytes,
    sessionId: upload.sessionId,
  } satisfies UploadRecordForProcessing;
}

export async function markUploadRunning(
  uploadId: string,
  stage: ProcessingStage = "open_duckdb",
  client?: PrismaLike,
) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      status: "running",
      processingStage: stage,
      startedAt: new Date(),
      finishedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });
}

export async function markUploadStage(
  uploadId: string,
  stage: ProcessingStage,
  client?: PrismaLike,
) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      processingStage: stage,
    },
  });
}

export async function markUploadDone(
  uploadId: string,
  sessionId: string,
  client?: PrismaLike,
) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      status: "done",
      processingStage: "finalize",
      sessionId,
      errorCode: null,
      errorMessage: null,
      finishedAt: new Date(),
    },
  });
}

export async function markUploadError(
  uploadId: string,
  error: UploadErrorPayload,
  stage: ProcessingStage,
  client?: PrismaLike,
) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      status: "error",
      processingStage: stage,
      errorCode: error.code,
      errorMessage: error.message,
      finishedAt: new Date(),
    },
  });
}

export function isPrismaNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
