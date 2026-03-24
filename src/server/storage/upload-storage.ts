import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type AppConfig, getAppConfig } from "../config";
import { ServerError } from "../errors";

function assertUploadFile(file: File, config: AppConfig) {
  if (file.name.trim().length === 0) {
    throw new ServerError(400, "UPLOAD_FILE_INVALID", "Uploaded file name is empty.");
  }

  if (!file.name.toLowerCase().endsWith(".duckdb")) {
    throw new ServerError(
      400,
      "UPLOAD_FILE_TYPE_UNSUPPORTED",
      "Only .duckdb uploads are supported.",
    );
  }

  if (file.size <= 0) {
    throw new ServerError(400, "UPLOAD_FILE_EMPTY", "Uploaded file is empty.");
  }

  if (file.size > config.maxUploadBytes) {
    throw new ServerError(
      413,
      "UPLOAD_FILE_TOO_LARGE",
      `Uploaded file exceeds ${config.maxUploadMb}MB limit.`,
    );
  }
}

export function getUploadPath(
  uploadId: string,
  config: AppConfig = getAppConfig(),
) {
  return join(config.uploadDir, `${uploadId}.duckdb`);
}

export async function saveUpload(
  file: File,
  uploadId: string,
  config: AppConfig = getAppConfig(),
) {
  assertUploadFile(file, config);

  await mkdir(config.uploadDir, { recursive: true });

  const outputPath = getUploadPath(uploadId, config);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(outputPath, buffer);

  return outputPath;
}

export async function deleteUpload(
  uploadId: string,
  config: AppConfig = getAppConfig(),
) {
  await rm(getUploadPath(uploadId, config), { force: true });
}
