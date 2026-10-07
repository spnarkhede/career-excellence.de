import { Queue } from "bullmq";
import Redis from "ioredis";
import { loadPrivateEnv } from "@saas/config";
import { logger } from "@saas/observability";
import type { SendEmailInput } from "@saas/email";

// Literal "email" matches apps/worker/src/connection.ts's QUEUE_NAMES.email — the
// two apps can't share that constant without introducing a new shared package,
// which is out of scope for the one queue hookup this phase needs; kept as a
// single literal here rather than guessing at a bigger refactor.
const EMAIL_QUEUE_NAME = "email";

let queue: Queue<SendEmailInput> | null = null;

/** Lazily creates the queue (and its Redis connection) on first use, rather than
 * at module load — every existing test file transitively imports this module via
 * auth.service.ts, and eagerly opening a real network connection at import time
 * would attempt to connect to Redis in every one of them, regardless of whether
 * that test ever calls a password-reset method. */
function getQueue(): Queue<SendEmailInput> {
  if (!queue) {
    const env = loadPrivateEnv();
    const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
    // ioredis throws on an unhandled 'error' event (standard EventEmitter
    // behavior) — without this listener, a Redis outage would crash the process
    // instead of simply failing the enqueue, which the caller already wraps in a
    // try/catch (see AuthService.sendEmail's delivery-failure-tolerant pattern).
    connection.on("error", (err) => logger.error({ err }, "Email queue Redis connection error"));
    queue = new Queue<SendEmailInput>(EMAIL_QUEUE_NAME, { connection });
  }
  return queue;
}

/** Enqueues an email job for apps/worker's emailWorker to pick up, instead of
 * sending synchronously in-request — checklist "email sent from a queue." */
export async function enqueueEmail(input: SendEmailInput): Promise<void> {
  await getQueue().add("send", input);
}
