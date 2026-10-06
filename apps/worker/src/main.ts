import { logger } from "@saas/observability";
import "./processors/email.processor.js";
import "./processors/cleanup.processor.js";

logger.info("Worker started: listening on email, cleanup, webhook-retry queues");

process.on("SIGTERM", () => {
  logger.info("Worker shutting down");
  process.exit(0);
});
