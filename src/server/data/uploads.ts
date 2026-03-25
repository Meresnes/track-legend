import { Prisma, type PrismaClient, type Upload, type UploadStatus } from "@prisma/client";
import { getPrismaClient } from "../prisma";

export type UploadErrorPayload = {
  code: string;
  message: string;
};

export type UploadStatusSnapshot = {
  uploadId: string;
  status: UploadStatus;
  sessionId: string | null;
  error: UploadErrorPayload | null;
};

export type UploadRecordForProcessing = {
  uploadId: string;
  status: UploadStatus;
  originalFilename: string;
  storedPath: string;
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
};

function getClient(client?: PrismaLike) {
  return client ?? getPrismaClient();
}

function mapUploadStatus(upload: Pick<Upload, "id" | "status" | "sessionId" | "errorCode" | "errorMessage">) {
  return {
    uploadId: upload.id,
    status: upload.status,
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
      status: "queued",
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
      originalFilename: true,
      storedPath: true,
      sessionId: true,
    },
  });

  if (!upload) return null;

  return {
    uploadId: upload.id,
    status: upload.status,
    originalFilename: upload.originalFilename,
    storedPath: upload.storedPath,
    sessionId: upload.sessionId,
  } satisfies UploadRecordForProcessing;
}

export async function markUploadRunning(uploadId: string, client?: PrismaLike) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      status: "running",
      startedAt: new Date(),
      errorCode: null,
      errorMessage: null,
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
  client?: PrismaLike,
) {
  return getClient(client).upload.update({
    where: {
      id: uploadId,
    },
    data: {
      status: "error",
      errorCode: error.code,
      errorMessage: error.message,
      finishedAt: new Date(),
    },
  });
}

export async function createSessionForUpload(
  originalFilename: string,
  client?: PrismaLike,
) {
  return getClient(client).session.create({
    data: {
      sourceFilename: originalFilename,
    },
    select: {
      id: true,
      sourceFilename: true,
    },
  });
}

export function isPrismaNotFoundError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
