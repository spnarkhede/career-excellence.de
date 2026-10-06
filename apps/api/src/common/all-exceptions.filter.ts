import type { Request, Response } from "express";
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from "@nestjs/common";
import { logger } from "@saas/observability";

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
        details =
          typeof b.details === "object" ? (b.details as Record<string, unknown>) : undefined;
      }
    } else if (exception instanceof Error) {
      logger.error({ err: exception, requestId }, "Unhandled exception");
    }

    response.status(status).json({ requestId, code, message, details });
  }
}
