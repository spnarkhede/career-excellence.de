import { loadPublicEnv } from "@saas/config";

/**
 * Evaluated during both `next build` and request-time rendering, so a misconfigured
 * or secret-leaking public environment fails the build/startup loudly.
 */
export const publicEnv = loadPublicEnv();
