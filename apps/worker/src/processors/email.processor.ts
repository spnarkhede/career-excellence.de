import { Worker } from "bullmq";
import { StubEmailProvider, type SendEmailInput } from "@saas/email";
import { logger } from "@saas/observability";
import { connection, QUEUE_NAMES } from "../connection.js";

const emailProvider = new StubEmailProvider();

export const emailWorker = new Worker<SendEmailInput>(
  QUEUE_NAMES.email,
  async (job) => {
    await emailProvider.send(job.data);
  },
  { connection },
);

emailWorker.on("completed", (job) => logger.info({ jobId: job.id }, "email job completed"));
emailWorker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "email job failed"));
