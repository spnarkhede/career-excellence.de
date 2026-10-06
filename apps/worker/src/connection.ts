import IORedis from "ioredis";
import { loadPrivateEnv } from "@saas/config";

const env = loadPrivateEnv();

export const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const QUEUE_NAMES = {
  email: "email",
  cleanup: "cleanup",
  webhookRetry: "webhook-retry",
} as const;
