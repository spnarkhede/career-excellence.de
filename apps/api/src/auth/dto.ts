import { createZodDto } from "./zod-dto.js";
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

export class SignUpDto extends createZodDto(signUpSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class RequestPasswordResetDto extends createZodDto(requestPasswordResetSchema) {}
export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}
export class VerifyEmailDto extends createZodDto(verifyEmailSchema) {}
export class ResendVerificationDto extends createZodDto(resendVerificationSchema) {}
export class RequestOtpDto extends createZodDto(requestOtpSchema) {}
export class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
