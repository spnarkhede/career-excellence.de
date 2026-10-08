import type { Request } from "express";
import { Body, Controller, HttpCode, Post, Req, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { contactFormSchema } from "@saas/validation";
import { requestContext } from "../auth/auth.controller.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { ContactFormDto } from "./dto.js";
import { ContactService } from "./contact.service.js";

@ApiTags("contact")
@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @HttpCode(200)
  // Checklist "spam protection... rate limits" — a generous-but-real limit;
  // the honeypot/timing/challenge checks inside ContactService are the
  // primary defense, this is a backstop against sheer volume.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe(contactFormSchema))
  async submit(@Body() dto: ContactFormDto, @Req() req: Request) {
    await this.contactService.submit(dto, requestContext(req));
    return { ok: true };
  }
}
