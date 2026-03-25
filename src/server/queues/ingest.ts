import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import { type AppConfig, getAppConfig } from "../config";
import { getRedisConnection } from "../redis";

export const INGEST_JOB_NAME = "upload.ingest";

export type IngestJobPayload = {
  uploadId: string;
};

export type QueueLike = {
  add(
    name: string,
    data: IngestJobPayload,
    opts?: JobsOptions,
  ): Promise<unknown>;
};

declare global {
  var __trackLegendIngestQueue: Queue<IngestJobPayload> | undefined;
}

function getDefaultJobOptions(): JobsOptions {
  return {
    removeOnComplete: 25,
    removeOnFail: 100,
  };
}

export function createIngestQueue(
  config: AppConfig = getAppConfig(),
  connection: ConnectionOptions = getRedisConnection() as unknown as ConnectionOptions,
) {
  return new Queue<IngestJobPayload>(config.ingestQueueName, {
    connection,
    defaultJobOptions: getDefaultJobOptions(),
  });
}

export function getIngestQueue(config: AppConfig = getAppConfig()) {
  globalThis.__trackLegendIngestQueue ??= createIngestQueue(config);
  return globalThis.__trackLegendIngestQueue;
}

export async function enqueueIngestJob(
  queue: QueueLike,
  payload: IngestJobPayload,
) {
  await queue.add(INGEST_JOB_NAME, payload, getDefaultJobOptions());
}

export async function enqueueUploadForIngest(
  payload: IngestJobPayload,
  config: AppConfig = getAppConfig(),
) {
  await enqueueIngestJob(getIngestQueue(config), payload);
}
