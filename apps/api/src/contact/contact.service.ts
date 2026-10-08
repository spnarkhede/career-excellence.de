import { BadRequestException, Injectable } from "@nestjs/common";
import { loadPrivateEnv } from "@saas/config";
import { logger, recordAuthMetric } from "@saas/observability";
import type { ContactFormInput } from "@saas/validation";
import { verifyTurnstileToken } from "./turnstile.js";

const env = loadPrivateEnv();

export interface ContactRequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
}

/**
 * Phase 14 task 9 ("spam protection on public forms"). Every rejection path
 * below throws the EXACT same `SPAM_REJECTED` shape — a bot (or curious
 * attacker) probing this endpoint can never tell which specific signal it
 * tripped, which is the whole point: a distinguishable response ("honeypot
 * filled" vs "too fast" vs "bad challenge") would just teach it what to
 * avoid next time.
 */
@Injectable()
export class ContactService {
  async submit(input: ContactFormInput, ctx: ContactRequestContext): Promise<void> {
    // Honeypot: a real browser never fills `website` (hidden via CSS, not
    // `type="hidden"`, which some bots skip deliberately — see the form).
    if (input.website) {
      recordSpamRejection("honeypot");
      throw spamRejected();
    }

    // Minimum fill time: a bot that submits the instant the page's HTML
    // loads (no rendering/typing delay at all) is rejected.
    const elapsedMs = Date.now() - input.renderedAt;
    if (elapsedMs < env.CONTACT_FORM_MIN_FILL_TIME_MS) {
      recordSpamRejection("too_fast");
      throw spamRejected();
    }

    const turnstileOk = await verifyTurnstileToken(input.turnstileToken);
    if (!turnstileOk) {
      recordSpamRejection("challenge_failed");
      throw spamRejected();
    }

    // No email delivery is wired up in this environment (no real email
    // provider is configured — see docs/auth/COMPONENTS.md) — logging the
    // submission (never the message body, which could contain anything a
    // user typed) is the honest stand-in. A real deployment would enqueue
    // an email to a configured inbox here, through the same BullMQ queue
    // auth emails already use.
    logger.info(
      { event: "contact_form_submitted", requestId: ctx.requestId },
      "Contact form submitted",
    );
  }
}

function recordSpamRejection(reason: "honeypot" | "too_fast" | "challenge_failed"): void {
  recordAuthMetric("spam_rejected", { path: "/contact", reason });
}

function spamRejected(): BadRequestException {
  return new BadRequestException({
    code: "SPAM_REJECTED",
    message: "We couldn't submit your message right now. Please try again.",
  });
}
