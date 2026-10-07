import { ArgumentsHost, BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@saas/database";
import { describe, expect, it, vi } from "vitest";
import { AllExceptionsFilter } from "../src/common/all-exceptions.filter.js";

function makeHost() {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const response = { status, setHeader };
  const request = { requestId: "req-1" };
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

  it("sets a Retry-After header when the exception's details carry retryAfterSeconds", () => {
    const { host, setHeader } = makeHost();
    filter.catch(
      new BadRequestException({ message: "Too many requests", details: { retryAfterSeconds: 42 } }),
      host,
    );
    expect(setHeader).toHaveBeenCalledWith("Retry-After", "42");
  });
});
