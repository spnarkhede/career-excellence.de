import type { Request, Response } from "express";
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { loadPrivateEnv } from "@saas/config";
import { prisma } from "@saas/database";
import { sessionCookieName } from "./cookie-names.js";
import { AuthService } from "./auth.service.js";
import { PrincipalService } from "./principal.service.js";

declare module "express-serve-static-core" {
  interface Request {
    principal?: Awaited<ReturnType<PrincipalService["resolve"]>>;
  }
}

const env = loadPrivateEnv();

/** Validates the session cookie, checks DB revocation/idle/absolute-expiry state,
 * touches the session's activity timestamp, and attaches the resolved principal
 * to the request. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private principalService: PrincipalService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    // Every authenticated response carries data scoped to this one session — never
    // a candidate for a shared cache (checklist: "Authenticated responses use
    // Cache-Control no-store").
    response.setHeader("Cache-Control", "no-store");

    const token = request.cookies?.[sessionCookieName];
    if (!token) {
      throw new UnauthorizedException("Authentication required.");
    }

    const { userId, sessionId } = this.authService.verifyAccessToken(token);

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired or revoked.");
    }
    if (session.absoluteExpiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException("Session expired or revoked.");
    }
    // Idle timeout: a session untouched for longer than this, even with a
    // perfectly valid access token and unexpired refresh token, is treated as
    // expired — distinct from the rolling/absolute refresh-token expiry above.
    const idleMs = Date.now() - session.lastUsedAt.getTime();
    if (idleMs > env.AUTH_IDLE_TIMEOUT_SECONDS * 1000) {
      throw new UnauthorizedException("Session expired due to inactivity. Please sign in again.");
    }

    await this.authService.touchSessionActivity(sessionId);
    request.principal = await this.principalService.resolve(userId, sessionId);
    return true;
  }
}
