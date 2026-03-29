import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import {
  DuckDbReadError,
  MissingChannelsError,
  UnsupportedFileError,
} from "./errors";
import {
  type DiscoveredDuckDbColumn,
  type DiscoveredDuckDbSchema,
  type DiscoveredDuckDbTable,
  type LogicalChannel,
  type RawSample,
  type ResolvedChannelTable,
  type ResolvedDuckDbColumn,
  type ResolvedMetadataTable,
  type ResolvedTelemetryChannels,
  type SessionMetadata,
} from "./types";

const unknownTrackCode = "UNKNOWN_TRACK";
const unknownCarClass = "UNKNOWN_CLASS";

const columnAliases = {
  timestamp: ["ts", "timestamp", "sampletime", "sampletimems", "timems", "elapsedtimems"],
  lapNumber: ["lap", "lapnumber", "lapnum"],
  lapDistM: ["lapdistm", "lapdistance", "lapdist", "lapdistancem", "distancem"],
  speedMs: ["speedms", "speedmps"],
  speedKph: ["speedkph", "speedkmh", "speed"],
  throttle: ["throttle", "throttlepct", "throttlepercent"],
  brake: ["brake", "brakepct", "brakepercent", "brakepressure"],
  steering: ["steering", "steeringdeg", "steer", "steerangle"],
  gear: ["gear", "gearindex"],
  trackCode: ["trackcode", "track", "trackname"],
  carClass: ["carclass", "class", "vehicleclass"],
  key: ["key"],
  value: ["value"],
} satisfies Record<string, string[]>;

const channelTableAliases = {
  timestamp: ["gpstime"],
  lapNumber: ["lap"],
  lapDistM: ["lapdist"],
  speedKph: ["groundspeed"],
  speedMs: ["gpsspeed"],
  throttle: ["throttlepos"],
  brake: ["brakepos"],
  steering: ["steeringpos"],
  gear: ["gear"],
  metadata: ["metadata"],
} satisfies Record<string, string[]>;

const trackCodeMetadataKeys = ["trackcode"];
const trackLayoutMetadataKeys = ["tracklayout"];
const trackNameMetadataKeys = ["trackname"];
const carClassMetadataKeys = ["carclass", "class", "vehicleclass"];

type OpenDuckDbHandle = {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
};

type TimedValue = {
  ts: number;
  value: number;
};

function normalizeIdentifier(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function findColumnByAliases(
  columns: DiscoveredDuckDbColumn[],
  aliases: string[],
) {
  const aliasSet = new Set(aliases.map(normalizeIdentifier));
  return columns.find((column) => aliasSet.has(column.normalizedName)) ?? null;
}

function findTableByAliases(
  schema: DiscoveredDuckDbSchema,
  aliases: string[],
) {
  const aliasSet = new Set(aliases.map(normalizeIdentifier));
  return schema.tables.find((table) => aliasSet.has(table.normalizedName)) ?? null;
}

function toResolvedColumn(column: DiscoveredDuckDbColumn | null): ResolvedDuckDbColumn | null {
  if (!column) return null;

  return {
    tableName: column.tableName,
    columnName: column.columnName,
  };
}

function toResolvedChannelTable(table: DiscoveredDuckDbTable): ResolvedChannelTable | null {
  const valueColumn = findColumnByAliases(table.columns, columnAliases.value);
  if (!valueColumn) return null;

  const tsColumn = findColumnByAliases(table.columns, columnAliases.timestamp);

  return {
    tableName: table.tableName,
    valueColumn: valueColumn.columnName,
    tsColumn: tsColumn?.columnName ?? null,
  };
}

function toResolvedMetadataTable(table: DiscoveredDuckDbTable): ResolvedMetadataTable | null {
  const keyColumn = findColumnByAliases(table.columns, columnAliases.key);
  const valueColumn = findColumnByAliases(table.columns, columnAliases.value);

  if (!keyColumn || !valueColumn) return null;

  return {
    tableName: table.tableName,
    keyColumn: keyColumn.columnName,
    valueColumn: valueColumn.columnName,
  };
}

function coerceNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceNullableNumber(value: unknown) {
  return value == null ? null : coerceNumber(value);
}

function coercePercent(value: number | null) {
  if (value == null) return null;
  if (value > 1) return value / 100;
  if (value < 0) return 0;
  return value;
}

function coerceString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function resolveWideTableChannels(schema: DiscoveredDuckDbSchema) {
  const candidates = schema.tables.map((table) => {
    const timestamp = findColumnByAliases(table.columns, columnAliases.timestamp);
    const lapNumber = findColumnByAliases(table.columns, columnAliases.lapNumber);
    const lapDistM = findColumnByAliases(table.columns, columnAliases.lapDistM);
    const speedMs = findColumnByAliases(table.columns, columnAliases.speedMs);
    const speedKph = findColumnByAliases(table.columns, columnAliases.speedKph);
    const throttle = findColumnByAliases(table.columns, columnAliases.throttle);
    const brake = findColumnByAliases(table.columns, columnAliases.brake);
    const steering = findColumnByAliases(table.columns, columnAliases.steering);
    const gear = findColumnByAliases(table.columns, columnAliases.gear);

    const requiredMatches = [
      timestamp,
      lapDistM,
      speedMs ?? speedKph,
      throttle,
      brake,
      steering,
    ].filter(Boolean).length;
    const optionalMatches = [lapNumber, gear].filter(Boolean).length;

    return {
      table,
      timestamp,
      lapNumber,
      lapDistM,
      speedMs,
      speedKph,
      throttle,
      brake,
      steering,
      gear,
      score: requiredMatches * 10 + optionalMatches,
    };
  });

  const best = [...candidates].sort((left, right) => right.score - left.score)[0];
  if (!best) {
    return {
      channels: null,
      missingChannels: [
        "timestamp",
        "lapDistM",
        "speed",
        "throttle",
        "brake",
        "steering",
      ] as LogicalChannel[],
    };
  }

  const missingChannels: LogicalChannel[] = [];
  if (!best.timestamp) missingChannels.push("timestamp");
  if (!best.lapDistM) missingChannels.push("lapDistM");
  if (!best.speedMs && !best.speedKph) missingChannels.push("speed");
  if (!best.throttle) missingChannels.push("throttle");
  if (!best.brake) missingChannels.push("brake");
  if (!best.steering) missingChannels.push("steering");

  if (missingChannels.length > 0) {
    return { channels: null, missingChannels };
  }

  const allColumns = schema.tables.flatMap((table) => table.columns);
  const trackCode =
    findColumnByAliases(best.table.columns, columnAliases.trackCode) ??
    allColumns.find((column) =>
      columnAliases.trackCode.map(normalizeIdentifier).includes(column.normalizedName),
    ) ??
    null;
  const carClass =
    findColumnByAliases(best.table.columns, columnAliases.carClass) ??
    allColumns.find((column) =>
      columnAliases.carClass.map(normalizeIdentifier).includes(column.normalizedName),
    ) ??
    null;

  return {
    channels: {
      format: "wide_table",
      telemetryTable: best.table.tableName,
      timestamp: toResolvedColumn(best.timestamp)!,
      lapNumber: toResolvedColumn(best.lapNumber),
      lapDistM: toResolvedColumn(best.lapDistM)!,
      speedMs: toResolvedColumn(best.speedMs),
      speedKph: toResolvedColumn(best.speedKph),
      throttle: toResolvedColumn(best.throttle)!,
      brake: toResolvedColumn(best.brake)!,
      steering: toResolvedColumn(best.steering)!,
      gear: toResolvedColumn(best.gear),
      trackCode: toResolvedColumn(trackCode),
      carClass: toResolvedColumn(carClass),
      metadataTable: null,
      channelTables: null,
    } satisfies ResolvedTelemetryChannels,
    missingChannels: [] as LogicalChannel[],
  };
}

function resolveChannelTableChannels(schema: DiscoveredDuckDbSchema) {
  const timestampTable = findTableByAliases(schema, channelTableAliases.timestamp);
  const lapDistTable = findTableByAliases(schema, channelTableAliases.lapDistM);
  const speedKphTable = findTableByAliases(schema, channelTableAliases.speedKph);
  const speedMsTable = speedKphTable
    ? null
    : findTableByAliases(schema, channelTableAliases.speedMs);
  const throttleTable = findTableByAliases(schema, channelTableAliases.throttle);
  const brakeTable = findTableByAliases(schema, channelTableAliases.brake);
  const steeringTable = findTableByAliases(schema, channelTableAliases.steering);
  const lapNumberTable = findTableByAliases(schema, channelTableAliases.lapNumber);
  const gearTable = findTableByAliases(schema, channelTableAliases.gear);
  const metadataTable = findTableByAliases(schema, channelTableAliases.metadata);

  const resolvedTimestamp = timestampTable
    ? toResolvedChannelTable(timestampTable)
    : null;
  const resolvedLapDist = lapDistTable ? toResolvedChannelTable(lapDistTable) : null;
  const resolvedSpeedKph = speedKphTable ? toResolvedChannelTable(speedKphTable) : null;
  const resolvedSpeedMs = speedMsTable ? toResolvedChannelTable(speedMsTable) : null;
  const resolvedThrottle = throttleTable ? toResolvedChannelTable(throttleTable) : null;
  const resolvedBrake = brakeTable ? toResolvedChannelTable(brakeTable) : null;
  const resolvedSteering = steeringTable ? toResolvedChannelTable(steeringTable) : null;
  const resolvedLapNumber = lapNumberTable ? toResolvedChannelTable(lapNumberTable) : null;
  const resolvedGear = gearTable ? toResolvedChannelTable(gearTable) : null;
  const resolvedMetadata = metadataTable ? toResolvedMetadataTable(metadataTable) : null;

  const missingChannels: LogicalChannel[] = [];
  if (!resolvedTimestamp) missingChannels.push("timestamp");
  if (!resolvedLapDist) missingChannels.push("lapDistM");
  if (!resolvedSpeedMs && !resolvedSpeedKph) missingChannels.push("speed");
  if (!resolvedThrottle) missingChannels.push("throttle");
  if (!resolvedBrake) missingChannels.push("brake");
  if (!resolvedSteering) missingChannels.push("steering");

  if (missingChannels.length > 0) {
    return { channels: null, missingChannels };
  }

  const allColumns = schema.tables.flatMap((table) => table.columns);
  const trackCode = allColumns.find((column) =>
    columnAliases.trackCode.map(normalizeIdentifier).includes(column.normalizedName),
  );
  const carClass = allColumns.find((column) =>
    columnAliases.carClass.map(normalizeIdentifier).includes(column.normalizedName),
  );

  return {
    channels: {
      format: "channel_tables",
      telemetryTable: null,
      timestamp: {
        tableName: resolvedTimestamp!.tableName,
        columnName: resolvedTimestamp!.valueColumn,
      },
      lapNumber: resolvedLapNumber
        ? {
            tableName: resolvedLapNumber.tableName,
            columnName: resolvedLapNumber.valueColumn,
          }
        : null,
      lapDistM: {
        tableName: resolvedLapDist!.tableName,
        columnName: resolvedLapDist!.valueColumn,
      },
      speedMs: resolvedSpeedMs
        ? {
            tableName: resolvedSpeedMs.tableName,
            columnName: resolvedSpeedMs.valueColumn,
          }
        : null,
      speedKph: resolvedSpeedKph
        ? {
            tableName: resolvedSpeedKph.tableName,
            columnName: resolvedSpeedKph.valueColumn,
          }
        : null,
      throttle: {
        tableName: resolvedThrottle!.tableName,
        columnName: resolvedThrottle!.valueColumn,
      },
      brake: {
        tableName: resolvedBrake!.tableName,
        columnName: resolvedBrake!.valueColumn,
      },
      steering: {
        tableName: resolvedSteering!.tableName,
        columnName: resolvedSteering!.valueColumn,
      },
      gear: resolvedGear
        ? {
            tableName: resolvedGear.tableName,
            columnName: resolvedGear.valueColumn,
          }
        : null,
      trackCode: toResolvedColumn(trackCode ?? null),
      carClass: toResolvedColumn(carClass ?? null),
      metadataTable: resolvedMetadata,
      channelTables: {
        timestamp: resolvedTimestamp!,
        lapDistM: resolvedLapDist,
        speedMs: resolvedSpeedMs,
        speedKph: resolvedSpeedKph,
        throttle: resolvedThrottle,
        brake: resolvedBrake,
        steering: resolvedSteering,
        lapNumber: resolvedLapNumber,
        gear: resolvedGear,
      },
    } satisfies ResolvedTelemetryChannels,
    missingChannels: [] as LogicalChannel[],
  };
}

async function readSingleString(
  connection: DuckDBConnection,
  column: ResolvedDuckDbColumn | null,
  fallback: string,
) {
  if (!column) return fallback;

  const sql = `
    SELECT ${quoteIdentifier(column.columnName)} AS value
    FROM ${quoteIdentifier(column.tableName)}
    LIMIT 1
  `;

  try {
    const reader = await connection.runAndReadAll(sql);
    const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;
    const value = rows[0]?.value;
    return coerceString(value) ?? fallback;
  } catch {
    return fallback;
  }
}

function pickMetadataValue(
  entries: Array<{ key: string; value: string }>,
  keys: string[],
) {
  const priority = new Map(keys.map((key, index) => [key, index]));
  const candidates = entries
    .map((entry) => ({
      priority: priority.get(normalizeIdentifier(entry.key)),
      value: entry.value,
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        priority: number;
        value: string;
      } => candidate.priority !== undefined && candidate.value.trim().length > 0,
    )
    .sort((left, right) => left.priority - right.priority);

  return candidates[0]?.value ?? null;
}

async function readMetadataFromTable(
  connection: DuckDBConnection,
  metadataTable: ResolvedMetadataTable | null,
) {
  if (!metadataTable) {
    return {
      trackCode: null,
      carClass: null,
    };
  }

  const sql = `
    SELECT
      ${quoteIdentifier(metadataTable.keyColumn)} AS "key",
      ${quoteIdentifier(metadataTable.valueColumn)} AS "value"
    FROM ${quoteIdentifier(metadataTable.tableName)}
  `;

  try {
    const reader = await connection.runAndReadAll(sql);
    const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;
    const entries = rows
      .map((row) => {
        const key = coerceString(row.key);
        const value = coerceString(row.value);
        if (!key || !value) return null;
        return { key, value };
      })
      .filter((entry): entry is { key: string; value: string } => entry !== null);

    const trackCode = pickMetadataValue(entries, trackCodeMetadataKeys);
    const trackLayout = pickMetadataValue(entries, trackLayoutMetadataKeys);
    const trackName = pickMetadataValue(entries, trackNameMetadataKeys);

    return {
      trackCode:
        trackCode ??
        (trackLayout && trackLayout.length > 3
          ? trackLayout
          : trackName ?? trackLayout ?? null),
      carClass: pickMetadataValue(entries, carClassMetadataKeys),
    };
  } catch {
    return {
      trackCode: null,
      carClass: null,
    };
  }
}

async function readValueSeries(
  connection: DuckDBConnection,
  channel: ResolvedChannelTable,
) {
  const sql = `
    SELECT
      rowid AS "__rowId",
      ${quoteIdentifier(channel.valueColumn)} AS value
    FROM ${quoteIdentifier(channel.tableName)}
    ORDER BY "__rowId" ASC
  `;

  const reader = await connection.runAndReadAll(sql);
  const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;

  return rows.map((row) => coerceNullableNumber(row.value));
}

async function readTimedValueSeries(
  connection: DuckDBConnection,
  channel: ResolvedChannelTable,
) {
  if (!channel.tsColumn) return [];

  const sql = `
    SELECT
      ${quoteIdentifier(channel.tsColumn)} AS ts,
      ${quoteIdentifier(channel.valueColumn)} AS value
    FROM ${quoteIdentifier(channel.tableName)}
    ORDER BY ts ASC
  `;

  const reader = await connection.runAndReadAll(sql);
  const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;

  return rows
    .map((row) => {
      const tsSeconds = coerceNullableNumber(row.ts);
      const value = coerceNullableNumber(row.value);
      if (tsSeconds == null || value == null) return null;

      return {
        ts: tsSeconds * 1000,
        value,
      } satisfies TimedValue;
    })
    .filter((sample): sample is TimedValue => sample !== null);
}

function mapSourceIndexToBaseIndex(
  sourceIndex: number,
  sourceLength: number,
  baseLength: number,
) {
  if (sourceLength <= 1 || baseLength <= 1) return 0;
  return Math.round((sourceIndex * (baseLength - 1)) / (sourceLength - 1));
}

function timedSeriesFromBaseTimeline(
  values: Array<number | null>,
  baseTimeMs: number[],
) {
  if (values.length === 0 || baseTimeMs.length === 0) return [];

  const series: TimedValue[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value == null) continue;

    const baseIndex = mapSourceIndexToBaseIndex(index, values.length, baseTimeMs.length);
    const ts = baseTimeMs[baseIndex];
    if (ts == null) continue;

    series.push({
      ts,
      value,
    });
  }

  return series;
}

function sampleContinuous(
  series: TimedValue[],
  targetTs: number,
  cursor: { value: number },
) {
  if (series.length === 0) return null;
  if (series.length === 1) return series[0]!.value;

  while (
    cursor.value < series.length - 2 &&
    series[cursor.value + 1]!.ts < targetTs
  ) {
    cursor.value += 1;
  }

  const left = series[cursor.value]!;
  const right = series[Math.min(cursor.value + 1, series.length - 1)]!;

  if (targetTs <= left.ts) return left.value;
  if (targetTs >= right.ts) return right.value;

  const span = right.ts - left.ts;
  if (span <= 0) return left.value;

  const ratio = (targetTs - left.ts) / span;
  return left.value + (right.value - left.value) * ratio;
}

function sampleStep(
  series: TimedValue[],
  targetTs: number,
  cursor: { value: number },
) {
  if (series.length === 0) return null;

  while (
    cursor.value < series.length - 1 &&
    series[cursor.value + 1]!.ts <= targetTs
  ) {
    cursor.value += 1;
  }

  return series[cursor.value]!.value;
}

function requireTimedSeries(
  logicalChannel: LogicalChannel,
  series: TimedValue[],
) {
  if (series.length > 0) return series;

  throw new DuckDbReadError(
    `Required channel '${logicalChannel}' does not contain readable samples.`,
    "extract_raw_signals",
  );
}

async function readChannelTableSamples(
  connection: DuckDBConnection,
  channels: ResolvedTelemetryChannels,
) {
  const channelTables = channels.channelTables;
  if (!channelTables) {
    throw new DuckDbReadError(
      "Telemetry channel table mapping is missing for channel_tables format.",
      "extract_raw_signals",
    );
  }

  const timestampValues = await readValueSeries(connection, channelTables.timestamp);
  const baseTimeMs = timestampValues
    .map((value) => (value == null ? null : value * 1000))
    .filter((value): value is number => value != null && Number.isFinite(value));

  if (baseTimeMs.length === 0) {
    throw new DuckDbReadError(
      "Timestamp channel did not contain readable values.",
      "extract_raw_signals",
    );
  }

  const lapDistSeries = requireTimedSeries(
    "lapDistM",
    timedSeriesFromBaseTimeline(
      await readValueSeries(connection, channelTables.lapDistM!),
      baseTimeMs,
    ),
  );

  const speedSeries = requireTimedSeries(
    "speed",
    timedSeriesFromBaseTimeline(
      await readValueSeries(
        connection,
        (channelTables.speedMs ?? channelTables.speedKph)!,
      ),
      baseTimeMs,
    ),
  );

  const throttleSeries = requireTimedSeries(
    "throttle",
    timedSeriesFromBaseTimeline(
      await readValueSeries(connection, channelTables.throttle!),
      baseTimeMs,
    ),
  );

  const brakeSeries = requireTimedSeries(
    "brake",
    timedSeriesFromBaseTimeline(
      await readValueSeries(connection, channelTables.brake!),
      baseTimeMs,
    ),
  );

  const steeringSeries = requireTimedSeries(
    "steering",
    timedSeriesFromBaseTimeline(
      await readValueSeries(connection, channelTables.steering!),
      baseTimeMs,
    ),
  );

  const lapNumberSeries = channelTables.lapNumber
    ? await readTimedValueSeries(connection, channelTables.lapNumber)
    : [];
  const gearSeries = channelTables.gear
    ? await readTimedValueSeries(connection, channelTables.gear)
    : [];

  const lapDistCursor = { value: 0 };
  const speedCursor = { value: 0 };
  const throttleCursor = { value: 0 };
  const brakeCursor = { value: 0 };
  const steeringCursor = { value: 0 };
  const lapNumberCursor = { value: 0 };
  const gearCursor = { value: 0 };

  const samples = baseTimeMs
    .map((ts): RawSample | null => {
      const speedValue = sampleContinuous(speedSeries, ts, speedCursor);
      const lapDistM = sampleContinuous(lapDistSeries, ts, lapDistCursor);

      if (speedValue == null || lapDistM == null) {
        return null;
      }

      return {
        ts,
        lapNumber:
          lapNumberSeries.length === 0
            ? null
            : coerceNullableNumber(sampleStep(lapNumberSeries, ts, lapNumberCursor)),
        lapDistM,
        speedMs:
          channels.channelTables?.speedMs != null
            ? speedValue
            : speedValue / 3.6,
        throttle: coercePercent(
          coerceNullableNumber(sampleContinuous(throttleSeries, ts, throttleCursor)),
        ),
        brake: coercePercent(
          coerceNullableNumber(sampleContinuous(brakeSeries, ts, brakeCursor)),
        ),
        steering: coerceNullableNumber(
          sampleContinuous(steeringSeries, ts, steeringCursor),
        ),
        gear:
          gearSeries.length === 0
            ? null
            : coerceNullableNumber(sampleStep(gearSeries, ts, gearCursor)),
      };
    })
    .filter((sample): sample is RawSample => sample !== null);

  if (samples.length === 0) {
    throw new DuckDbReadError(
      "DuckDB export telemetry rows could not be coerced into samples.",
      "extract_raw_signals",
    );
  }

  const lapNumbers = samples
    .map((sample) => sample.lapNumber)
    .filter((lapNumber): lapNumber is number => lapNumber !== null);
  const shouldShiftLapNumbers =
    lapNumbers.length > 0 &&
    Math.min(...lapNumbers) === 0 &&
    Math.max(...lapNumbers) >= 1;

  if (shouldShiftLapNumbers) {
    return samples.map((sample) => ({
      ...sample,
      lapNumber: sample.lapNumber == null ? null : sample.lapNumber + 1,
    }));
  }

  return samples;
}

async function readWideTableSamples(
  connection: DuckDBConnection,
  channels: ResolvedTelemetryChannels,
) {
  const telemetryTable = channels.telemetryTable;
  if (!telemetryTable) {
    throw new DuckDbReadError(
      "Telemetry table is missing for wide_table format.",
      "extract_raw_signals",
    );
  }

  const sql = `
    SELECT
      ${quoteIdentifier(channels.timestamp.columnName)} AS ts,
      ${
        channels.lapNumber
          ? `${quoteIdentifier(channels.lapNumber.columnName)}`
          : "NULL"
      } AS "lapNumber",
      ${quoteIdentifier(channels.lapDistM.columnName)} AS "lapDistM",
      ${
        channels.speedMs
          ? `${quoteIdentifier(channels.speedMs.columnName)}`
          : `${quoteIdentifier(channels.speedKph!.columnName)}`
      } AS "speedValue",
      ${quoteIdentifier(channels.throttle.columnName)} AS throttle,
      ${quoteIdentifier(channels.brake.columnName)} AS brake,
      ${quoteIdentifier(channels.steering.columnName)} AS steering,
      ${channels.gear ? `${quoteIdentifier(channels.gear.columnName)}` : "NULL"} AS gear
    FROM ${quoteIdentifier(telemetryTable)}
    ORDER BY ts ASC
  `;

  const reader = await connection.runAndReadAll(sql);
  const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    throw new DuckDbReadError(
      "DuckDB export did not contain telemetry rows.",
      "extract_raw_signals",
    );
  }

  const samples = rows
    .map((row) => {
      const ts = coerceNumber(row.ts);
      const lapDistM = coerceNumber(row.lapDistM);

      if (ts == null || lapDistM == null) {
        return null;
      }

      const speedValue = coerceNullableNumber(row.speedValue);

      return {
        ts,
        lapNumber: coerceNullableNumber(row.lapNumber),
        lapDistM,
        speedMs:
          speedValue == null
            ? null
            : channels.speedMs
              ? speedValue
              : speedValue / 3.6,
        throttle: coercePercent(coerceNullableNumber(row.throttle)),
        brake: coercePercent(coerceNullableNumber(row.brake)),
        steering: coerceNullableNumber(row.steering),
        gear: coerceNullableNumber(row.gear),
      } satisfies RawSample;
    })
    .filter((sample): sample is RawSample => sample !== null);

  if (samples.length === 0) {
    throw new DuckDbReadError(
      "DuckDB export telemetry rows could not be coerced into samples.",
      "extract_raw_signals",
    );
  }

  return samples;
}

export async function openReadOnlyDuckDb(filePath: string): Promise<OpenDuckDbHandle> {
  if (!filePath.toLowerCase().endsWith(".duckdb")) {
    throw new UnsupportedFileError(`Stored upload '${filePath}' is not a .duckdb file.`);
  }

  try {
    const instance = await DuckDBInstance.create(filePath, {
      access_mode: "READ_ONLY",
    });
    const connection = await instance.connect();
    return { instance, connection };
  } catch (error) {
    throw new DuckDbReadError(
      `Failed to open DuckDB export '${filePath}': ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "open_duckdb",
    );
  }
}

export function closeDuckDb(handle: OpenDuckDbHandle) {
  handle.connection.closeSync();
  handle.instance.closeSync();
}

export async function discoverDuckDbSchema(
  connection: DuckDBConnection,
): Promise<DiscoveredDuckDbSchema> {
  try {
    const schemaReader = await connection.runAndReadAll(`
      SELECT
        table_name AS "tableName",
        column_name AS "columnName",
        data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
      ORDER BY table_name ASC, ordinal_position ASC
    `);

    const rows = schemaReader.getRowObjectsJS() as Array<Record<string, unknown>>;
    const tables = new Map<string, DiscoveredDuckDbColumn[]>();

    for (const row of rows) {
      const tableName =
        typeof row.tableName === "string"
          ? row.tableName
          : typeof row.table_name === "string"
            ? row.table_name
            : null;
      const columnName =
        typeof row.columnName === "string"
          ? row.columnName
          : typeof row.column_name === "string"
            ? row.column_name
            : null;
      const dataType =
        typeof row.dataType === "string"
          ? row.dataType
          : typeof row.data_type === "string"
            ? row.data_type
            : "UNKNOWN";

      if (!tableName || !columnName) continue;

      const columns = tables.get(tableName) ?? [];
      columns.push({
        tableName,
        columnName,
        dataType,
        normalizedName: normalizeIdentifier(columnName),
      });
      tables.set(tableName, columns);
    }

    return {
      tables: [...tables.entries()].map(([tableName, columns]) => ({
        tableName,
        normalizedName: normalizeIdentifier(tableName),
        columns,
      })),
    };
  } catch (error) {
    throw new DuckDbReadError(
      `Failed to inspect DuckDB schema: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "discover_schema",
    );
  }
}

export function resolveTelemetryChannels(
  schema: DiscoveredDuckDbSchema,
): ResolvedTelemetryChannels {
  const wideResult = resolveWideTableChannels(schema);
  if (wideResult.channels) {
    return wideResult.channels;
  }

  const channelTableResult = resolveChannelTableChannels(schema);
  if (channelTableResult.channels) {
    return channelTableResult.channels;
  }

  throw new MissingChannelsError(
    channelTableResult.missingChannels.length <= wideResult.missingChannels.length
      ? channelTableResult.missingChannels
      : wideResult.missingChannels,
  );
}

export async function readSessionMetadata(
  connection: DuckDBConnection,
  channels: ResolvedTelemetryChannels,
  originalFilename: string,
): Promise<SessionMetadata> {
  const metadata = await readMetadataFromTable(connection, channels.metadataTable);
  const trackCodeFromColumn = await readSingleString(
    connection,
    channels.trackCode,
    unknownTrackCode,
  );
  const carClassFromColumn = await readSingleString(
    connection,
    channels.carClass,
    unknownCarClass,
  );

  return {
    sourceFilename: originalFilename,
    sim: "LMU",
    trackCode: metadata.trackCode ?? trackCodeFromColumn,
    carClass: metadata.carClass ?? carClassFromColumn,
  };
}

export async function readTelemetrySamples(
  connection: DuckDBConnection,
  channels: ResolvedTelemetryChannels,
): Promise<RawSample[]> {
  try {
    if (channels.format === "channel_tables") {
      return await readChannelTableSamples(connection, channels);
    }

    return await readWideTableSamples(connection, channels);
  } catch (error) {
    if (error instanceof DuckDbReadError) {
      throw error;
    }

    throw new DuckDbReadError(
      `Failed to extract telemetry rows: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      "extract_raw_signals",
    );
  }
}
