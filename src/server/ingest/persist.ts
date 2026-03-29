import { getPrismaClient } from "../prisma";
import { type CanonicalLap, type NormalizedSessionDraft } from "./types";

const sampleBatchSize = 1000;

type SessionCreatePayload = {
  data: {
    sourceFilename: string;
    sim: string;
    trackCode: string;
    carClass: string;
  };
  select: {
    id: true;
  };
};

type LapCreatePayload = {
  data: {
    sessionId: string;
    lapNumber: number;
    isValid: boolean;
    lapTimeMs: number | null;
    distanceM: number;
  };
  select: {
    id: true;
    lapNumber: true;
  };
};

type SessionUpdatePayload = {
  where: {
    id: string;
  };
  data: {
    referenceLapId: string;
  };
};

type SessionDeletePayload = {
  where: {
    id: string;
  };
};

type SampleCreateManyPayload = {
  data: Array<{
    lapId: string;
    idx: number;
    tMs: number;
    distM: number;
    speedMs: number | null;
    throttle: number | null;
    brake: number | null;
    steering: number | null;
    gear: number | null;
  }>;
};

type PrismaTransactionLike = {
  session: {
    create(payload: SessionCreatePayload): Promise<{ id: string }>;
    update(payload: SessionUpdatePayload): Promise<unknown>;
  };
  lap: {
    create(payload: LapCreatePayload): Promise<{ id: string; lapNumber: number }>;
  };
};

type PrismaLike = PrismaTransactionLike & {
  $transaction<T>(callback: (tx: PrismaTransactionLike) => Promise<T>): Promise<T>;
  sample: {
    createMany(payload: SampleCreateManyPayload): Promise<unknown>;
  };
  session: PrismaTransactionLike["session"] & {
    delete(payload: SessionDeletePayload): Promise<unknown>;
  };
};

type PersistedIngestResult = {
  sessionId: string;
  referenceLapId: string | null;
};

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function mapSamplesForInsert(lapId: string, lap: CanonicalLap) {
  return lap.samples.map((sample) => ({
    lapId,
    idx: sample.idx,
    tMs: sample.tMs,
    distM: sample.distM,
    speedMs: sample.speedMs,
    throttle: sample.throttle,
    brake: sample.brake,
    steering: sample.steering,
    gear: sample.gear,
  }));
}

export async function persistNormalizedSession(
  sessionDraft: NormalizedSessionDraft,
  client: PrismaLike = getPrismaClient() as unknown as PrismaLike,
): Promise<PersistedIngestResult> {
  let createdSessionId: string | null = null;

  try {
    const created = await client.$transaction(async (tx) => {
      const session = await tx.session.create({
        data: {
          sourceFilename: sessionDraft.metadata.sourceFilename,
          sim: sessionDraft.metadata.sim,
          trackCode: sessionDraft.metadata.trackCode,
          carClass: sessionDraft.metadata.carClass,
        },
        select: {
          id: true,
        },
      });

      createdSessionId = session.id;

      const lapRows: Array<{ id: string; lapNumber: number }> = [];

      for (const lap of sessionDraft.laps) {
        lapRows.push(
          await tx.lap.create({
            data: {
              sessionId: session.id,
              lapNumber: lap.lapNumber,
              isValid: lap.isValid,
              lapTimeMs: lap.lapTimeMs,
              distanceM: lap.distanceM,
            },
            select: {
              id: true,
              lapNumber: true,
            },
          }),
        );
      }

      const lapIdByLapNumber = new Map(lapRows.map((lap) => [lap.lapNumber, lap.id]));
      const referenceLapId =
        sessionDraft.referenceLapNumber === null
          ? null
          : lapIdByLapNumber.get(sessionDraft.referenceLapNumber) ?? null;

      if (referenceLapId) {
        await tx.session.update({
          where: {
            id: session.id,
          },
          data: {
            referenceLapId,
          },
        });
      }

      return {
        sessionId: session.id,
        referenceLapId,
        lapIdByLapNumber,
      };
    });

    for (const lap of sessionDraft.laps) {
      const lapId = created.lapIdByLapNumber.get(lap.lapNumber);

      if (!lapId) {
        continue;
      }

      const batches = chunkArray(mapSamplesForInsert(lapId, lap), sampleBatchSize);

      for (const batch of batches) {
        await client.sample.createMany({
          data: batch,
        });
      }
    }

    return {
      sessionId: created.sessionId,
      referenceLapId: created.referenceLapId,
    };
  } catch (error) {
    if (createdSessionId) {
      await client.session.delete({
        where: {
          id: createdSessionId,
        },
      }).catch(() => undefined);
    }

    throw error;
  }
}
