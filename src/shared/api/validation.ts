import { ApiError } from "./errors";

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNullableString(value: unknown): string | null {
  if (value === null) return null;
  return asString(value);
}

export function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

export function invalidResponse(
  code: string,
  message: string,
  details: unknown,
): ApiError {
  return new ApiError({
    status: 500,
    code,
    message,
    details,
  });
}
