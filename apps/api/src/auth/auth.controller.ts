import type { Request, Response } from "express";
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { loadPrivateEnv } from "@saas/config";
import { sessionCookieOptions } from "@saas/security";
import { generateSecureToken } from "@saas/utils";
import {
  changePasswordSchema,
  loginSchema,
  requestMagicLinkSchema,
  requestOtpSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
  verifyMagicLinkSchema,
  verifyOtpSchema,
} from "@saas/validation";
import { CsrfGuard } from "../common/csrf.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService, type IssuedTokens } from "./auth.service.js";
import {
  csrfCookieName,
  isSecureCookies,
  refreshCookieName,
  sessionCookieName,
} from "./cookie-names.js";
import { CurrentPrincipal } from "./current-principal.decorator.js";
import type {
  ChangePasswordDto,
  LoginDto,
  RequestMagicLinkDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignUpDto,
  VerifyEmailDto,
  VerifyMagicLinkDto,
  VerifyOtpDto,
} from "./dto.js";
import { PrincipalService } from "./principal.service.js";
import { SessionGuard } from "./session.guard.js";

const env = loadPrivateEnv();
const cookieDomain = env.API_COOKIE_DOMAIN || undefined;

export function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    requestId: req.requestId ?? null,
  };
}

export function setSessionCookies(res: Response, tokens: IssuedTokens) {
  res.cookie(
    sessionCookieName,
    tokens.accessToken,
    sessionCookieOptions({
      domain: cookieDomain,
      secure: isSecureCookies,
      maxAgeSeconds: env.AUTH_ACCESS_TOKEN_TTL,
      sameSite: "lax",
    }),
  );
  res.cookie(
    refreshCookieName,
    tokens.refreshToken,
    sessionCookieOptions({
      domain: cookieDomain,
      secure: isSecureCookies,
      maxAgeSeconds: env.AUTH_REFRESH_TOKEN_TTL,
      // Strict, not Lax: the refresh cookie is only ever read by a same-origin
      // fetch this app's own client code makes — nothing legitimately needs it
      // sent on an incoming cross-site navigation, unlike the session cookie
      // (which may need to ride along right after following an email link).
      sameSite: "strict",
    }),
  );
  // Double-submit CSRF cookie: deliberately NOT httpOnly — the client reads this
  // value and echoes it back in an X-CSRF-Token header on state-changing requests;
  // an attacker's cross-site page can make the browser SEND the cookie
  // automatically but can't READ its value to forge a matching header.
  res.cookie(csrfCookieName, generateSecureToken(16), {
    httpOnly: false,
    secure: isSecureCookies,
    sameSite: "lax",
    ...(cookieDomain ? { domain: cookieDomain } : {}),
    path: "/",
    maxAge: env.AUTH_REFRESH_TOKEN_TTL * 1000,
  });
}

export function clearSessionCookies(res: Response) {
  res.clearCookie(sessionCookieName, { domain: cookieDomain, path: "/" });
  res.clearCookie(refreshCookieName, { domain: cookieDomain, path: "/" });
  res.clearCookie(csrfCookieName, { domain: cookieDomain, path: "/" });
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private principalService: PrincipalService,
  ) {}

  /** Session fixation prevention, shared by every endpoint that can issue a new
   * session (login, OTP verify, magic-link verify): resolve whatever session the
   * caller's CURRENT cookie points at, if any/still valid, so the service method can
   * discard it once the new session is issued. */
  private resolveExistingSessionId(req: Request): string | null {
    const existingAccessToken = req.cookies?.[sessionCookieName];
    if (!existingAccessToken) return null;
    try {
      return this.authService.verifyAccessToken(existingAccessToken).sessionId;
    } catch {
      return null;
    }
  }

  @Post("signup")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(signUpSchema))
  async signUp(@Body() dto: SignUpDto, @Req() req: Request) {
    const user = await this.authService.signUp(dto, requestContext(req));
    return { user };
  }

  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(
      dto,
      requestContext(req),
      this.resolveExistingSessionId(req),
    );
    setSessionCookies(res, tokens);
    // No tokens in the response body when using cookies (checklist) — only a status
    // acknowledgement; the client re-derives auth state from GET /auth/me afterward.
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(principal.sessionId, requestContext(req));
    clearSessionCookies(res);
    return { ok: true };
  }

  @Post("logout-all-devices")
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  async logoutAllDevices(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAllDevices(principal.user.id, requestContext(req));
    clearSessionCookies(res);
    return { ok: true };
  }

  @Post("refresh")
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[refreshCookieName];
    if (!refreshToken) {
      clearSessionCookies(res);
      return { ok: false };
    }
    const tokens = await this.authService.refresh(refreshToken, requestContext(req));
    setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Get("me")
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  async me(@CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>) {
    return { principal };
  }

  @Post("verify-email")
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(verifyEmailSchema))
  async verifyEmail(@Body() dto: VerifyEmailDto, @Req() req: Request) {
    const reason = await this.authService.verifyEmail(dto, requestContext(req));
    return { reason };
  }

  @Post("resend-verification")
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(resendVerificationSchema))
  async resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    await this.authService.resendVerification(dto.email, requestContext(req));
    return { message: "If an account needs verification, a new link has been sent." };
  }

  @Post("password-reset/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(requestPasswordResetSchema))
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    await this.authService.requestPasswordReset(dto, requestContext(req));
    return { message: "If an account exists for this email, a reset link has been sent." };
  }

  @Post("password-reset/confirm")
  @HttpCode(200)
  // Was previously unthrottled — a token-guessing attempt against this endpoint
  // had no rate limit at all. 10/60s matches the OTP/magic-link verify limits.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    await this.authService.resetPassword(dto, requestContext(req));
    return { ok: true };
  }

  @Post("otp/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(requestOtpSchema))
  async requestOtp(@Body() dto: RequestOtpDto, @Req() req: Request) {
    await this.authService.requestOtp(dto, requestContext(req));
    return { message: "If an account exists for this email, a code has been sent." };
  }

  @Post("otp/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(verifyOtpSchema))
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyOtp(
      dto,
      requestContext(req),
      this.resolveExistingSessionId(req),
    );
    setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Post("magic-link/request")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(requestMagicLinkSchema))
  async requestMagicLink(@Body() dto: RequestMagicLinkDto, @Req() req: Request) {
    await this.authService.requestMagicLink(dto, requestContext(req));
    return { message: "If an account exists for this email, a sign-in link has been sent." };
  }

  @Post("magic-link/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(verifyMagicLinkSchema))
  async verifyMagicLink(
    @Body() dto: VerifyMagicLinkDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.verifyMagicLink(
      dto,
      requestContext(req),
      this.resolveExistingSessionId(req),
    );
    setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Get("sessions")
  @UseGuards(SessionGuard)
  async listSessions(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
  ) {
    const sessions = await this.authService.listSessions(principal.user.id);
    // Never return refreshTokenHash/rotatedToSessionId — the device/session list is
    // a frontend-facing view, not a dump of every internal row field.
    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        current: session.id === principal.sessionId,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt,
      })),
    };
  }

  @Delete("sessions/:id")
  @UseGuards(SessionGuard, CsrfGuard)
  async revokeSession(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    await this.authService.revokeSession(principal.user.id, id, requestContext(req));
    return { ok: true };
  }

  @Post("sessions/revoke-others")
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  async revokeOtherSessions(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Req() req: Request,
  ) {
    await this.authService.revokeOtherSessions(
      principal.user.id,
      principal.sessionId,
      requestContext(req),
    );
    return { ok: true };
  }

  @Post("change-password")
  @HttpCode(200)
  @UseGuards(SessionGuard, CsrfGuard)
  @UsePipes(new ZodValidationPipe(changePasswordSchema))
  async changePassword(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.authService.changePassword(
      principal.user.id,
      principal.sessionId,
      dto,
      requestContext(req),
    );
    return { ok: true };
  }
}
