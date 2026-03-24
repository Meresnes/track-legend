import { execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const frontendPort = process.env.FE_PORT ?? "3000";
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

  if (response.status !== 202) {
    throw new Error(`Upload smoke failed with status ${response.status}`);
  }

  return response.json();
}

function readWorkerLogs() {
  return execSync("docker compose logs worker --tail 100", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

await waitForHealth(baseUrl);
await uploadSmokeFile(baseUrl);
await delay(3_000);

const workerLogs = readWorkerLogs();

if (!workerLogs.includes("Worker ready for queue")) {
  throw new Error("Worker readiness log line was not found.");
}

if (!workerLogs.includes("Completed ingest job")) {
  throw new Error("Worker did not process the smoke upload job.");
}

console.log("Docker smoke check passed.");
