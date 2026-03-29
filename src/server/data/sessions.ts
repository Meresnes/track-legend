import { type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "../prisma";

export type SessionListItem = {
  sessionId: string;
  createdAt: Date;
  sim: string;
  trackCode: string;
  carClass: string;
  lapsCount: number;
  bestLapTimeMs: number | null;
  referenceLapId: string | null;
};

export type LapListItem = {
  lapId: string;
  lapNumber: number;
  lapTimeMs: number | null;
  isValid: boolean;
};

export type SessionLapList = {
  sessionId: string;
  referenceLapId: string | null;
  bestLapId: string | null;
  bestLapTimeMs: number | null;
  items: LapListItem[];
};

export type ReferenceLapUpdateResponse = {
  sessionId: string;
  referenceLapId: string | null;
};

export type ReferenceLapUpdateResult =
  | { status: "ok"; data: ReferenceLapUpdateResponse }
  | { status: "session_missing" }
  | { status: "lap_missing" }
  | { status: "lap_mismatch" };

type PrismaLike = Pick<PrismaClient, "session" | "lap">;

function getClient(client?: PrismaLike) {
  return client ?? getPrismaClient();
}

export async function listSessions(client?: PrismaLike): Promise<SessionListItem[]> {
  const prisma = getClient(client);
  const sessions = await prisma.session.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      createdAt: true,
      sim: true,
      trackCode: true,
      carClass: true,
      referenceLapId: true,
      _count: {
        select: {
          laps: true,
        },
      },
    },
  });

  const bestLapTimes = await prisma.lap.groupBy({
    by: ["sessionId"],
    where: {
      isValid: true,
      lapTimeMs: {
        not: null,
      },
    },
    _min: {
      lapTimeMs: true,
    },
  });

  const bestLapTimeBySession = new Map<string, number | null>();
  for (const entry of bestLapTimes) {
    bestLapTimeBySession.set(entry.sessionId, entry._min.lapTimeMs ?? null);
  }

  return sessions.map((session) => ({
    sessionId: session.id,
    createdAt: session.createdAt,
    sim: session.sim,
    trackCode: session.trackCode,
    carClass: session.carClass,
    lapsCount: session._count.laps,
    bestLapTimeMs: bestLapTimeBySession.get(session.id) ?? null,
    referenceLapId: session.referenceLapId,
  }));
}

export async function getSessionLaps(
  sessionId: string,
  client?: PrismaLike,
): Promise<SessionLapList | null> {
  const prisma = getClient(client);
  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
      referenceLapId: true,
    },
  });

  if (!session) {
    return null;
  }

  const laps = await prisma.lap.findMany({
    where: {
      sessionId,
    },
    orderBy: {
      lapNumber: "asc",
    },
    select: {
      id: true,
      lapNumber: true,
      lapTimeMs: true,
      isValid: true,
    },
  });

  let bestLapId: string | null = null;
  let bestLapTimeMs: number | null = null;
  for (const lap of laps) {
    if (!lap.isValid || lap.lapTimeMs === null) {
      continue;
    }

    if (bestLapTimeMs === null || lap.lapTimeMs < bestLapTimeMs) {
      bestLapTimeMs = lap.lapTimeMs;
      bestLapId = lap.id;
    }
  }

  return {
    sessionId: session.id,
    referenceLapId: session.referenceLapId,
    bestLapId,
    bestLapTimeMs,
    items: laps.map((lap) => ({
      lapId: lap.id,
      lapNumber: lap.lapNumber,
      lapTimeMs: lap.lapTimeMs ?? null,
      isValid: lap.isValid,
    })),
  };
}

export async function updateReferenceLap(
  sessionId: string,
  lapId: string,
  client?: PrismaLike,
): Promise<ReferenceLapUpdateResult> {
  const prisma = getClient(client);

  const session = await prisma.session.findUnique({
    where: {
      id: sessionId,
    },
    select: {
      id: true,
    },
  });

  if (!session) {
    return { status: "session_missing" };
  }

  const lap = await prisma.lap.findUnique({
    where: {
      id: lapId,
    },
    select: {
      id: true,
      sessionId: true,
    },
  });

  if (!lap) {
    return { status: "lap_missing" };
  }

  if (lap.sessionId !== sessionId) {
    return { status: "lap_mismatch" };
  }

  const updated = await prisma.session.update({
    where: {
      id: sessionId,
    },
    data: {
      referenceLapId: lapId,
    },
    select: {
      id: true,
      referenceLapId: true,
    },
  });

  return {
    status: "ok",
    data: {
      sessionId: updated.id,
      referenceLapId: updated.referenceLapId,
    },
  };
}
