import pino from "pino";
import { deepRedact } from "./redact";

export { deepRedact } from "./redact";

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

export const logger = pino({
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
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
