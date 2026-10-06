import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { PrincipalService } from "./principal.service.js";
import { SessionGuard } from "./session.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, PrincipalService, SessionGuard],
  exports: [AuthService, PrincipalService, SessionGuard],
})
export class AuthModule {}
