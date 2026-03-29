import { describe, expect, it } from "vitest";
import {
  handleReferenceLapRequest,
  handleSessionLapsRequest,
  handleSessionsListRequest,
} from "@/server/http/sessions";

describe("GET /api/sessions", () => {
  it("returns session list payload", async () => {
    const response = await handleSessionsListRequest({
      listSessions: async () => [
        {
          sessionId: "session-1",
          createdAt: new Date("2026-03-21T10:00:00.000Z"),
          sim: "LMU",
          trackCode: "MONZA",
          carClass: "HYPERCAR",
          lapsCount: 12,
          bestLapTimeMs: 212345,
          referenceLapId: "lap-1",
        },
      ],
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          sessionId: "session-1",
          createdAt: "2026-03-21T10:00:00.000Z",
          sim: "LMU",
          trackCode: "MONZA",
          carClass: "HYPERCAR",
          lapsCount: 12,
          bestLapTimeMs: 212345,
          referenceLapId: "lap-1",
        },
      ],
    });
  });
});

describe("GET /api/sessions/:sessionId/laps", () => {
  it("returns 404 when session is missing", async () => {
    const response = await handleSessionLapsRequest("missing-session", {
      getSessionLaps: async () => null,
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "SESSION_NOT_FOUND",
      message: "Session 'missing-session' was not found.",
    });
  });

  it("returns lap list payload", async () => {
    const response = await handleSessionLapsRequest("session-1", {
      getSessionLaps: async () => ({
        sessionId: "session-1",
        referenceLapId: "lap-2",
        bestLapId: "lap-1",
        bestLapTimeMs: 213000,
        items: [
          {
            lapId: "lap-1",
            lapNumber: 1,
            lapTimeMs: 213000,
            isValid: true,
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-1",
      referenceLapId: "lap-2",
      bestLapId: "lap-1",
      bestLapTimeMs: 213000,
      items: [
        {
          lapId: "lap-1",
          lapNumber: 1,
          lapTimeMs: 213000,
          isValid: true,
        },
      ],
    });
  });

  it("returns null best-lap fields when no valid laps exist", async () => {
    const response = await handleSessionLapsRequest("session-1", {
      getSessionLaps: async () => ({
        sessionId: "session-1",
        referenceLapId: null,
        bestLapId: null,
        bestLapTimeMs: null,
        items: [
          {
            lapId: "lap-1",
            lapNumber: 1,
            lapTimeMs: 220000,
            isValid: false,
          },
        ],
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-1",
      referenceLapId: null,
      bestLapId: null,
      bestLapTimeMs: null,
      items: [
        {
          lapId: "lap-1",
          lapNumber: 1,
          lapTimeMs: 220000,
          isValid: false,
        },
      ],
    });
  });
});

describe("POST /api/sessions/:sessionId/reference", () => {
  it("validates request body", async () => {
    const response = await handleReferenceLapRequest(
      new Request("http://localhost/api/sessions/session-1/reference", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      "session-1",
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "REFERENCE_LAP_INVALID",
      message: "Field 'lapId' is required.",
    });
  });

  it("returns 404 when session is missing", async () => {
    const response = await handleReferenceLapRequest(
      new Request("http://localhost/api/sessions/session-1/reference", {
        method: "POST",
        body: JSON.stringify({ lapId: "lap-1" }),
      }),
      "session-1",
      {
        updateReferenceLap: async () => ({ status: "session_missing" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "SESSION_NOT_FOUND",
      message: "Session 'session-1' was not found.",
    });
  });

  it("returns 404 when lap is missing", async () => {
    const response = await handleReferenceLapRequest(
      new Request("http://localhost/api/sessions/session-1/reference", {
        method: "POST",
        body: JSON.stringify({ lapId: "lap-1" }),
      }),
      "session-1",
      {
        updateReferenceLap: async () => ({ status: "lap_missing" }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "LAP_NOT_FOUND",
      message: "Lap 'lap-1' was not found.",
    });
  });

  it("returns 400 when lap does not belong to session", async () => {
    const response = await handleReferenceLapRequest(
      new Request("http://localhost/api/sessions/session-1/reference", {
        method: "POST",
        body: JSON.stringify({ lapId: "lap-1" }),
      }),
      "session-1",
      {
        updateReferenceLap: async () => ({ status: "lap_mismatch" }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "LAP_NOT_IN_SESSION",
      message: "Lap 'lap-1' does not belong to session 'session-1'.",
    });
  });

  it("returns updated reference lap", async () => {
    const response = await handleReferenceLapRequest(
      new Request("http://localhost/api/sessions/session-1/reference", {
        method: "POST",
        body: JSON.stringify({ lapId: "lap-1" }),
      }),
      "session-1",
      {
        updateReferenceLap: async () => ({
          status: "ok",
          data: {
            sessionId: "session-1",
            referenceLapId: "lap-1",
          },
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sessionId: "session-1",
      referenceLapId: "lap-1",
    });
  });
});
