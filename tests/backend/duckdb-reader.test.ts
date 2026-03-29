import { afterEach, describe, expect, it } from "vitest";
import {
  closeDuckDb,
  discoverDuckDbSchema,
  openReadOnlyDuckDb,
  readSessionMetadata,
  readTelemetrySamples,
  resolveTelemetryChannels,
} from "@/server/ingest/duckdb";
import { MissingChannelsError } from "@/server/ingest/errors";
import { createDuckDbFixture } from "./helpers/duckdb-fixture";

const cleanupFns: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupFns.length > 0) {
    const cleanup = cleanupFns.pop();
    await cleanup?.();
  }
});

describe("DuckDB reader", () => {
  it("discovers tables, resolves channels, and reads telemetry samples", async () => {
    const fixture = await createDuckDbFixture({ format: "wide_table" });
    cleanupFns.push(fixture.cleanup);
    const handle = await openReadOnlyDuckDb(fixture.filePath);

    try {
      const schema = await discoverDuckDbSchema(handle.connection);
      const channels = resolveTelemetryChannels(schema);
      const metadata = await readSessionMetadata(
        handle.connection,
        channels,
        "session.duckdb",
      );
      const samples = await readTelemetrySamples(handle.connection, channels);

      expect(schema.tables.map((table) => table.tableName)).toEqual([
        "session_meta",
        "telemetry_samples",
      ]);
      expect(channels.format).toBe("wide_table");
      expect(channels.telemetryTable).toBe("telemetry_samples");
      expect(metadata).toEqual({
        sourceFilename: "session.duckdb",
        sim: "LMU",
        trackCode: "MONZA_GP",
        carClass: "HYPERCAR_2023",
      });
      expect(samples).toHaveLength(10);
      expect(samples[0]).toMatchObject({
        ts: 0,
        lapNumber: 1,
        lapDistM: 0,
        throttle: 0,
        brake: 0,
        gear: 2,
      });
      expect(samples[2]?.speedMs).toBeCloseTo(50, 4);
    } finally {
      closeDuckDb(handle);
    }
  });

  it("supports LMU channel-per-table exports and metadata key/value", async () => {
    const fixture = await createDuckDbFixture({ format: "channel_tables" });
    cleanupFns.push(fixture.cleanup);
    const handle = await openReadOnlyDuckDb(fixture.filePath);

    try {
      const schema = await discoverDuckDbSchema(handle.connection);
      const channels = resolveTelemetryChannels(schema);
      const metadata = await readSessionMetadata(
        handle.connection,
        channels,
        "session.duckdb",
      );
      const samples = await readTelemetrySamples(handle.connection, channels);

      expect(channels.format).toBe("channel_tables");
      expect(channels.telemetryTable).toBeNull();
      expect(channels.timestamp).toEqual({
        tableName: "GPS Time",
        columnName: "value",
      });
      expect(metadata).toEqual({
        sourceFilename: "session.duckdb",
        sim: "LMU",
        trackCode: "MONZA_GP",
        carClass: "GT3",
      });
      expect(samples.length).toBeGreaterThan(100);
      expect(samples[0]).toMatchObject({
        lapDistM: 0,
      });
      expect(samples.some((sample) => sample.lapNumber === 2)).toBe(true);
      expect(samples.some((sample) => sample.gear === 4)).toBe(true);
    } finally {
      closeDuckDb(handle);
    }
  });

  it("fails with MissingChannelsError when a required channel is absent", async () => {
    const fixture = await createDuckDbFixture({ format: "wide_table", includeBrake: false });
    cleanupFns.push(fixture.cleanup);
    const handle = await openReadOnlyDuckDb(fixture.filePath);

    try {
      const schema = await discoverDuckDbSchema(handle.connection);

      expect(() => resolveTelemetryChannels(schema)).toThrow(MissingChannelsError);
      expect(() => resolveTelemetryChannels(schema)).toThrow(
        "Required channels are missing: brake.",
      );
    } finally {
      closeDuckDb(handle);
    }
  });

  it("fails with MissingChannelsError for channel table format when brake channel is absent", async () => {
    const fixture = await createDuckDbFixture({
      format: "channel_tables",
      includeBrake: false,
    });
    cleanupFns.push(fixture.cleanup);
    const handle = await openReadOnlyDuckDb(fixture.filePath);

    try {
      const schema = await discoverDuckDbSchema(handle.connection);

      expect(() => resolveTelemetryChannels(schema)).toThrow(MissingChannelsError);
      expect(() => resolveTelemetryChannels(schema)).toThrow(
        "Required channels are missing: brake.",
      );
    } finally {
      closeDuckDb(handle);
    }
  });
});
