import { describe, expect, it, vi } from "vitest";
import { persistNormalizedSession } from "@/server/ingest/persist";

const sessionDraft = {
  metadata: {
    sourceFilename: "session.duckdb",
    sim: "LMU",
    trackCode: "MONZA_GP",
    carClass: "HYPERCAR_2023",
  },
  laps: [
    {
      lapNumber: 7,
      isValid: true,
      lapTimeMs: 1000,
      distanceM: 1000,
      samples: [
        {
          idx: 0,
          tMs: 0,
          distM: 0,
          speedMs: 40,
          throttle: 0.2,
          brake: 0,
          steering: 0,
          gear: 2,
        },
      ],
    },
    {
      lapNumber: 8,
      isValid: true,
      lapTimeMs: 900,
      distanceM: 1000,
      samples: [
        {
          idx: 0,
          tMs: 0,
          distM: 0,
          speedMs: 41,
          throttle: 0.25,
          brake: 0,
          steering: 0,
          gear: 2,
        },
      ],
    },
  ],
  referenceLapNumber: 8,
} as const;

describe("persistNormalizedSession", () => {
  it("creates session, laps, samples, and stores referenceLapId", async () => {
    const sessionUpdate = vi.fn().mockResolvedValue(undefined);
    const client = {
      $transaction: vi.fn(async (callback) =>
        callback({
          session: {
            create: vi.fn().mockResolvedValue({
              id: "session-1",
            }),
            update: sessionUpdate,
          },
          lap: {
            create: vi
              .fn()
              .mockResolvedValueOnce({ id: "lap-7", lapNumber: 7 })
              .mockResolvedValueOnce({ id: "lap-8", lapNumber: 8 }),
          },
        }),
      ),
      sample: {
        createMany: vi.fn().mockResolvedValue(undefined),
      },
      session: {
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    const result = await persistNormalizedSession(sessionDraft, client as never);

    expect(result).toEqual({
      sessionId: "session-1",
      referenceLapId: "lap-8",
    });
    expect(sessionUpdate).toHaveBeenCalledWith({
      where: {
        id: "session-1",
      },
      data: {
        referenceLapId: "lap-8",
      },
    });
    expect(client.sample.createMany).toHaveBeenCalledTimes(2);
  });

  it("deletes the created session when sample persistence fails", async () => {
    const deleteSession = vi.fn().mockResolvedValue(undefined);
    const client = {
      $transaction: vi.fn(async (callback) =>
        callback({
          session: {
            create: vi.fn().mockResolvedValue({
              id: "session-1",
            }),
            update: vi.fn().mockResolvedValue(undefined),
          },
          lap: {
            create: vi.fn().mockResolvedValue({ id: "lap-7", lapNumber: 7 }),
          },
        }),
      ),
      sample: {
        createMany: vi.fn().mockRejectedValue(new Error("insert failed")),
      },
      session: {
        create: vi.fn(),
        update: vi.fn(),
        delete: deleteSession,
      },
    };

    await expect(persistNormalizedSession(sessionDraft, client as never)).rejects.toThrow(
      "insert failed",
    );
    expect(deleteSession).toHaveBeenCalledWith({
      where: {
        id: "session-1",
      },
    });
  });
});
