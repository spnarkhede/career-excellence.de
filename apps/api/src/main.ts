import "reflect-metadata";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { loadPrivateEnv } from "@saas/config";
import { logger } from "@saas/observability";
import { AppModule } from "./app.module.js";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.js";
import { buildCorsOptions } from "./common/cors.js";
import { createHttpsRedirectMiddleware } from "./common/https-redirect.middleware.js";
import { RequestIdMiddleware } from "./common/request-id.middleware.js";
import { createSecurityHeadersMiddleware } from "./common/security-headers.middleware.js";

// Registered before bootstrap so a crash during startup is still logged safely (with
// secret redaction via the logger's deepRedact hook) rather than dumping a raw object
// to stderr or letting the process die silently.
process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});

async function bootstrap() {
  const env = loadPrivateEnv();
  const isProduction = env.APP_ENV === "production";

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Trust the load balancer's X-Forwarded-* headers in production so req.ip/req.protocol/
  // req.secure reflect the real client, not the proxy.
  app.set("trust proxy", isProduction ? 1 : false);

  app.use(new RequestIdMiddleware().use);
  app.use(createHttpsRedirectMiddleware(isProduction));
  app.use(cookieParser());
  app.use(
    helmet({
      // CSP, HSTS, and the other headers below are set explicitly by
      // createSecurityHeadersMiddleware (per-request nonce support, prod-only HSTS).
      contentSecurityPolicy: false,
      hsts: false,
    }),
  );
  app.use(createSecurityHeadersMiddleware({ isProduction }));

  const allowedOrigins = env.API_CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors(buildCorsOptions(allowedOrigins));

  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle("Platform API")
      .setDescription("Internal REST API for the application platform")
      .setVersion("0.1.0")
      .addCookieAuth(env.AUTH_SESSION_COOKIE_NAME)
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("docs", app, document);
  }

  await app.listen(env.API_PORT);
  logger.info(`API listening on port ${env.API_PORT} [${env.APP_ENV}]`);
}

bootstrap().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
