import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/shared/api";
import { getSessionLaps } from "@/shared/api/sessions";

describe("shared/api sessions parser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses bestLap fields from /sessions/{id}/laps payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionId: "session-1",
            referenceLapId: "lap-2",
            bestLapId: "lap-3",
            bestLapTimeMs: 212345,
            items: [
              {
                lapId: "lap-3",
                lapNumber: 3,
                lapTimeMs: 212345,
                isValid: true,
              },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    const payload = await getSessionLaps("session-1");

    expect(payload).toEqual({
      sessionId: "session-1",
      referenceLapId: "lap-2",
      bestLapId: "lap-3",
      bestLapTimeMs: 212345,
      items: [
        {
          lapId: "lap-3",
          lapNumber: 3,
          lapTimeMs: 212345,
          isValid: true,
        },
      ],
    });
  });

  it("throws ApiError for invalid /sessions/{id}/laps payload shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            sessionId: "session-1",
            referenceLapId: "lap-2",
            bestLapId: "lap-3",
            bestLapTimeMs: 212345,
            items: "invalid",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    await expect(getSessionLaps("session-1")).rejects.toMatchObject<ApiError>({
      code: "SESSION_LAPS_RESPONSE_INVALID",
      message: "Session laps response is invalid.",
      status: 500,
    });
  });
});
