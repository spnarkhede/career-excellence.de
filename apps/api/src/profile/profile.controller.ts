import { Body, Controller, Get, Patch, UseGuards, UsePipes } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { assertPermission } from "@saas/authorization";
import { prisma } from "@saas/database";
import { updateProfileSchema, type UpdateProfileInput } from "@saas/validation";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { CurrentPrincipal } from "../auth/current-principal.decorator.js";
import { PrincipalService } from "../auth/principal.service.js";
import { SessionGuard } from "../auth/session.guard.js";

type Principal = Awaited<ReturnType<PrincipalService["resolve"]>>;

@ApiTags("profile")
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller("profile")
export class ProfileController {
  @Get("me")
  async getMyProfile(@CurrentPrincipal() principal: Principal) {
    assertPermission(principal, "profile.read.own");
    const profile = await prisma.profile.findUnique({ where: { userId: principal.user.id } });
    return { profile };
  }

  @Patch("me")
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateMyProfile(@CurrentPrincipal() principal: Principal, @Body() dto: UpdateProfileInput) {
    assertPermission(principal, "profile.update.own");
    const profile = await prisma.profile.update({
      where: { userId: principal.user.id },
      data: { displayName: dto.displayName },
    });
    return { profile };
  }
}
