import { apiClient } from "./client";
import {
  asArray,
  asBoolean,
  asNullableString,
  asNumber,
  asString,
  invalidResponse,
  isRecord,
} from "./validation";

export type SessionListItem = {
  sessionId: string;
  createdAt: string;
  sim: string;
  trackCode: string;
  carClass: string;
  lapsCount: number;
  bestLapTimeMs: number | null;
  referenceLapId: string | null;
};

export type SessionListResponse = {
  items: SessionListItem[];
};

export type LapListItem = {
  lapId: string;
  lapNumber: number;
  lapTimeMs: number | null;
  isValid: boolean;
};

export type SessionLapListResponse = {
  sessionId: string;
  referenceLapId: string | null;
  bestLapId: string | null;
  bestLapTimeMs: number | null;
  items: LapListItem[];
};

export type ReferenceLapUpdateResponse = {
  sessionId: string;
  referenceLapId: string | null;
};

function parseSessionListResponse(payload: unknown): SessionListResponse {
  if (!isRecord(payload)) {
    throw invalidResponse(
      "SESSIONS_RESPONSE_INVALID",
      "Sessions response is invalid.",
      payload,
    );
  }

  const rawItems = asArray(payload.items);
  if (!rawItems) {
    throw invalidResponse(
      "SESSIONS_RESPONSE_INVALID",
      "Sessions response is invalid.",
      payload,
    );
  }

  const items = rawItems.map((item) => {
    if (!isRecord(item)) {
      throw invalidResponse(
        "SESSIONS_RESPONSE_INVALID",
        "Sessions response is invalid.",
        payload,
      );
    }

    const sessionId = asString(item.sessionId);
    const createdAt = asString(item.createdAt);
    const sim = asString(item.sim);
    const trackCode = asString(item.trackCode);
    const carClass = asString(item.carClass);
    const lapsCount = asNumber(item.lapsCount);
    if (
      sessionId === null ||
      createdAt === null ||
      sim === null ||
      trackCode === null ||
      carClass === null ||
      lapsCount === null
    ) {
      throw invalidResponse(
        "SESSIONS_RESPONSE_INVALID",
        "Sessions response is invalid.",
        payload,
      );
    }

    return {
      sessionId,
      createdAt,
      sim,
      trackCode,
      carClass,
      lapsCount,
      bestLapTimeMs: asNumber(item.bestLapTimeMs),
      referenceLapId: asNullableString(item.referenceLapId),
    } satisfies SessionListItem;
  });

  return { items };
}

function parseSessionLapsResponse(payload: unknown): SessionLapListResponse {
  if (!isRecord(payload)) {
    throw invalidResponse(
      "SESSION_LAPS_RESPONSE_INVALID",
      "Session laps response is invalid.",
      payload,
    );
  }

  const sessionId = asString(payload.sessionId);
  const referenceLapId = asNullableString(payload.referenceLapId);
  const bestLapId = asNullableString(payload.bestLapId);
  const bestLapTimeMs = asNumber(payload.bestLapTimeMs);
  const rawItems = asArray(payload.items);

  if (sessionId === null || rawItems === null) {
    throw invalidResponse(
      "SESSION_LAPS_RESPONSE_INVALID",
      "Session laps response is invalid.",
      payload,
    );
  }

  const items = rawItems.map((item) => {
    if (!isRecord(item)) {
      throw invalidResponse(
        "SESSION_LAPS_RESPONSE_INVALID",
        "Session laps response is invalid.",
        payload,
      );
    }

    const lapId = asString(item.lapId);
    const lapNumber = asNumber(item.lapNumber);
    const isValid = asBoolean(item.isValid);
    if (
      lapId === null ||
      lapNumber === null ||
      isValid === null
    ) {
      throw invalidResponse(
        "SESSION_LAPS_RESPONSE_INVALID",
        "Session laps response is invalid.",
        payload,
      );
    }

    return {
      lapId,
      lapNumber,
      lapTimeMs: asNumber(item.lapTimeMs),
      isValid,
    } satisfies LapListItem;
  });

  return {
    sessionId,
    referenceLapId,
    bestLapId,
    bestLapTimeMs,
    items,
  };
}

function parseReferenceLapResponse(payload: unknown): ReferenceLapUpdateResponse {
  if (!isRecord(payload)) {
    throw invalidResponse(
      "REFERENCE_LAP_RESPONSE_INVALID",
      "Reference lap response is invalid.",
      payload,
    );
  }

  const sessionId = asString(payload.sessionId);
  const referenceLapId = asNullableString(payload.referenceLapId);

  if (sessionId === null) {
    throw invalidResponse(
      "REFERENCE_LAP_RESPONSE_INVALID",
      "Reference lap response is invalid.",
      payload,
    );
  }

  return {
    sessionId,
    referenceLapId,
  };
}

export async function getSessions() {
  const payload = await apiClient<unknown>("/api/sessions");
  return parseSessionListResponse(payload);
}

export async function getSessionLaps(sessionId: string) {
  const payload = await apiClient<unknown>(`/api/sessions/${sessionId}/laps`);
  return parseSessionLapsResponse(payload);
}

export async function setReferenceLap(sessionId: string, lapId: string) {
  const payload = await apiClient<unknown>(`/api/sessions/${sessionId}/reference`, {
    method: "POST",
    body: JSON.stringify({ lapId }),
  });
  return parseReferenceLapResponse(payload);
}
