"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  createUpload,
  getUploadStatus,
  type UploadProcessingStage,
  type UploadProcessingStatus,
  type UploadStatusResponse,
} from "@/shared/api";
import { PlaceholderCard } from "@/shared/ui";

type ViewState = "idle" | "drag-active" | "uploading" | "polling" | "error";

const statusCopy: Record<UploadProcessingStatus, string> = {
  queued: "Queued for processing",
  running: "Processing telemetry export",
  done: "Session ready. Opening details...",
  error: "Processing failed",
};

const stageCopy: Record<UploadProcessingStage, string> = {
  queued: "Queued",
  open_duckdb: "Open DuckDB",
  discover_schema: "Discover schema",
  extract_raw_signals: "Extract raw signals",
  segment_laps: "Segment laps",
  normalize_distance: "Normalize distance",
  resample: "Resample traces",
  persist_session: "Persist session",
  finalize: "Finalize",
};

const stageDescription: Record<UploadProcessingStage, string> = {
  queued: "Upload accepted and waiting for a worker slot.",
  open_duckdb: "Opening the telemetry export in read-only mode.",
  discover_schema: "Inspecting DuckDB tables and mapping logical channels.",
  extract_raw_signals: "Reading raw telemetry rows and session metadata.",
  segment_laps: "Splitting the raw stream into lap candidates.",
  normalize_distance: "Making lap distance monotonic and validating laps.",
  resample: "Interpolating telemetry to a fixed comparison grid.",
  persist_session: "Writing session, laps and samples to PostgreSQL.",
  finalize: "Linking the upload to the created session and finishing.",
};

const orderedStages: UploadProcessingStage[] = [
  "queued",
  "open_duckdb",
  "discover_schema",
  "extract_raw_signals",
  "segment_laps",
  "normalize_distance",
  "resample",
  "persist_session",
  "finalize",
];

function getLocalValidationError(file: File | null) {
  if (!file) return "Select a .duckdb file to continue.";
  if (!file.name.toLowerCase().endsWith(".duckdb")) {
    return "Unsupported file type. Only .duckdb files are supported.";
  }
  return null;
}

function getStatusDescription(
  status: UploadStatusResponse | undefined,
  currentFileName: string | null,
) {
  if (!status) {
    return currentFileName
      ? `Uploading ${currentFileName} and waiting for ingest queue.`
      : "Uploading file and preparing ingest job.";
  }

  if (status.status === "queued") {
    return stageDescription[status.stage];
  }

  if (status.status === "running") {
    return stageDescription[status.stage];
  }

  if (status.status === "done") {
    return "Processing completed successfully.";
  }

  return status.error?.message
    ? `Failed during ${stageCopy[status.stage]}. ${status.error.message}`
    : `Upload processing failed during ${stageCopy[status.stage]}.`;
}

export default function UploadScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewState, setViewState] = useState<ViewState>("idle");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: createUpload,
    onMutate: (file) => {
      setInlineError(null);
      setSelectedFileName(file.name);
      setViewState("uploading");
      setUploadId(null);
    },
    onSuccess: (response) => {
      setUploadId(response.uploadId);
      setViewState("polling");
    },
    onError: (error) => {
      setUploadId(null);
      setViewState("error");
      setInlineError(
        error instanceof ApiError ? error.message : "Upload request failed. Please try again.",
      );
    },
  });

  const statusQuery = useQuery({
    queryKey: ["upload-status", uploadId],
    queryFn: () => getUploadStatus(uploadId!),
    enabled: uploadId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "error" ? false : 2_000;
    },
    staleTime: 0,
  });

  useEffect(() => {
    const status = statusQuery.data;
    if (!status) return;

    if (status.status === "done" && status.sessionId) {
      startTransition(() => {
        router.push(`/sessions/${status.sessionId}`);
      });
    }
  }, [router, statusQuery.data]);

  function resetFlow() {
    setViewState("idle");
    setSelectedFileName(null);
    setUploadId(null);
    setInlineError(null);
    uploadMutation.reset();
    if (uploadId) {
      queryClient.removeQueries({ queryKey: ["upload-status", uploadId] });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function beginUpload(file: File | null) {
    const validationError = getLocalValidationError(file);

    if (validationError) {
      setInlineError(validationError);
      setViewState("error");
      return;
    }

    if (!file) {
      return;
    }

    uploadMutation.mutate(file);
  }

  function handleBrowseClick() {
    if (uploadMutation.isPending || effectiveViewState === "polling") return;
    fileInputRef.current?.click();
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadMutation.isPending || effectiveViewState === "polling") return;
    setViewState("drag-active");
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadMutation.isPending || effectiveViewState === "polling") return;
    setViewState(hasError ? "error" : "idle");
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (uploadMutation.isPending || effectiveViewState === "polling") return;
    const file = event.dataTransfer.files.item(0);
    beginUpload(file);
  }

  const statusFailureMessage =
    statusQuery.data?.status === "error"
      ? statusQuery.data.error?.message ?? "Upload processing failed."
      : statusQuery.data?.status === "done" && !statusQuery.data.sessionId
        ? "Processing completed without a session id."
        : statusQuery.error instanceof ApiError
          ? statusQuery.error.message
          : statusQuery.error
            ? "Failed to refresh upload status."
            : null;

  const inlineErrorMessage = inlineError ?? statusFailureMessage;
  const hasError = inlineErrorMessage !== null;
  const effectiveViewState = hasError ? "error" : viewState;
  const activeStatus =
    statusQuery.data?.status ?? (effectiveViewState === "uploading" ? "queued" : null);
  const activeStage =
    statusQuery.data?.stage ?? (effectiveViewState === "uploading" ? "queued" : null);
  const busy = uploadMutation.isPending || effectiveViewState === "polling";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[var(--tl-text-primary)]">
          Upload & Ingestion
        </h1>
        <p className="text-sm text-[var(--tl-text-secondary)]">
          Drop a Le Mans Ultimate telemetry export and stay on the upload page until the session is ready.
        </p>
      </div>

      <PlaceholderCard
        title={busy ? "Processing upload" : "Telemetry upload"}
        description="Supported format: .duckdb"
        className="min-h-72"
      >
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept=".duckdb"
          className="hidden"
          onChange={(event) => beginUpload(event.target.files?.item(0) ?? null)}
        />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`rounded-2xl border border-dashed p-6 transition md:p-8 ${
            effectiveViewState === "drag-active"
              ? "border-[var(--tl-accent-primary)] bg-[rgba(39,211,162,0.12)]"
              : hasError
                ? "border-[var(--tl-error)] bg-[rgba(255,93,115,0.08)]"
                : "border-[var(--tl-border-strong)] bg-[rgba(39,211,162,0.06)]"
          }`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <p className="text-lg font-semibold text-[var(--tl-text-primary)]">
                {busy ? "Uploading..." : "Drag and drop your .duckdb export"}
              </p>
              <p className="max-w-2xl text-sm text-[var(--tl-text-secondary)]">
                {getStatusDescription(statusQuery.data, selectedFileName)}
              </p>
              {activeStage ? (
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--tl-accent-primary)]">
                  Stage: {stageCopy[activeStage]}
                </p>
              ) : null}
              {selectedFileName ? (
                <p className="font-mono text-xs text-[var(--tl-text-muted)]">
                  Current file: {selectedFileName}
                </p>
              ) : null}
              {inlineErrorMessage ? (
                <p className="text-sm text-[var(--tl-error)]">{inlineErrorMessage}</p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleBrowseClick}
                disabled={busy}
                className="rounded-md border border-[var(--tl-accent-secondary)] bg-[rgba(92,168,255,0.14)] px-4 py-2 text-sm font-medium text-[var(--tl-text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Browse files
              </button>
              {(hasError || selectedFileName) ? (
                <button
                  type="button"
                  onClick={resetFlow}
                  className="rounded-md border border-[var(--tl-border-subtle)] bg-[var(--tl-bg-elev-2)] px-4 py-2 text-sm text-[var(--tl-text-secondary)] hover:text-[var(--tl-text-primary)]"
                >
                  Upload another file
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </PlaceholderCard>

      <div className="grid gap-4 md:grid-cols-4">
        {(["queued", "running", "done", "error"] as UploadProcessingStatus[]).map((status) => {
          const isActive = activeStatus === status;
          const isComplete =
            (activeStatus === "running" && status === "queued") ||
            (activeStatus === "done" && (status === "queued" || status === "running")) ||
            (activeStatus === "error" && (status === "queued" || status === "running"));

          return (
            <PlaceholderCard
              key={status}
              title={statusCopy[status]}
              description={
                status === "queued"
                  ? "File is accepted by the API."
                  : status === "running"
                    ? "Worker ingests the telemetry export."
                    : status === "done"
                      ? "Session id is ready for navigation."
                      : "Validation or ingest failure is shown inline."
              }
              className={isActive ? "border-[var(--tl-accent-primary)]" : ""}
            >
              <div
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-[rgba(39,211,162,0.14)] text-[var(--tl-text-primary)]"
                    : isComplete
                      ? "bg-[rgba(92,168,255,0.16)] text-[var(--tl-text-primary)]"
                      : "bg-[var(--tl-bg-elev-1)] text-[var(--tl-text-muted)]"
                }`}
              >
                {isActive ? "Current" : isComplete ? "Completed" : "Waiting"}
              </div>
            </PlaceholderCard>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {orderedStages.map((stage, index) => {
          const currentIndex = activeStage ? orderedStages.indexOf(activeStage) : -1;
          const isActive = activeStage === stage;
          const isComplete =
            currentIndex > index &&
            activeStatus !== "error" &&
            activeStatus !== null;
          const isFailed = activeStatus === "error" && activeStage === stage;

          return (
            <PlaceholderCard
              key={stage}
              title={stageCopy[stage]}
              description={stageDescription[stage]}
              className={isActive ? "border-[var(--tl-accent-secondary)]" : ""}
            >
              <div
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  isFailed
                    ? "bg-[rgba(255,93,115,0.16)] text-[var(--tl-text-primary)]"
                    : isActive
                      ? "bg-[rgba(39,211,162,0.14)] text-[var(--tl-text-primary)]"
                      : isComplete
                        ? "bg-[rgba(92,168,255,0.16)] text-[var(--tl-text-primary)]"
                        : "bg-[var(--tl-bg-elev-1)] text-[var(--tl-text-muted)]"
                }`}
              >
                {isFailed ? "Failed" : isActive ? "Current" : isComplete ? "Completed" : "Waiting"}
              </div>
            </PlaceholderCard>
          );
        })}
      </div>
    </div>
  );
}
