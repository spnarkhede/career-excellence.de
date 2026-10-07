import { Module } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import type Redis from "ioredis";
import { AuthModule } from "./auth/auth.module.js";
import { HealthModule } from "./health/health.module.js";
import { ProfileModule } from "./profile/profile.module.js";
import { REDIS_CLIENT, RedisModule } from "./common/redis.module.js";
import { RedisThrottlerStorage } from "./common/redis-throttler-storage.js";

@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      // Per-IP default (checklist: "20 per minute") — individual routes (e.g. login)
      // override this with their own @Throttle(). Backed by Redis (below), never
      // process memory, per the Phase 5 spec.
      useFactory: (redis: Redis) => ({
        throttlers: [{ ttl: 60_000, limit: 20 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
    HealthModule,
    AuthModule,
    ProfileModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
