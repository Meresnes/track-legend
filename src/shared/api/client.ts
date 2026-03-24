import { ApiError, notifyApiError } from "./errors";

type JsonLike = Record<string, unknown>;

function getStatusMessage(status: number): string {
  if (status === 401) return "Unauthorized request.";
  if (status === 404) return "Requested resource was not found.";
  if (status >= 500) return "Server error. Please try again.";
  return "Request failed.";
}

function isObject(value: unknown): value is JsonLike {
  return typeof value === "object" && value !== null;
}

function extractMessage(payload: unknown, status: number): string {
  if (!isObject(payload)) return getStatusMessage(status);
  if (typeof payload.message === "string" && payload.message.length > 0) {
    return payload.message;
  }
  if (typeof payload.error === "string" && payload.error.length > 0) {
    return payload.error;
  }
  return getStatusMessage(status);
}

async function parsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? { message: text } : undefined;
}

export async function apiClient<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });
  const payload = await parsePayload(response);

  if (!response.ok) {
    const error = new ApiError({
      status: response.status,
      message: extractMessage(payload, response.status),
      code: isObject(payload) && typeof payload.code === "string" ? payload.code : undefined,
      details: payload,
    });

    notifyApiError(error);
    throw error;
  }

  return payload as T;
}
