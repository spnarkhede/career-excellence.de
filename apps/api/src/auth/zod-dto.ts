import type { z, ZodTypeAny } from "zod";

/** Minimal base class so Zod schemas can double as NestJS DTO classes for Swagger +
 * validation pipe. Derives the DTO's type via `z.infer<S>` (the schema's OUTPUT type,
 * e.g. `.optional().default(x)` resolves non-optional) rather than `ZodSchema<T>`'s T
 * parameter, which silently inferred the wrong (input-shaped, still-optional) type for
 * any schema using `.optional().default(...)` — a real bug (Phase 18 checklist item
 * 9, "type mismatches") that `tsc --noEmit` only surfaced at each call site, not here. */
export function createZodDto<S extends ZodTypeAny>(schema: S) {
  class ZodDto {
    static schema = schema;
  }
  return ZodDto as unknown as new () => z.infer<S>;
}
