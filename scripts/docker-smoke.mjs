import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { DuckDBInstance } from "@duckdb/node-api";

function readEnvFile() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return {};

  const raw = readFileSync(envPath, "utf8");
  const values = {};

  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

const env = readEnvFile();
const frontendPort = process.env.FE_PORT ?? env.FE_PORT ?? "3000";
const baseUrl = process.env.SMOKE_BASE_URL ?? `http://localhost:${frontendPort}`;

async function waitForHealth(url, timeoutMs = 90_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {}

    await delay(2_000);
  }

  throw new Error(`Timed out waiting for ${url}/api/health`);
}

async function uploadSmokeFile(url) {
  const fixture = await createSmokeDuckDb();
  const formData = new FormData();
  formData.set(
    "file",
    new File([await readFile(fixture.filePath)], "smoke.duckdb", {
      type: "application/octet-stream",
    }),
  );

  try {
    const response = await fetch(`${url}/api/uploads`, {
      method: "POST",
      body: formData,
    });

    if (response.status !== 201) {
      throw new Error(`Upload smoke failed with status ${response.status}`);
    }

    return response.json();
  } finally {
    await fixture.cleanup();
  }
}

async function waitForUploadDone(url, uploadId, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${url}/api/uploads/${uploadId}`);

    if (!response.ok) {
      throw new Error(`Upload status failed with status ${response.status}`);
    }

    const body = await response.json();

    if (body.status === "done") {
      if (!body.sessionId) {
        throw new Error("Upload completed without sessionId.");
      }

      return body;
    }

    if (body.status === "error") {
      const message =
        body?.error?.message ?? "Upload moved to error state during docker smoke.";
      throw new Error(message);
    }

    await delay(2_000);
  }

  throw new Error(`Timed out waiting for upload ${uploadId} to finish.`);
}

function readWorkerLogs() {
  return execSync("docker compose logs worker --tail 100", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function createSmokeDuckDb() {
  const tempDir = await mkdtemp(join(tmpdir(), "track-legend-smoke-"));
  const filePath = join(tempDir, "smoke.duckdb");
  const instance = await DuckDBInstance.create(filePath);
  const connection = await instance.connect();

  try {
    await connection.run(`
      CREATE TABLE session_meta (
        track_code VARCHAR,
        car_class VARCHAR
      )
    `);
    await connection.run(`
      INSERT INTO session_meta VALUES ('MONZA_GP', 'HYPERCAR_2023')
    `);
    await connection.run(`
      CREATE TABLE telemetry_samples (
        sample_time_ms INTEGER,
        lap_number INTEGER,
        lap_distance_m DOUBLE,
        speed_kph DOUBLE,
        throttle_pct DOUBLE,
        brake_pct DOUBLE,
        steering_deg DOUBLE,
        gear INTEGER
      )
    `);
    await connection.run(`
      INSERT INTO telemetry_samples VALUES
        (0, 1, 0, 144, 0, 0, 0.02, 2),
        (1000, 1, 250, 162, 35, 0, 0.08, 3),
        (2000, 1, 500, 180, 70, 0, 0.12, 4),
        (3000, 1, 750, 170, 40, 15, 0.16, 4),
        (4000, 1, 1000, 150, 20, 35, 0.10, 3),
        (4500, 2, 0, 146, 0, 0, 0.01, 2),
        (5400, 2, 250, 166, 38, 0, 0.06, 3),
        (6300, 2, 500, 184, 76, 0, 0.11, 4),
        (7200, 2, 740, 176, 46, 8, 0.14, 4),
        (8100, 2, 1005, 154, 22, 24, 0.09, 3)
    `);
  } finally {
    connection.closeSync();
    instance.closeSync();
  }

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}

await waitForHealth(baseUrl);
const upload = await uploadSmokeFile(baseUrl);
await waitForUploadDone(baseUrl, upload.uploadId);

const workerLogs = readWorkerLogs();

if (!workerLogs.includes("\"event\":\"worker_ready\"")) {
  throw new Error("Worker readiness log line was not found.");
}

if (!workerLogs.includes("\"event\":\"job_completed\"")) {
  throw new Error("Worker did not process the smoke upload job.");
}

console.log("Docker smoke check passed.");
