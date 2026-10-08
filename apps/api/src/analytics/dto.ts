import { createZodDto } from "../auth/zod-dto.js";
import { analyticsEventSchema } from "@saas/validation";

export class AnalyticsEventDto extends createZodDto(analyticsEventSchema) {}
