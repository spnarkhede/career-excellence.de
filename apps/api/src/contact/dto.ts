import { createZodDto } from "../auth/zod-dto.js";
import { contactFormSchema } from "@saas/validation";

export class ContactFormDto extends createZodDto(contactFormSchema) {}
