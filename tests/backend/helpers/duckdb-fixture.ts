import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";

type DuckDbFixtureFormat = "wide_table" | "channel_tables";

type DuckDbFixtureOptions = {
  format?: DuckDbFixtureFormat;
  includeBrake?: boolean;
  includeLapNumber?: boolean;
  includeMetadataTable?: boolean;
};

function formatValue(value: number | string | null) {
  return value === null ? "NULL" : String(value);
}

function createWideTelemetryRows(includeLapNumber: boolean) {
  const lapOne: Array<[number, number | null, number, number, number, number, number, number]> = [
    [0, includeLapNumber ? 1 : null, 0, 144, 0, 0, 0.02, 2],
    [1000, includeLapNumber ? 1 : null, 250, 162, 0.35, 0, 0.08, 3],
    [2000, includeLapNumber ? 1 : null, 500, 180, 0.7, 0, 0.12, 4],
    [3000, includeLapNumber ? 1 : null, 750, 170, 0.4, 0.15, 0.16, 4],
    [4000, includeLapNumber ? 1 : null, 1000, 150, 0.2, 0.35, 0.1, 3],
  ];
  const lapTwo: Array<[number, number | null, number, number, number, number, number, number]> = [
    [4500, includeLapNumber ? 2 : null, 0, 146, 0, 0, 0.01, 2],
    [5400, includeLapNumber ? 2 : null, 250, 166, 0.38, 0, 0.06, 3],
    [6300, includeLapNumber ? 2 : null, 500, 184, 0.76, 0, 0.11, 4],
    [7200, includeLapNumber ? 2 : null, 740, 176, 0.46, 0.08, 0.14, 4],
    [8100, includeLapNumber ? 2 : null, 1005, 154, 0.22, 0.24, 0.09, 3],
  ];

  return [...lapOne, ...lapTwo];
}

function createLmuChannelRows() {
  const gpsTime = Array.from({ length: 200 }, (_, index) => 48.38 + index * 0.01);
  const groundSpeed = gpsTime.map((_, index) => 140 + Math.sin(index / 12) * 30);
  const steering = gpsTime.map((_, index) => Math.sin(index / 8) * 0.22);
  const throttle = Array.from({ length: 100 }, (_, index) =>
    index < 12 || index > 85 ? 0 : Math.min(100, 20 + index),
  );
  const brake = Array.from({ length: 100 }, (_, index) =>
    index > 45 && index < 55 ? 25 : 0,
  );

  const lapDist = Array.from({ length: 20 }, (_, index) => {
    if (index < 10) return index * 120;
    return (index - 10) * 125;
  });

  return {
    gpsTime,
    lapDist,
    groundSpeed,
    throttle,
    brake,
    steering,
    lapEvents: [
      { ts: 48.38, value: 1 },
      { ts: 49.38, value: 2 },
    ],
    gearEvents: [
      { ts: 48.38, value: 2 },
      { ts: 48.55, value: 3 },
      { ts: 49.1, value: 4 },
    ],
  };
}

async function createWideTableFixture(
  connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
  options: DuckDbFixtureOptions,
) {
  const includeBrake = options.includeBrake ?? true;
  const includeLapNumber = options.includeLapNumber ?? true;

  await connection.run(`
    CREATE TABLE session_meta (
      track_code VARCHAR,
      car_class VARCHAR
    )
  `);
  await connection.run(`
    INSERT INTO session_meta VALUES ('MONZA_GP', 'HYPERCAR_2023')
  `);

  await connection.run(`
    CREATE TABLE telemetry_samples (
      sample_time_ms INTEGER,
      ${includeLapNumber ? "lap_number INTEGER," : ""}
      lap_distance_m DOUBLE,
      speed_kph DOUBLE,
      throttle_pct DOUBLE,
      ${includeBrake ? "brake_pct DOUBLE," : ""}
      steering_deg DOUBLE,
      gear INTEGER
    )
  `);

  const rows = createWideTelemetryRows(includeLapNumber)
    .map((row) => {
      const [ts, lapNumber, lapDistM, speedKph, throttlePct, brakePct, steeringDeg, gear] =
        row;
      const values = [
        ts,
        ...(includeLapNumber ? [lapNumber] : []),
        lapDistM,
        speedKph,
        throttlePct * 100,
        ...(includeBrake ? [brakePct * 100] : []),
        steeringDeg,
        gear,
      ];
      return `(${values.map(formatValue).join(", ")})`;
    })
    .join(",\n");

  const columns = [
    "sample_time_ms",
    ...(includeLapNumber ? ["lap_number"] : []),
    "lap_distance_m",
    "speed_kph",
    "throttle_pct",
    ...(includeBrake ? ["brake_pct"] : []),
    "steering_deg",
    "gear",
  ];

  await connection.run(`
    INSERT INTO telemetry_samples (${columns.join(", ")})
    VALUES ${rows}
  `);
}

async function insertValueTable(
  connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
  tableName: string,
  values: number[],
) {
  const quotedTableName = `"${tableName.replace(/"/g, "\"\"")}"`;

  await connection.run(`
    CREATE TABLE ${quotedTableName} (
      value DOUBLE
    )
  `);

  const rows = values.map((value) => `(${formatValue(value)})`).join(",\n");
  await connection.run(`
    INSERT INTO ${quotedTableName} (value)
    VALUES ${rows}
  `);
}

async function createChannelTableFixture(
  connection: Awaited<ReturnType<DuckDBInstance["connect"]>>,
  options: DuckDbFixtureOptions,
) {
  const includeBrake = options.includeBrake ?? true;
  const includeLapNumber = options.includeLapNumber ?? true;
  const includeMetadataTable = options.includeMetadataTable ?? true;
  const rows = createLmuChannelRows();

  await connection.run(`
    CREATE TABLE channelsList (
      channelName VARCHAR,
      frequency INTEGER,
      unit VARCHAR
    )
  `);

  await connection.run(`
    INSERT INTO channelsList (channelName, frequency, unit)
    VALUES
      ('GPS Time', 100, 's'),
      ('Lap Dist', 10, 'm'),
      ('Ground Speed', 100, 'km/h'),
      ('Throttle Pos', 50, '%'),
      ${includeBrake ? "('Brake Pos', 50, '%')," : ""}
      ('Steering Pos', 100, '')
  `);

  if (includeMetadataTable) {
    await connection.run(`
      CREATE TABLE metadata (
        key VARCHAR,
        value VARCHAR
      )
    `);

    await connection.run(`
      INSERT INTO metadata (key, value)
      VALUES
        ('TrackLayout', 'MONZA_GP'),
        ('TrackName', 'Autodromo Nazionale Monza'),
        ('CarClass', 'GT3')
    `);
  }

  await insertValueTable(connection, "GPS Time", rows.gpsTime);
  await insertValueTable(connection, "Lap Dist", rows.lapDist);
  await insertValueTable(connection, "Ground Speed", rows.groundSpeed);
  await insertValueTable(connection, "Throttle Pos", rows.throttle);
  await insertValueTable(connection, "Steering Pos", rows.steering);

  if (includeBrake) {
    await insertValueTable(connection, "Brake Pos", rows.brake);
  }

  if (includeLapNumber) {
    await connection.run(`
      CREATE TABLE "Lap" (
        ts DOUBLE,
        value INTEGER
      )
    `);
    await connection.run(`
      INSERT INTO "Lap" (ts, value)
      VALUES ${rows.lapEvents.map((row) => `(${row.ts}, ${row.value})`).join(",\n")}
    `);
  }

  await connection.run(`
    CREATE TABLE "Gear" (
      ts DOUBLE,
      value INTEGER
    )
  `);
  await connection.run(`
    INSERT INTO "Gear" (ts, value)
    VALUES ${rows.gearEvents.map((row) => `(${row.ts}, ${row.value})`).join(",\n")}
  `);
}

export async function createDuckDbFixture(options: DuckDbFixtureOptions = {}) {
  const format = options.format ?? "wide_table";
  const tempDir = await mkdtemp(join(tmpdir(), "track-legend-duckdb-"));
  const filePath = join(tempDir, "lmu-sample.duckdb");
  const instance = await DuckDBInstance.create(filePath);
  const connection = await instance.connect();

  try {
    if (format === "channel_tables") {
      await createChannelTableFixture(connection, options);
    } else {
      await createWideTableFixture(connection, options);
    }
  } finally {
    connection.closeSync();
    instance.closeSync();
  }

  return {
    filePath,
    cleanup: async () => {
      await rm(tempDir, { recursive: true, force: true });
    },
  };
}
