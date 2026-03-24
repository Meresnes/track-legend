import { startIngestWorker } from "./ingest-worker";

async function main() {
  const worker = await startIngestWorker();

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });

  process.on("SIGTERM", () => {
    void shutdown();
  });
}

void main().catch((error) => {
  console.error("[worker] Fatal startup error", error);
  process.exit(1);
});
