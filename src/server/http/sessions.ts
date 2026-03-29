import {
  getSessionLaps,
  listSessions,
  updateReferenceLap,
  type SessionLapList,
  type SessionListItem,
} from "../data/sessions";
import { ServerError, toErrorResponse } from "../errors";

type HandleSessionsListRequestDeps = {
  listSessions?: () => Promise<SessionListItem[]>;
};

type HandleSessionLapsRequestDeps = {
  getSessionLaps?: (sessionId: string) => Promise<SessionLapList | null>;
};

type HandleReferenceLapRequestDeps = {
  updateReferenceLap?: (
    sessionId: string,
    lapId: string,
  ) => ReturnType<typeof updateReferenceLap>;
};

type ReferenceLapPayload = {
  lapId?: unknown;
};

function parseReferenceLapPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const lapId = (payload as ReferenceLapPayload).lapId;
  if (typeof lapId === "string" && lapId.trim().length > 0) {
    return lapId;
  }
  return null;
}

export async function handleSessionsListRequest(
  deps: HandleSessionsListRequestDeps = {},
) {
  const list = deps.listSessions ?? listSessions;
  const items = await list();

  return Response.json({ items }, { status: 200 });
}

export async function handleSessionLapsRequest(
  sessionId: string,
  deps: HandleSessionLapsRequestDeps = {},
) {
  const getLaps = deps.getSessionLaps ?? getSessionLaps;
  const payload = await getLaps(sessionId);

  if (!payload) {
    return toErrorResponse(
      new ServerError(404, "SESSION_NOT_FOUND", `Session '${sessionId}' was not found.`),
    );
  }

  return Response.json(payload, { status: 200 });
}

export async function handleReferenceLapRequest(
  request: Request,
  sessionId: string,
  deps: HandleReferenceLapRequestDeps = {},
) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return toErrorResponse(
      new ServerError(400, "REFERENCE_LAP_INVALID", "Request body must be valid JSON."),
    );
  }

  const lapId = parseReferenceLapPayload(payload);

  if (!lapId) {
    return toErrorResponse(
      new ServerError(400, "REFERENCE_LAP_INVALID", "Field 'lapId' is required."),
    );
  }

  const update = deps.updateReferenceLap ?? updateReferenceLap;
  const result = await update(sessionId, lapId);

  if (result.status === "session_missing") {
    return toErrorResponse(
      new ServerError(404, "SESSION_NOT_FOUND", `Session '${sessionId}' was not found.`),
    );
  }

  if (result.status === "lap_missing") {
    return toErrorResponse(
      new ServerError(404, "LAP_NOT_FOUND", `Lap '${lapId}' was not found.`),
    );
  }

  if (result.status === "lap_mismatch") {
    return toErrorResponse(
      new ServerError(
        400,
        "LAP_NOT_IN_SESSION",
        `Lap '${lapId}' does not belong to session '${sessionId}'.`,
      ),
    );
  }

  return Response.json(result.data, { status: 200 });
}
