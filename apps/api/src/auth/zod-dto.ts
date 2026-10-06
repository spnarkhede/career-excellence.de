import type { ZodSchema } from "zod";

/** Minimal base class so Zod schemas can double as NestJS DTO classes for Swagger + validation pipe. */
export function createZodDto<T>(schema: ZodSchema<T>) {
  class ZodDto {
    static schema = schema;
  }
  return ZodDto as unknown as new () => T;
}
