import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

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
  const formData = new FormData();
  formData.set(
    "file",
    new File([Buffer.from("track-legend-smoke")], "smoke.duckdb", {
      type: "application/octet-stream",
    }),
  );

  const response = await fetch(`${url}/api/uploads`, {
    method: "POST",
    body: formData,
  });

  if (response.status !== 201) {
    throw new Error(`Upload smoke failed with status ${response.status}`);
  }

  return response.json();
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

await waitForHealth(baseUrl);
const upload = await uploadSmokeFile(baseUrl);
await waitForUploadDone(baseUrl, upload.uploadId);

const workerLogs = readWorkerLogs();

if (!workerLogs.includes("Worker ready for queue")) {
  throw new Error("Worker readiness log line was not found.");
}

if (!workerLogs.includes("Completed ingest job")) {
  throw new Error("Worker did not process the smoke upload job.");
}

console.log("Docker smoke check passed.");
