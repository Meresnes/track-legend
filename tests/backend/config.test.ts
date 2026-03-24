import { describe, expect, it } from "vitest";
import { ConfigValidationError, loadAppConfig } from "@/server/config";

const validEnv = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/track_legend?schema=public",
  REDIS_URL: "redis://localhost:6379",
  UPLOAD_DIR: "/tmp/uploads",
  MAX_UPLOAD_MB: "200",
  INGEST_QUEUE_NAME: "telemetry_ingest",
  DEFAULT_RESAMPLE_POINTS: "2000",
};

describe("loadAppConfig", () => {
  it("loads a valid backend configuration", () => {
    const config = loadAppConfig(validEnv);

    expect(config.databaseUrl).toBe(validEnv.DATABASE_URL);
    expect(config.redisUrl).toBe(validEnv.REDIS_URL);
    expect(config.maxUploadBytes).toBe(200 * 1024 * 1024);
  });

  it("fails fast when a required variable is missing", () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        REDIS_URL: "",
      }),
    ).toThrow(ConfigValidationError);
  });

  it("fails when numeric variables are invalid", () => {
    expect(() =>
      loadAppConfig({
        ...validEnv,
        MAX_UPLOAD_MB: "abc",
      }),
    ).toThrow("MAX_UPLOAD_MB must be a positive integer.");
  });
});
