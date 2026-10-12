import { Worker } from "bullmq";
import { prisma } from "@saas/database";
import { logger } from "@saas/observability";
import { connection, QUEUE_NAMES } from "../connection.js";

/**
 * Stage 4 checklist #63 "Partial account creation": "A repair job catches older
 * partial accounts." `AuthService.signUp`'s transaction and `PrincipalService`'s
 * per-login self-heal (apps/api/src/auth/principal.service.ts) prevent new partial
 * accounts and fix one lazily the next time its owner signs in — this job is the
 * backstop for a user row left without a profile and/or role by anything that
 * predates those guarantees (e.g. a direct DB write, an old bug, a crash during a
 * since-removed non-transactional code path) and who may never log in again to
 * trigger the lazy repair. Scheduled/triggered the same way QUEUE_NAMES.cleanup is
 * (no in-repo scheduler exists for either queue yet — an external cron or BullMQ
 * repeatable job must enqueue a job here; see docs/TRACEABILITY.md item #63 note).
 */
export const accountRepairWorker = new Worker(
  QUEUE_NAMES.accountRepair,
  async () => {
    const usersMissingProfile = await prisma.user.findMany({
      where: { profile: null, deletedAt: null },
      select: { id: true },
    });
    for (const { id } of usersMissingProfile) {
      await prisma.profile.create({ data: { userId: id } }).catch((err: { code?: string }) => {
        if (err.code !== "P2002") throw err; // lost the race to a concurrent repair — fine.
      });
    }

    const defaultRole = await prisma.role.findUnique({ where: { name: "user" } });
    let usersRepairedRoles = 0;
    if (defaultRole) {
      const usersMissingRole = await prisma.user.findMany({
        where: { userRoles: { none: {} }, deletedAt: null },
        select: { id: true },
      });
      for (const { id } of usersMissingRole) {
        await prisma.userRole.createMany({
          data: [{ userId: id, roleId: defaultRole.id }],
          skipDuplicates: true,
        });
      }
      usersRepairedRoles = usersMissingRole.length;
    }

    return {
      profilesRepaired: usersMissingProfile.length,
      rolesRepaired: usersRepairedRoles,
    };
  },
  { connection },
);

accountRepairWorker.on("completed", (job, result) =>
  logger.info({ jobId: job.id, result }, "account repair completed"),
);
accountRepairWorker.on("failed", (job, err) =>
  logger.error({ jobId: job?.id, err }, "account repair failed"),
);
