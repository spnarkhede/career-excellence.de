import type { NextFunction, Request, Response } from "express";

/** Redirects plain-HTTP requests to HTTPS. Only active when isProduction is true, and trusts
 * X-Forwarded-Proto since the app sits behind a load balancer/reverse proxy in production. */
export function createHttpsRedirectMiddleware(isProduction: boolean) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isProduction) {
      next();
      return;
    }
    if (req.secure || req.header("x-forwarded-proto") === "https") {
      next();
      return;
    }
    res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
  };
}
