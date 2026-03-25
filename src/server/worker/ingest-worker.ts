import { Worker, type ConnectionOptions, type Job, type Processor } from "bullmq";
import { type AppConfig, getAppConfig } from "../config";
import {
  createSessionForUpload,
  getUploadForProcessing,
  markUploadDone,
  markUploadError,
  markUploadRunning,
  type UploadErrorPayload,
} from "../data/uploads";
import { getErrorMessage } from "../errors";
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
  getUpload?: typeof getUploadForProcessing;
  markRunning?: typeof markUploadRunning;
  createSession?: typeof createSessionForUpload;
  markDone?: typeof markUploadDone;
  markError?: typeof markUploadError;
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
  return {
    code: "INTERNAL_INGEST_ERROR",
    message: getErrorMessage(error),
  };
}

export async function processIngestJob(
  job: Pick<Job<IngestJobPayload>, "id" | "data">,
  deps: ProcessIngestJobDeps = {},
) {
  const readUpload = deps.getUpload ?? getUploadForProcessing;
  const moveToRunning = deps.markRunning ?? markUploadRunning;
  const createSession = deps.createSession ?? createSessionForUpload;
  const moveToDone = deps.markDone ?? markUploadDone;
  const moveToError = deps.markError ?? markUploadError;

  console.info(
    `[worker] Processing ingest job ${job.id ?? "unknown"} for upload ${job.data.uploadId}`,
  );

  const upload = await readUpload(job.data.uploadId);

  if (!upload) {
    throw new Error(`Upload '${job.data.uploadId}' was not found.`);
  }

  if (upload.status === "done" && upload.sessionId) {
    return {
      uploadId: job.data.uploadId,
      sessionId: upload.sessionId,
    };
  }

  await moveToRunning(job.data.uploadId);

  try {
    const session = await createSession(upload.originalFilename);
    await moveToDone(job.data.uploadId, session.id);

    console.info(
      `[worker] Completed ingest job ${job.id ?? "unknown"} for upload ${job.data.uploadId}`,
    );

    return {
      uploadId: job.data.uploadId,
      sessionId: session.id,
    };
  } catch (error) {
    const uploadError = mapIngestError(error);
    await moveToError(job.data.uploadId, uploadError);
    throw error;
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
    console.error(
      `[worker] Failed ingest job ${job?.id ?? "unknown"}: ${getErrorMessage(error)}`,
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

  console.info(`[worker] Worker ready for queue ${config.ingestQueueName}`);

  return worker;
}
