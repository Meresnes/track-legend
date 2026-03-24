export type AppConfig = {
  databaseUrl: string;
  redisUrl: string;
  uploadDir: string;
  maxUploadMb: number;
  maxUploadBytes: number;
  ingestQueueName: string;
  defaultResamplePoints: number;
};

export class ConfigValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid backend configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigValidationError";
    this.issues = issues;
  }
}

let cachedConfig: AppConfig | null = null;

function readRequiredString(
  env: NodeJS.ProcessEnv,
  key: string,
  issues: string[],
): string {
  const value = env[key]?.trim();

  if (!value) {
    issues.push(`${key} is required.`);
    return "";
  }

  return value;
}

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  key: string,
  issues: string[],
): number {
  const rawValue = env[key]?.trim();

  if (!rawValue) {
    issues.push(`${key} is required.`);
    return 0;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    issues.push(`${key} must be a positive integer.`);
    return 0;
  }

  return value;
}

function validateUrl(value: string, key: string, issues: string[]) {
  try {
    new URL(value);
  } catch {
    issues.push(`${key} must be a valid URL.`);
  }
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const issues: string[] = [];

  const databaseUrl = readRequiredString(env, "DATABASE_URL", issues);
  const redisUrl = readRequiredString(env, "REDIS_URL", issues);
  const uploadDir = readRequiredString(env, "UPLOAD_DIR", issues);
  const maxUploadMb = readPositiveInteger(env, "MAX_UPLOAD_MB", issues);
  const ingestQueueName = readRequiredString(env, "INGEST_QUEUE_NAME", issues);
  const defaultResamplePoints = readPositiveInteger(
    env,
    "DEFAULT_RESAMPLE_POINTS",
    issues,
  );

  if (databaseUrl) validateUrl(databaseUrl, "DATABASE_URL", issues);
  if (redisUrl) validateUrl(redisUrl, "REDIS_URL", issues);

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    databaseUrl,
    redisUrl,
    uploadDir,
    maxUploadMb,
    maxUploadBytes: maxUploadMb * 1024 * 1024,
    ingestQueueName,
    defaultResamplePoints,
  };
}

export function getAppConfig(): AppConfig {
  cachedConfig ??= loadAppConfig();
  return cachedConfig;
}

export function resetAppConfigCache() {
  cachedConfig = null;
}
