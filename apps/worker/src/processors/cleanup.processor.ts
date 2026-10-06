import { Worker } from "bullmq";
import { prisma } from "@saas/database";
import { logger } from "@saas/observability";
import { connection, QUEUE_NAMES } from "../connection.js";

/** Removes expired, unconsumed verification tokens and long-revoked sessions on a schedule. */
export const cleanupWorker = new Worker(
  QUEUE_NAMES.cleanup,
  async () => {
    const now = new Date();
    const [tokens, sessions] = await Promise.all([
      prisma.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.session.deleteMany({
        where: { revokedAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { deletedTokens: tokens.count, deletedSessions: sessions.count };
  },
  { connection },
);

cleanupWorker.on("completed", (job, result) =>
  logger.info({ jobId: job.id, result }, "cleanup completed"),
);
cleanupWorker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "cleanup failed"));
