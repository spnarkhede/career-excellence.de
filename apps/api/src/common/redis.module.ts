import { Module } from "@nestjs/common";
import { loadPrivateEnv } from "@saas/config";
import Redis from "ioredis";

export const REDIS_CLIENT = Symbol("REDIS_CLIENT");

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => new Redis(loadPrivateEnv().REDIS_URL, { maxRetriesPerRequest: null }),
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
