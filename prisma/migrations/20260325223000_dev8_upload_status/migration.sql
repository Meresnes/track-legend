CREATE TYPE "UploadStatus" AS ENUM ('queued', 'running', 'done', 'error');

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sourceFilename" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "sessionId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Upload_sessionId_key" ON "Upload"("sessionId");

ALTER TABLE "Upload"
ADD CONSTRAINT "Upload_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
