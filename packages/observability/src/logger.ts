import pino, { type DestinationStream } from "pino";
import { deepRedact } from "./redact.js";

const REDACT_PATHS = [
  "password",
  "newPassword",
  "token",
  "code",
  "otp",
  "refreshToken",
  "accessToken",
  "authorization",
  "*.password",
  "*.token",
  "*.otp",
];

/**
 * Factory so tests can inject a destination and capture real output through
 * pino's full pipeline (its own `redact.paths` AND the `deepRedact` hook) —
 * pino's default destination writes directly to the fd via sonic-boom,
 * bypassing `process.stdout.write` entirely, so a test can't intercept the
 * singleton `logger` below by spying on stdout. See `logger.spec.ts`.
 */
export function createLogger(destination?: DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? "info",
      redact: { paths: REDACT_PATHS, censor: "[redacted]" },
      formatters: {
        level: (label) => ({ level: label }),
      },
      // Belt-and-suspenders: redact sensitive keys at any depth, in addition to the fixed
      // `redact.paths` above, before any log argument is serialized.
      hooks: {
        logMethod(inputArgs, method) {
          const redactedArgs = inputArgs.map((arg) =>
            typeof arg === "object" && arg !== null ? deepRedact(arg) : arg,
          ) as Parameters<typeof method>;
          return method.apply(this, redactedArgs);
        },
      },
    },
    destination,
  );
}

export const logger = createLogger();

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
