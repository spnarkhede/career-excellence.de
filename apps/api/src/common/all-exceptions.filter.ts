import type { Request, Response } from "express";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { ForbiddenError } from "@saas/authorization";
import { Prisma } from "@saas/database";
import { logger, recordAuthMetric } from "@saas/observability";

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

    if (exception instanceof ThrottlerException) {
      // Phase 12 (checklist "429" / task 6 "429 rate" metric): @nestjs/throttler's
      // default exception leaks its own class name into the message
      // ("ThrottlerException: Too Many Requests") and carries no `code` at
      // all — give it the same clean shape as every other catalog entry
      // instead of letting the generic HttpException branch below pass that
      // raw string straight through.
      status = HttpStatus.TOO_MANY_REQUESTS;
      code = "TOO_MANY_REQUESTS";
      message = "Too many attempts. Please wait a moment and try again.";
      recordAuthMetric("rate_limited", { path: request.path ?? "" });
    } else if (exception instanceof HttpException) {
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
    } else if (exception instanceof ForbiddenError) {
      // BUG-015: `@saas/authorization`'s assertPermission/ForbiddenError is a
      // plain Error, not a Nest HttpException — without this branch it fell
      // through to the generic `instanceof Error` case below and returned a
      // 500, never the 403 every permission check in this codebase is
      // written to produce (checklist: "403 when forbidden").
      status = HttpStatus.FORBIDDEN;
      code = exception.code;
      message = exception.message;
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

    // Task 6 ("5xx on auth routes" metric/alert): scoped to /auth so a 5xx
    // from an unrelated route doesn't pollute this specific alert signal.
    const requestPath = request.path ?? "";
    if (status >= 500 && requestPath.startsWith("/auth")) {
      recordAuthMetric("auth_5xx", { path: requestPath, status: String(status) });
    }

    response.status(status).json({ requestId, code, message, details });
  }
}
