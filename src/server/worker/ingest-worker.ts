import { Worker, type ConnectionOptions, type Job, type Processor } from "bullmq";
import { type AppConfig, getAppConfig } from "../config";
import {
  getUploadForProcessing,
  markUploadDone,
  markUploadError,
  markUploadRunning,
  markUploadStage,
  type UploadErrorPayload,
} from "../data/uploads";
import { getErrorMessage } from "../errors";
import {
  closeDuckDb,
  discoverDuckDbSchema,
  openReadOnlyDuckDb,
  readSessionMetadata,
  readTelemetrySamples,
  resolveTelemetryChannels,
} from "../ingest/duckdb";
import { logIngestEvent, logIngestFailure } from "../ingest/logging";
import {
  normalizeLapDistances,
  resampleTelemetryLaps,
  segmentTelemetryLaps,
  selectReferenceLap,
} from "../ingest/normalize";
import { persistNormalizedSession } from "../ingest/persist";
import { toIngestError } from "../ingest/errors";
import { type CanonicalLap, type ProcessingStage } from "../ingest/types";
import { type IngestJobPayload } from "../queues/ingest";
import { createRedisConnection } from "../redis";

type WorkerLike = {
  close(): Promise<void>;
  on(event: "failed", listener: (job: Job<IngestJobPayload> | undefined, error: Error) => void): void;
  waitUntilReady(): Promise<unknown>;
};

type WorkerFactory = (
  queueName: string,
  processor: Processor<IngestJobPayload>,
  options: { connection: ConnectionOptions },
) => WorkerLike;

type CreateIngestWorkerOptions = {
  config?: AppConfig;
  connection?: ConnectionOptions;
  processor?: Processor<IngestJobPayload>;
  workerFactory?: WorkerFactory;
};

type ProcessIngestJobDeps = {
  getConfig?: () => AppConfig;
  getUpload?: typeof getUploadForProcessing;
  markRunning?: typeof markUploadRunning;
  markStage?: typeof markUploadStage;
  markDone?: typeof markUploadDone;
  markError?: typeof markUploadError;
  openDuckDb?: typeof openReadOnlyDuckDb;
  closeDuckDb?: typeof closeDuckDb;
  discoverSchema?: typeof discoverDuckDbSchema;
  resolveChannels?: typeof resolveTelemetryChannels;
  readMetadata?: typeof readSessionMetadata;
  readSamples?: typeof readTelemetrySamples;
  segmentLaps?: typeof segmentTelemetryLaps;
  normalizeDistances?: typeof normalizeLapDistances;
  resampleLaps?: typeof resampleTelemetryLaps;
  selectReference?: typeof selectReferenceLap;
  persistSession?: typeof persistNormalizedSession;
};

function assertWorkerConfig(config: AppConfig) {
  if (config.redisUrl.trim().length === 0) {
    throw new Error("Worker requires REDIS_URL.");
  }

  if (config.ingestQueueName.trim().length === 0) {
    throw new Error("Worker requires INGEST_QUEUE_NAME.");
  }
}

function mapIngestError(error: unknown): UploadErrorPayload {
  const ingestError = toIngestError(error);

  return {
    code: ingestError.code,
    message: ingestError.message,
  };
}

async function runProcessingStage<T>(
  uploadId: string,
  jobId: string | null,
  stage: ProcessingStage,
  fn: () => Promise<T> | T,
  deps: Pick<ProcessIngestJobDeps, "markRunning" | "markStage">,
  started: { value: boolean },
) {
  const startedAt = Date.now();

  if (!started.value) {
    await (deps.markRunning ?? markUploadRunning)(uploadId, stage);
    started.value = true;
  } else {
    await (deps.markStage ?? markUploadStage)(uploadId, stage);
  }

  logIngestEvent("info", {
    event: "stage_started",
    uploadId,
    jobId: jobId ?? undefined,
    stage,
  });

  const result = await fn();

  logIngestEvent("info", {
    event: "stage_completed",
    uploadId,
    jobId: jobId ?? undefined,
    stage,
    durationMs: Date.now() - startedAt,
  });

  return result;
}

export async function processIngestJob(
  job: Pick<Job<IngestJobPayload>, "id" | "data">,
  deps: ProcessIngestJobDeps = {},
) {
  const config = deps.getConfig?.() ?? getAppConfig();
  const readUpload = deps.getUpload ?? getUploadForProcessing;
  const moveToRunning = deps.markRunning ?? markUploadRunning;
  const moveToStage = deps.markStage ?? markUploadStage;
  const moveToDone = deps.markDone ?? markUploadDone;
  const moveToError = deps.markError ?? markUploadError;
  const openDuckDb = deps.openDuckDb ?? openReadOnlyDuckDb;
  const closeDuckDbHandle = deps.closeDuckDb ?? closeDuckDb;
  const discoverSchema = deps.discoverSchema ?? discoverDuckDbSchema;
  const resolveChannels = deps.resolveChannels ?? resolveTelemetryChannels;
  const readMetadata = deps.readMetadata ?? readSessionMetadata;
  const readSamples = deps.readSamples ?? readTelemetrySamples;
  const segmentLaps = deps.segmentLaps ?? segmentTelemetryLaps;
  const normalizeDistances = deps.normalizeDistances ?? normalizeLapDistances;
  const resampleLaps = deps.resampleLaps ?? resampleTelemetryLaps;
  const selectReference = deps.selectReference ?? selectReferenceLap;
  const persistSession = deps.persistSession ?? persistNormalizedSession;
  const jobId = job.id ? String(job.id) : null;
  const stageStarted = { value: false };
  let currentStage: ProcessingStage = "queued";
  let sessionId: string | null = null;
  let duckDbHandle: Awaited<ReturnType<typeof openReadOnlyDuckDb>> | null = null;

  logIngestEvent("info", {
    event: "job_received",
    uploadId: job.data.uploadId,
    jobId: jobId ?? undefined,
  });

  const upload = await readUpload(job.data.uploadId);

  if (!upload) {
    throw new Error(`Upload '${job.data.uploadId}' was not found.`);
  }

  if (upload.status === "done" && upload.sessionId) {
    logIngestEvent("info", {
      event: "job_skipped_already_done",
      uploadId: job.data.uploadId,
      jobId: jobId ?? undefined,
      sessionId: upload.sessionId,
    });

    return {
      uploadId: job.data.uploadId,
      sessionId: upload.sessionId,
    };
  }

  try {
    currentStage = "open_duckdb";
    duckDbHandle = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () => openDuckDb(upload.storedPath),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );
    const openHandle = duckDbHandle;

    currentStage = "discover_schema";
    const schema = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () => discoverSchema(openHandle.connection),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );
    const resolvedChannels = resolveChannels(schema);

    currentStage = "extract_raw_signals";
    const extracted = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      async () => ({
        metadata: await readMetadata(
          openHandle.connection,
          resolvedChannels,
          upload.originalFilename,
        ),
        rawSamples: await readSamples(openHandle.connection, resolvedChannels),
      }),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );
    const { metadata, rawSamples } = extracted;

    currentStage = "segment_laps";
    const segmented = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () => segmentLaps(rawSamples),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );

    currentStage = "normalize_distance";
    const normalized = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () => normalizeDistances(segmented),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );

    currentStage = "resample";
    const canonicalLaps = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () => resampleLaps(normalized, config.defaultResamplePoints),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );
    const referenceLapNumber = selectReference(canonicalLaps);

    currentStage = "persist_session";
    const persisted = await runProcessingStage(
      upload.uploadId,
      jobId,
      currentStage,
      () =>
        persistSession({
          metadata,
          laps: canonicalLaps as CanonicalLap[],
          referenceLapNumber,
        }),
      {
        markRunning: moveToRunning,
        markStage: moveToStage,
      },
      stageStarted,
    );

    sessionId = persisted.sessionId;
    await moveToDone(upload.uploadId, persisted.sessionId);

    logIngestEvent("info", {
      event: "job_completed",
      uploadId: upload.uploadId,
      jobId: jobId ?? undefined,
      sessionId,
      stage: "finalize",
    });

    return {
      uploadId: upload.uploadId,
      sessionId: persisted.sessionId,
    };
  } catch (error) {
    const ingestError = toIngestError(error, currentStage);
    const uploadError = mapIngestError(ingestError);

    await moveToError(upload.uploadId, uploadError, ingestError.stage);
    logIngestFailure(
      {
        event: "job_failed",
        uploadId: upload.uploadId,
        jobId: jobId ?? undefined,
        sessionId,
        stage: ingestError.stage,
        errorCode: uploadError.code,
      },
      ingestError,
    );

    throw ingestError;
  } finally {
    if (duckDbHandle) {
      closeDuckDbHandle(duckDbHandle);
    }
  }
}

function createBullWorker(
  queueName: string,
  processor: Processor<IngestJobPayload>,
  options: { connection: ConnectionOptions },
) {
  return new Worker<IngestJobPayload>(queueName, processor, options);
}

export function createIngestWorker(options: CreateIngestWorkerOptions = {}) {
  const config = options.config ?? getAppConfig();

  assertWorkerConfig(config);

  const connection =
    options.connection ??
    (createRedisConnection(config.redisUrl) as unknown as ConnectionOptions);
  const processor = options.processor ?? ((job: Job<IngestJobPayload>) => processIngestJob(job));
  const workerFactory = options.workerFactory ?? createBullWorker;
  const worker = workerFactory(config.ingestQueueName, processor, { connection });

  worker.on("failed", (job: Job<IngestJobPayload> | undefined, error: Error) => {
    logIngestFailure(
      {
        event: "job_failed_unhandled",
        uploadId: job?.data.uploadId,
        jobId: job?.id ? String(job.id) : undefined,
      },
      error,
    );
  });

  return worker;
}

export async function startIngestWorker(options: CreateIngestWorkerOptions = {}) {
  const config = options.config ?? getAppConfig();
  const worker = createIngestWorker({ ...options, config });

  try {
    await worker.waitUntilReady();
  } catch (error) {
    throw new Error(
      `Worker failed to connect to Redis queue ${config.ingestQueueName}: ${getErrorMessage(error)}`,
    );
  }

  logIngestEvent("info", {
    event: "worker_ready",
    stage: "queued",
  });

  return worker;
}
