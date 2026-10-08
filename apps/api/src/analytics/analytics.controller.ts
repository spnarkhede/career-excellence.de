import { Body, Controller, HttpCode, Post, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { analyticsEventSchema } from "@saas/validation";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AnalyticsEventDto } from "./dto.js";
import { AnalyticsService } from "./analytics.service.js";

@ApiTags("analytics")
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post("events")
  @HttpCode(204)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(analyticsEventSchema))
  record(@Body() dto: AnalyticsEventDto) {
    this.analyticsService.record(dto);
  }
}
