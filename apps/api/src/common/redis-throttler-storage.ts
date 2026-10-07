import { Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
// Not re-exported from the package's top-level index — only from this deep path.
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface.js";
import type Redis from "ioredis";

/**
 * Redis-backed rate-limit storage. `@nestjs/throttler`'s default `ThrottlerStorage`
 * keeps counters in process memory — useless the moment there's more than one API
 * instance, and lost entirely on every restart. The Phase 5 spec is explicit: rate
 * limiting and lockout must live in "a shared store (Redis or database), never
 * process memory" — this is that shared store for every `@Throttle`-guarded route,
 * not only login.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:hits:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;

    const blockTtlMs = await this.redis.pttl(blockKey);
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
      };
    }

    const totalHits = await this.redis.incr(hitKey);
    if (totalHits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }
    const hitTtlMs = await this.redis.pttl(hitKey);
    const timeToExpire = Math.ceil(Math.max(hitTtlMs, 0) / 1000);

    let isBlocked = false;
    let timeToBlockExpire = 0;
    if (totalHits > limit) {
      isBlocked = true;
      if (blockDuration > 0) {
        await this.redis.set(blockKey, "1", "PX", blockDuration);
        timeToBlockExpire = Math.ceil(blockDuration / 1000);
      } else {
        timeToBlockExpire = timeToExpire;
      }
    }

    return { totalHits, timeToExpire, isBlocked, timeToBlockExpire };
  }
}
