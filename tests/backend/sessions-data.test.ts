import { describe, expect, it, vi } from "vitest";
import { getSessionLaps } from "@/server/data/sessions";

describe("getSessionLaps", () => {
  it("calculates best lap from valid laps only", async () => {
    const client = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session-1",
          referenceLapId: "lap-3",
        }),
      },
      lap: {
        findMany: vi.fn().mockResolvedValue([
          { id: "lap-1", lapNumber: 1, lapTimeMs: 220000, isValid: true },
          { id: "lap-2", lapNumber: 2, lapTimeMs: 210000, isValid: false },
          { id: "lap-3", lapNumber: 3, lapTimeMs: 215000, isValid: true },
        ]),
      },
    } as const;

    const result = await getSessionLaps("session-1", client as never);

    expect(result).toEqual({
      sessionId: "session-1",
      referenceLapId: "lap-3",
      bestLapId: "lap-3",
      bestLapTimeMs: 215000,
      items: [
        { lapId: "lap-1", lapNumber: 1, lapTimeMs: 220000, isValid: true },
        { lapId: "lap-2", lapNumber: 2, lapTimeMs: 210000, isValid: false },
        { lapId: "lap-3", lapNumber: 3, lapTimeMs: 215000, isValid: true },
      ],
    });
  });

  it("returns null best lap fields when there is no valid lap", async () => {
    const client = {
      session: {
        findUnique: vi.fn().mockResolvedValue({
          id: "session-1",
          referenceLapId: null,
        }),
      },
      lap: {
        findMany: vi.fn().mockResolvedValue([
          { id: "lap-1", lapNumber: 1, lapTimeMs: 220000, isValid: false },
          { id: "lap-2", lapNumber: 2, lapTimeMs: null, isValid: false },
        ]),
      },
    } as const;

    const result = await getSessionLaps("session-1", client as never);

    expect(result).toEqual({
      sessionId: "session-1",
      referenceLapId: null,
      bestLapId: null,
      bestLapTimeMs: null,
      items: [
        { lapId: "lap-1", lapNumber: 1, lapTimeMs: 220000, isValid: false },
        { lapId: "lap-2", lapNumber: 2, lapTimeMs: null, isValid: false },
      ],
    });
  });
});
