import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      // 422, not 400: the request is syntactically fine (valid JSON) but semantically
      // invalid (empty/malformed field values) — the correct distinction per the
      // Phase 5 login spec, and consistent across every Zod-validated endpoint.
      const flattened = result.error.flatten();
      throw new UnprocessableEntityException({
        message: "Validation failed",
        details: flattened,
      });
    }
    return result.data;
  }
}
