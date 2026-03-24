import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AppConfig } from "@/server/config";
import { deleteUpload, getUploadPath, saveUpload } from "@/server/storage/upload-storage";

const createdDirs: string[] = [];

function createConfig(uploadDir: string): AppConfig {
  return {
    databaseUrl: "postgresql://postgres:postgres@localhost:5432/track_legend?schema=public",
    redisUrl: "redis://localhost:6379",
    uploadDir,
    maxUploadMb: 1,
    maxUploadBytes: 1024 * 1024,
    ingestQueueName: "telemetry_ingest",
    defaultResamplePoints: 2000,
  };
}

async function createTempConfig() {
  const uploadDir = await mkdtemp(join(tmpdir(), "track-legend-upload-"));
  createdDirs.push(uploadDir);
  return createConfig(uploadDir);
}

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map(async (dir) => {
      await deleteUpload("sample", createConfig(dir)).catch(() => undefined);
    }),
  );
});

describe("upload storage", () => {
  it("saves a .duckdb upload into the configured directory", async () => {
    const config = await createTempConfig();
    const outputPath = await saveUpload(
      new File([Buffer.from("telemetry")], "session.duckdb"),
      "sample",
      config,
    );

    const stored = await readFile(outputPath, "utf8");

    expect(stored).toBe("telemetry");
  });

  it("returns a stable upload path for a given upload id", async () => {
    const config = await createTempConfig();

    expect(getUploadPath("sample", config)).toBe(join(config.uploadDir, "sample.duckdb"));
  });

  it("deletes a saved upload", async () => {
    const config = await createTempConfig();
    await saveUpload(new File([Buffer.from("telemetry")], "session.duckdb"), "sample", config);

    await deleteUpload("sample", config);

    await expect(stat(getUploadPath("sample", config))).rejects.toThrow();
  });

  it("rejects unsupported file extensions", async () => {
    const config = await createTempConfig();

    await expect(
      saveUpload(new File([Buffer.from("telemetry")], "session.txt"), "sample", config),
    ).rejects.toThrow("Only .duckdb uploads are supported.");
  });

  it("rejects empty uploads", async () => {
    const config = await createTempConfig();

    await expect(
      saveUpload(new File([Buffer.from("")], "session.duckdb"), "sample", config),
    ).rejects.toThrow("Uploaded file is empty.");
  });
});
