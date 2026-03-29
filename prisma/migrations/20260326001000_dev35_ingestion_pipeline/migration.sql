CREATE TYPE "IngestStage" AS ENUM (
    'queued',
    'open_duckdb',
    'discover_schema',
    'extract_raw_signals',
    'segment_laps',
    'normalize_distance',
    'resample',
    'persist_session',
    'finalize'
);

ALTER TABLE "Upload"
ADD COLUMN "processingStage" "IngestStage" NOT NULL DEFAULT 'queued',
ADD COLUMN "fileSizeBytes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Session"
ADD COLUMN "sim" TEXT NOT NULL DEFAULT 'LMU',
ADD COLUMN "trackCode" TEXT NOT NULL DEFAULT 'UNKNOWN_TRACK',
ADD COLUMN "carClass" TEXT NOT NULL DEFAULT 'UNKNOWN_CLASS',
ADD COLUMN "referenceLapId" TEXT;

CREATE TABLE "Lap" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "lapNumber" INTEGER NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true,
    "lapTimeMs" INTEGER,
    "distanceM" DOUBLE PRECISION,

    CONSTRAINT "Lap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Sample" (
    "lapId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "tMs" INTEGER NOT NULL,
    "distM" DOUBLE PRECISION NOT NULL,
    "speedMs" DOUBLE PRECISION,
    "throttle" DOUBLE PRECISION,
    "brake" DOUBLE PRECISION,
    "steering" DOUBLE PRECISION,
    "gear" INTEGER,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("lapId","idx")
);

CREATE INDEX "Upload_status_createdAt_idx" ON "Upload"("status", "createdAt");
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");
CREATE INDEX "Session_trackCode_carClass_idx" ON "Session"("trackCode", "carClass");
CREATE UNIQUE INDEX "Lap_sessionId_lapNumber_key" ON "Lap"("sessionId", "lapNumber");
CREATE INDEX "Lap_sessionId_lapTimeMs_idx" ON "Lap"("sessionId", "lapTimeMs");
CREATE INDEX "Sample_lapId_distM_idx" ON "Sample"("lapId", "distM");

ALTER TABLE "Lap"
ADD CONSTRAINT "Lap_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Sample"
ADD CONSTRAINT "Sample_lapId_fkey"
FOREIGN KEY ("lapId") REFERENCES "Lap"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "Session"
ADD CONSTRAINT "Session_referenceLapId_fkey"
FOREIGN KEY ("referenceLapId") REFERENCES "Lap"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
