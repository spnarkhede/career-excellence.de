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
import {
  loginSchema,
  requestOtpSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signUpSchema,
  verifyEmailSchema,
  verifyOtpSchema,
} from "@saas/validation";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { AuthService, type IssuedTokens } from "./auth.service.js";
import { CurrentPrincipal } from "./current-principal.decorator.js";
import type {
  LoginDto,
  RequestOtpDto,
  RequestPasswordResetDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SignUpDto,
  VerifyEmailDto,
  VerifyOtpDto,
} from "./dto.js";
import { PrincipalService } from "./principal.service.js";
import { SessionGuard } from "./session.guard.js";

const env = loadPrivateEnv();

function requestContext(req: Request) {
  return {
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
    requestId: req.requestId ?? null,
  };
}

function setSessionCookies(res: Response, tokens: IssuedTokens) {
  const secure = env.APP_ENV !== "local";
  res.cookie(
    env.AUTH_SESSION_COOKIE_NAME,
    tokens.accessToken,
    sessionCookieOptions({
      domain: env.API_COOKIE_DOMAIN,
      secure,
      maxAgeSeconds: env.AUTH_ACCESS_TOKEN_TTL,
    }),
  );
  res.cookie(
    env.AUTH_REFRESH_COOKIE_NAME,
    tokens.refreshToken,
    sessionCookieOptions({
      domain: env.API_COOKIE_DOMAIN,
      secure,
      maxAgeSeconds: env.AUTH_REFRESH_TOKEN_TTL,
    }),
  );
}

function clearSessionCookies(res: Response) {
  res.clearCookie(env.AUTH_SESSION_COOKIE_NAME, { domain: env.API_COOKIE_DOMAIN, path: "/" });
  res.clearCookie(env.AUTH_REFRESH_COOKIE_NAME, { domain: env.API_COOKIE_DOMAIN, path: "/" });
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private principalService: PrincipalService,
  ) {}

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
    const tokens = await this.authService.login(dto, requestContext(req));
    setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Post("logout")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logout(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(principal.sessionId, requestContext(req));
    clearSessionCookies(res);
    return { ok: true };
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[env.AUTH_REFRESH_COOKIE_NAME];
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
    const tokens = await this.authService.verifyOtp(dto, requestContext(req));
    setSessionCookies(res, tokens);
    return { ok: true };
  }

  @Get("sessions")
  @UseGuards(SessionGuard)
  async listSessions(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
  ) {
    const sessions = await this.authService.listSessions(principal.user.id);
    return { sessions };
  }

  @Delete("sessions/:id")
  @UseGuards(SessionGuard)
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
  @UseGuards(SessionGuard)
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
}
