import { describe, expect, it, vi } from "vitest";
import { handleHealthRequest } from "@/server/http/health";

describe("GET /api/health", () => {
  it("returns healthy status when database and redis are available", async () => {
    const response = await handleHealthRequest({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockResolvedValue(undefined),
    });

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        status: "ok",
        dependencies: {
          database: "up",
          redis: "up",
        },
      }),
    );
  });

  it("returns degraded status when a dependency probe fails", async () => {
    const response = await handleHealthRequest({
      checkDatabase: vi.fn().mockRejectedValue(new Error("db offline")),
      checkRedis: vi.fn().mockResolvedValue(undefined),
    });

    expect(response.status).toBe(503);

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        status: "degraded",
        dependencies: {
          database: "down",
          redis: "up",
        },
        errors: [
          {
            dependency: "database",
            message: "db offline",
          },
        ],
      }),
    );
  });
});
