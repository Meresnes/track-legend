import { getErrorMessage } from "../errors";

type LogLevel = "info" | "error";

type IngestLogPayload = {
  uploadId?: string;
  jobId?: string;
  sessionId?: string | null;
  stage?: string;
  durationMs?: number;
  errorCode?: string;
  message?: string;
  event: string;
};

export function logIngestEvent(level: LogLevel, payload: IngestLogPayload) {
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(`[worker] ${line}`);
    return;
  }

  console.info(`[worker] ${line}`);
}

export function logIngestFailure(payload: IngestLogPayload, error: unknown) {
  logIngestEvent("error", {
    ...payload,
    message: getErrorMessage(error),
  });
}
