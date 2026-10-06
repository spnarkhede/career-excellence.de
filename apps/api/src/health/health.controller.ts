import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { prisma } from "@saas/database";

@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get("live")
  liveness() {
    return { status: "ok" };
  }

  @Get("ready")
  async readiness() {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}
