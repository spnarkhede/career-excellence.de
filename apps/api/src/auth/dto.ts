import { createZodDto } from "./zod-dto.js";
import {
  changePasswordSchema,
  loginSchema,
  oauthSubmitPendingEmailSchema,
  oauthVerifyPendingEmailSchema,
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

export class SignUpDto extends createZodDto(signUpSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RequestPasswordResetDto extends createZodDto(requestPasswordResetSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
export class RequestOtpDto extends createZodDto(requestOtpSchema) {}
export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
export class RequestMagicLinkDto extends createZodDto(requestMagicLinkSchema) {}
export class VerifyMagicLinkDto extends createZodDto(verifyMagicLinkSchema) {}
export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}
export class OAuthSubmitPendingEmailDto extends createZodDto(oauthSubmitPendingEmailSchema) {}
export class OAuthVerifyPendingEmailDto extends createZodDto(oauthVerifyPendingEmailSchema) {}
