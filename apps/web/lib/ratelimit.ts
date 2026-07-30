let ratelimitPromise: Promise<import('@upstash/ratelimit').Ratelimit | null> | null = null;

async function getRatelimit() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  if (!ratelimitPromise) {
    ratelimitPromise = (async () => {
      const { Ratelimit } = await import('@upstash/ratelimit');
      const { Redis } = await import('@upstash/redis');
      return new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
      });
    })();
  }

  return ratelimitPromise;
}

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const limiter = await getRatelimit();
  if (!limiter) return true;
  const { success } = await limiter.limit(identifier);
  return success;
}
