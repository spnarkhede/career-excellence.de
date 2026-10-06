import { logger } from "@saas/observability";
import "./processors/email.processor.js";
import "./processors/cleanup.processor.js";

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

logger.info("Worker started: listening on email, cleanup, webhook-retry queues");

process.on("SIGTERM", () => {
  logger.info("Worker shutting down");
  process.exit(0);
});
