import type { Request, Response } from "express";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { isInAppBrowser, OAuthProviderError, parseAppleUserField } from "@saas/auth";
import { loadPrivateEnv } from "@saas/config";
import { isAllowedRedirect } from "@saas/security";
import { oauthSubmitPendingEmailSchema, oauthVerifyPendingEmailSchema } from "@saas/validation";
import { CsrfGuard } from "../../common/csrf.guard.js";
import { ZodValidationPipe } from "../../common/zod-validation.pipe.js";
import { AuthService } from "../auth.service.js";
import { requestContext, setSessionCookies } from "../auth.controller.js";
import { sessionCookieName } from "../cookie-names.js";
import { CurrentPrincipal } from "../current-principal.decorator.js";
import type { OAuthSubmitPendingEmailDto, OAuthVerifyPendingEmailDto } from "../dto.js";
import type { PrincipalService } from "../principal.service.js";
import { SessionGuard } from "../session.guard.js";
import {
  consumeOAuthStateCookie,
  setOAuthStateCookie,
  type OAuthStateCookiePayload,
} from "./oauth-state.js";
import { OAuthService, type OAuthCallbackResult } from "./oauth.service.js";

const env = loadPrivateEnv();

function resolveNext(next: string | undefined): string | undefined {
  if (!next) return undefined;
  const allowed = [env.WEB_APP_URL ?? ""].filter(Boolean);
  return isAllowedRedirect(next, allowed) ? next : undefined;
}

/** Renders a minimal, dependency-free HTML page — used only for the in-app-
 * browser warning and the no-JS callback-failure fallback, both of which must
 * work before any frontend bundle has loaded. */
function htmlPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
}

function errorRedirectUrl(code: string): string {
  const base = env.WEB_APP_URL || "";
  return `${base}/oauth/error?code=${encodeURIComponent(code)}`;
}

@ApiTags("oauth")
@Controller("auth/oauth")
export class OAuthController {
  constructor(
    private oauthService: OAuthService,
    private authService: AuthService,
  ) {}

  @Get("providers")
  async listProviders() {
    return { providers: await this.oauthService.listRegisteredProviders() };
  }

  @Get(":provider/start")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async start(
    @Param("provider") provider: string,
    @Query("mode") modeParam: string | undefined,
    @Query("next") next: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const mode = modeParam === "link" ? "link" : "login";

    // Checklist 4.1 (Google) / generically useful for any provider that
    // restricts embedded webviews: detect an in-app browser BEFORE ever
    // redirecting to the provider, and show a plain "open in your browser"
    // page instead — a real redirect would just bounce back with a
    // provider-side rejection the user can't recover from in-place.
    if (isInAppBrowser(req.get("user-agent"))) {
      res
        .status(200)
        .type("html")
        .send(
          htmlPage(
            "Open in your browser",
            "<p>For your security, sign-in isn't available inside this app's built-in browser.</p>" +
              "<p>Please open this page in Chrome, Safari, or another full browser, then try again.</p>",
          ),
        );
      return;
    }

    let linkUserId: string | undefined;
    if (mode === "link") {
      // Linking requires an already-authenticated caller — resolved the same
      // way SessionGuard would (full signature/claims verification via
      // AuthService, never a bare decode), without pulling the guard itself
      // in (a guard can't conditionally apply only when mode === "link" on
      // one shared route).
      const token = req.cookies?.[sessionCookieName];
      if (!token) {
        res.redirect(302, errorRedirectUrl("link_session_missing"));
        return;
      }
      try {
        linkUserId = this.authService.verifyAccessToken(token).userId;
      } catch {
        res.redirect(302, errorRedirectUrl("link_session_missing"));
        return;
      }
    }

    let result;
    try {
      result = await this.oauthService.startAuthorization(provider);
    } catch {
      res.redirect(302, errorRedirectUrl("provider_not_configured"));
      return;
    }

    setOAuthStateCookie(
      res,
      {
        provider,
        state: result.state,
        codeVerifier: result.codeVerifier,
        nonce: result.nonce,
        mode,
        linkUserId,
        next: resolveNext(next),
      },
      result.sameSite,
    );
    res.redirect(302, result.authorizationUrl);
  }

  @Get(":provider/callback")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callbackGet(
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.handleCallback(provider, { code, state, error }, null, req, res);
  }

  // Apple only — checklist 4.2: "web callbacks arrive as a cross site POST
  // (form_post)."
  @Post(":provider/callback")
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async callbackPost(
    @Param("provider") provider: string,
    @Body() body: { code?: string; state?: string; error?: string; user?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const appleDisplayName = parseAppleUserField(body.user);
    await this.handleCallback(provider, body, appleDisplayName, req, res);
  }

  private async handleCallback(
    provider: string,
    params: { code?: string; state?: string; error?: string },
    appleDisplayName: string | null,
    req: Request,
    res: Response,
  ): Promise<void> {
    const cookie = consumeOAuthStateCookie(req, res);

    // Checklist "OAuth cancellation": the provider itself reports the user
    // declined consent — a distinct, friendly state from any other failure.
    if (params.error === "access_denied") {
      res.redirect(302, errorRedirectUrl("cancelled"));
      return;
    }

    if (!cookie || cookie.provider !== provider) {
      res.redirect(302, errorRedirectUrl("state_missing"));
      return;
    }
    // Checklist "State validation" / explicit test "mismatched state":
    // compare the param against what THIS server set, never trust the
    // parameter alone.
    if (!params.state || params.state !== cookie.state) {
      res.redirect(302, errorRedirectUrl("state_mismatch"));
      return;
    }
    if (!params.code) {
      res.redirect(302, errorRedirectUrl("missing_code"));
      return;
    }

    const result = await this.oauthService.handleCallback({
      provider,
      code: params.code,
      codeVerifier: cookie.codeVerifier,
      nonce: cookie.nonce,
      mode: cookie.mode,
      linkUserId: cookie.linkUserId,
      appleDisplayName,
      ctx: requestContext(req),
    });

    this.redirectForResult(result, cookie, res);
  }

  private redirectForResult(
    result: OAuthCallbackResult,
    cookie: OAuthStateCookiePayload,
    res: Response,
  ): void {
    const base = env.WEB_APP_URL || "";
    if (result.kind === "signed_in") {
      setSessionCookies(res, result.tokens);
      res.redirect(302, cookie.next ?? `${base}/dashboard`);
      return;
    }
    if (result.kind === "linked") {
      res.redirect(302, `${base}/dashboard/connected-accounts?linked=1`);
      return;
    }
    if (result.kind === "pending_email") {
      res.redirect(
        302,
        `${base}/oauth/verify-email?token=${encodeURIComponent(result.lookupToken)}`,
      );
      return;
    }
    res.redirect(302, errorRedirectUrl(result.code));
  }

  @Post("pending/submit-email")
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(oauthSubmitPendingEmailSchema))
  async submitPendingEmail(@Body() dto: OAuthSubmitPendingEmailDto, @Req() req: Request) {
    await this.oauthService.submitPendingEmail(dto.lookupToken, dto.email, requestContext(req));
    return { message: "If that link is still valid, a code has been sent." };
  }

  @Post("pending/verify")
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(oauthVerifyPendingEmailSchema))
  async verifyPendingEmail(
    @Body() dto: OAuthVerifyPendingEmailDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.oauthService.confirmPendingEmail(
      dto.lookupToken,
      dto.code,
      requestContext(req),
    );
    if (result.kind === "signed_in") {
      setSessionCookies(res, result.tokens);
      return { ok: true };
    }
    return { ok: false, code: result.kind === "error" ? result.code : "unexpected" };
  }

  @Get("accounts")
  @UseGuards(SessionGuard)
  async listAccounts(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
  ) {
    return { accounts: await this.oauthService.listLinkedAccounts(principal.user.id) };
  }

  @Delete("accounts/:provider")
  @UseGuards(SessionGuard, CsrfGuard)
  async unlinkAccount(
    @CurrentPrincipal() principal: Awaited<ReturnType<PrincipalService["resolve"]>>,
    @Param("provider") provider: string,
    @Req() req: Request,
  ) {
    try {
      await this.oauthService.unlinkAccount(principal.user.id, provider, requestContext(req));
    } catch (err) {
      if (err instanceof OAuthProviderError) {
        throw new BadRequestException({ code: err.code, message: err.message });
      }
      throw err;
    }
    return { ok: true };
  }

  // Checklist 8 ("Logout ends the local session"): deliberately NOT a new
  // endpoint here — a session created via an OAuth login is a plain Session
  // row like any other, so the existing `POST /auth/logout`
  // (AuthController, Phase 5) already revokes it identically regardless of
  // which flow created it. A second logout route here would only risk
  // drifting out of sync with that one (e.g. forgetting to revoke the
  // session row, only clearing cookies) — see docs/auth/COMPONENTS.md for
  // the documented provider-session behavior per provider (this app never
  // attempts to end the PROVIDER's own SSO session, only its own).
}
