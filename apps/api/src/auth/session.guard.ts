import type { Request } from "express";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { prisma } from "@saas/database";
import { AuthService } from "./auth.service.js";
import { PrincipalService } from "./principal.service.js";

declare module "express-serve-static-core" {
  interface Request {
    principal?: Awaited<ReturnType<PrincipalService["resolve"]>>;
  }
}

/** Validates the session cookie, checks DB revocation state, and attaches the resolved principal to the request. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private principalService: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const cookieName = process.env.AUTH_SESSION_COOKIE_NAME ?? "app_session";
    const token = request.cookies?.[cookieName];

    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    const { userId, sessionId } = this.authService.verifyAccessToken(token);

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired or revoked.");
    }

    request.principal = await this.principalService.resolve(userId, sessionId);
    return true;
  }
}
