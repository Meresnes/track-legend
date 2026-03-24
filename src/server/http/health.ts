import { checkDatabaseHealth } from "../prisma";
import { checkRedisHealth } from "../redis";
import { getErrorMessage } from "../errors";

type HealthDeps = {
  checkDatabase?: () => Promise<void>;
  checkRedis?: () => Promise<void>;
};

type DependencyStatus = "up" | "down";

export async function getHealthSnapshot(deps: HealthDeps = {}) {
  const databaseCheck = deps.checkDatabase ?? checkDatabaseHealth;
  const redisCheck = deps.checkRedis ?? checkRedisHealth;

  const dependencies: Record<string, DependencyStatus> = {
    database: "up",
    redis: "up",
  };

  const errors: Array<{ dependency: string; message: string }> = [];

  try {
    await databaseCheck();
  } catch (error) {
    dependencies.database = "down";
    errors.push({
      dependency: "database",
      message: getErrorMessage(error),
    });
  }

  try {
    await redisCheck();
  } catch (error) {
    dependencies.redis = "down";
    errors.push({
      dependency: "redis",
      message: getErrorMessage(error),
    });
  }

  const ok = errors.length === 0;

  return {
    status: ok ? "ok" : "degraded",
    dependencies,
    errors,
    timestamp: new Date().toISOString(),
  };
}

export async function handleHealthRequest(deps: HealthDeps = {}) {
  const snapshot = await getHealthSnapshot(deps);

  return Response.json(snapshot, {
    status: snapshot.status === "ok" ? 200 : 503,
  });
}
