import { ArgumentsHost, BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { ForbiddenError } from "@saas/authorization";
import { Prisma } from "@saas/database";
import { describe, expect, it, vi } from "vitest";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";
import { AUTH_ERROR_CATALOG } from "../src/common/error-catalog.js";

function makeHost(path = "/test") {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status, setHeader };
  const request = { requestId: "req-1", path };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json, setHeader };
}

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  // Checklist "Invalid response" / general validation: a 422 from Zod flows through
  // with field-level details, never a raw stack trace.
  it("passes through an UnprocessableEntityException's status, code, and field errors", () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new UnprocessableEntityException({
        message: "Validation failed",
        details: { fieldErrors: { email: ["Invalid email"] } },
      }),
      host,
    );
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed",
        details: { fieldErrors: { email: ["Invalid email"] } },
      }),
    );
  });

  // Checklist "Database error": a Prisma connection failure maps to 503 with a safe,
  // generic message — never the raw Prisma error (which can include the connection
  // string/hostname).
  it("maps a Prisma connection failure to 503 with a safe generic message", () => {
    const { host, status, json } = makeHost();
    const dbError = new Prisma.PrismaClientInitializationError(
      "Can't reach database server at db.internal.example.com:5432",
      "6.1.0",
    );
    filter.catch(dbError, host);
    expect(status).toHaveBeenCalledWith(503);
    const body = json.mock.calls[0]?.[0] as { message: string; code: string };
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.message).not.toContain("db.internal.example.com");
  });

  it("maps a Prisma known-request connection error code (P1001) to 503", () => {
    const { host, status } = makeHost();
    const dbError = new Prisma.PrismaClientKnownRequestError("Can't reach database server", {
      code: "P1001",
      clientVersion: "6.1.0",
    });
    filter.catch(dbError, host);
    expect(status).toHaveBeenCalledWith(503);
  });

  // Checklist "Invalid response" / unmapped error: anything else falls back to a
  // generic 500, never leaking the raw error message to the client.
  it("maps an unrecognized error to a generic 500 without leaking its message", () => {
    const { host, status, json } = makeHost();
    filter.catch(new Error("some internal detail: password=hunter2"), host);
    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0]?.[0] as { message: string };
    expect(body.message).not.toContain("hunter2");
  });

  // BUG-015 (Phase 10): @saas/authorization's ForbiddenError is a plain
  // Error, not a Nest HttpException — without a dedicated branch it fell
  // through to the generic 500 case above instead of ever becoming the 403
  // every assertPermission call in this codebase is written to produce
  // (checklist: "403 when forbidden").
  it("maps @saas/authorization's ForbiddenError to 403, not a generic 500", () => {
    const { host, status, json } = makeHost();
    filter.catch(new ForbiddenError(), host);
    expect(status).toHaveBeenCalledWith(403);
    const body = json.mock.calls[0]?.[0] as { code: string; message: string };
    expect(body.code).toBe("FORBIDDEN");
  });

  it("sets a Retry-After header when the exception's details carry retryAfterSeconds", () => {
    const { host, setHeader } = makeHost();
    filter.catch(
      new BadRequestException({ message: "Too many requests", details: { retryAfterSeconds: 42 } }),
      host,
    );
    expect(setHeader).toHaveBeenCalledWith("Retry-After", "42");
  });

  // Phase 12 checklist "429": @nestjs/throttler's default exception must never
  // leak its own class name ("ThrottlerException: ...") or go uncoded.
  it("maps ThrottlerException to a clean 429 with a catalog code and message, not the raw class name", () => {
    const { host, status, json } = makeHost("/auth/login");
    filter.catch(new ThrottlerException(), host);
    expect(status).toHaveBeenCalledWith(429);
    const body = json.mock.calls[0]?.[0] as { code: string; message: string };
    expect(body.code).toBe("TOO_MANY_REQUESTS");
    expect(body.message).not.toContain("ThrottlerException");
    expect(body.message).toBe(AUTH_ERROR_CATALOG.TOO_MANY_REQUESTS.message);
  });

  // Phase 12 checklist "no stack traces, SQL, raw provider errors or internal
  // IDs in production" — explicit test, even though the filter never branches
  // on NODE_ENV at all (every environment gets the same safe shape).
  it("never includes a stack trace or internal error identifiers in the response body, regardless of environment", () => {
    const { host, json } = makeHost();
    const err = new Error("secret internal detail");
    err.stack =
      "Error: secret internal detail\n    at someInternalFunction (/app/src/secret.ts:42:1)";
    filter.catch(err, host);
    const body = json.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.stringify(body)).not.toContain("someInternalFunction");
    expect(JSON.stringify(body)).not.toContain("/app/src/secret.ts");
    expect(body.stack).toBeUndefined();
  });

  // Phase 12 task 3 ("one mapping layer... to catalog codes") / DONE WHEN
  // "ERRORS.md matches the code": every entry actually reachable through this
  // filter's own branches must produce EXACTLY its catalog-documented
  // status+message — this is the machine-checkable half of that promise.
  it("ForbiddenError's thrown shape matches its catalog entry exactly", () => {
    const { host, status, json } = makeHost();
    filter.catch(new ForbiddenError(), host);
    expect(status).toHaveBeenCalledWith(AUTH_ERROR_CATALOG.FORBIDDEN.status);
    const body = json.mock.calls[0]?.[0] as { code: string; message: string };
    expect(body.code).toBe("FORBIDDEN");
  });

  it("the Prisma-unreachable 503 shape matches its catalog entry exactly", () => {
    const { host, status, json } = makeHost();
    filter.catch(
      new Prisma.PrismaClientKnownRequestError("unreachable", {
        code: "P1001",
        clientVersion: "6.1.0",
      }),
      host,
    );
    expect(status).toHaveBeenCalledWith(AUTH_ERROR_CATALOG.SERVICE_UNAVAILABLE.status);
    const body = json.mock.calls[0]?.[0] as { code: string; message: string };
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.message).toBe(AUTH_ERROR_CATALOG.SERVICE_UNAVAILABLE.message);
  });
});
