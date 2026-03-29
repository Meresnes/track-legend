import { ApiError, notifyApiError } from "./errors";
import { asString, isRecord } from "./validation";

function getStatusMessage(status: number): string {
  if (status === 401) return "Unauthorized request.";
  if (status === 404) return "Requested resource was not found.";
  if (status >= 500) return "Server error. Please try again.";
  return "Request failed.";
}

function extractMessage(payload: unknown, status: number): string {
  if (!isRecord(payload)) return getStatusMessage(status);
  const payloadMessage = asString(payload.message);
  if (payloadMessage && payloadMessage.length > 0) {
    return payloadMessage;
  }
  const payloadError = asString(payload.error);
  if (payloadError && payloadError.length > 0) {
    return payloadError;
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

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, { ...init, headers });
  const payload = await parsePayload(response);

  if (!response.ok) {
    const error = new ApiError({
      status: response.status,
      message: extractMessage(payload, response.status),
      code: isRecord(payload) ? asString(payload.code) ?? undefined : undefined,
      details: payload,
    });

    notifyApiError(error);
    throw error;
  }

  return payload as T;
}
