import { PrismaClient } from "@prisma/client";
import { getAppConfig } from "./config";

declare global {
  var __trackLegendPrisma: PrismaClient | undefined;
}

export function createPrismaClient(databaseUrl = getAppConfig().databaseUrl) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
}

export function getPrismaClient() {
  globalThis.__trackLegendPrisma ??= createPrismaClient();
  return globalThis.__trackLegendPrisma;
}

export async function checkDatabaseHealth(client = getPrismaClient()) {
  await client.$queryRawUnsafe("SELECT 1");
}
