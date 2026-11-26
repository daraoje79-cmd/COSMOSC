import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

export const uploadBurstLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "rl:upload:burst",
    })
  : null;

export const uploadDailyLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(200, "1 d"),
      prefix: "rl:upload:daily",
    })
  : null;

// Returns true when the request is allowed. If Redis is down or not
// configured, we allow the request rather than block every creator.
export async function allow(limiter: Ratelimit | null, key: string) {
  if (!limiter) return true;
  try {
    const result = await limiter.limit(key);
    return result.success;
  } catch {
    return true;
  }
}