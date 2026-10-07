import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { OAuthController } from "./oauth/oauth.controller.js";
import { OAuthService } from "./oauth/oauth.service.js";
import { PrincipalService } from "./principal.service.js";
import { SessionGuard } from "./session.guard.js";

@Module({
  controllers: [AuthController, OAuthController],
  providers: [AuthService, OAuthService, PrincipalService, SessionGuard],
  exports: [AuthService, OAuthService, PrincipalService, SessionGuard],
})
export class AuthModule {}
