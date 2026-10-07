import type { Request, Response } from "express";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { Prisma } from "@saas/database";
import { logger } from "@saas/observability";

// Prisma error codes that indicate the database itself is unreachable/misconfigured,
// as opposed to a normal query-level failure (constraint violation, not found, etc.) —
// these map to 503, not 500, with a safe "try again" message (checklist: "Database
// error" maps to a safe code with a retry path, never a raw stack trace or query error).
const DB_UNREACHABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

/** Normalizes every thrown error into a consistent ApiError shape and never leaks stack traces to clients. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.requestId ?? "unknown";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred.";
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = HttpStatus[status] ?? "ERROR";
      if (typeof body === "string") {
        message = body;
      } else if (typeof body === "object" && body !== null) {
        const b = body as Record<string, unknown>;
        message = typeof b.message === "string" ? b.message : message;
        code = typeof b.code === "string" ? b.code : code;
        details =
          typeof b.details === "object" ? (b.details as Record<string, unknown>) : undefined;
      }
    } else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      (exception instanceof Prisma.PrismaClientKnownRequestError &&
        DB_UNREACHABLE_PRISMA_CODES.has(exception.code))
    ) {
      // The database itself is unreachable — never the client's fault, and never a
      // raw Prisma error message (which can include connection strings/hostnames).
      status = HttpStatus.SERVICE_UNAVAILABLE;
      code = "SERVICE_UNAVAILABLE";
      message = "The service is temporarily unavailable. Please try again.";
      logger.error({ err: exception, requestId }, "Database unreachable");
    } else if (exception instanceof Error) {
      logger.error({ err: exception, requestId }, "Unhandled exception");
    }

    // 429/423 both describe "try again, but not yet" — surface a standard Retry-After
    // header (seconds) wherever the exception carries one, so clients don't have to
    // parse it out of the JSON body.
    const retryAfterSeconds =
      details && typeof details.retryAfterSeconds === "number" ? details.retryAfterSeconds : null;
    if (retryAfterSeconds !== null) {
      response.setHeader("Retry-After", String(retryAfterSeconds));
    }

    response.status(status).json({ requestId, code, message, details });
  }
}
