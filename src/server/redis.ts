import IORedis from "ioredis";
import { getAppConfig } from "./config";

declare global {
  var __trackLegendRedis: IORedis | undefined;
}

export function createRedisConnection(redisUrl = getAppConfig().redisUrl) {
  return new IORedis(redisUrl, {
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
  });
}

export function getRedisConnection() {
  globalThis.__trackLegendRedis ??= createRedisConnection();
  return globalThis.__trackLegendRedis;
}

export async function checkRedisHealth(connection = getRedisConnection()) {
  const response = await connection.ping();

  if (response !== "PONG") {
    throw new Error(`Unexpected Redis ping response: ${response}`);
  }
}
