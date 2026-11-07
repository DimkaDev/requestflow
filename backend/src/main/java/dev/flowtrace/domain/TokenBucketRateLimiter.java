package dev.flowtrace.domain;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pure Java token-bucket rate limiter per API key (spec section 5.4: default 1000 events/s, burst 2000).
 */
public final class TokenBucketRateLimiter {

    private static final class Bucket {
        private double tokens;
        private long lastRefillNanos;
        private final double ratePerSecond;
        private final double burst;

        Bucket(double ratePerSecond, double burst, long nowNanos) {
            this.ratePerSecond = ratePerSecond;
            this.burst = burst;
            this.tokens = burst;
            this.lastRefillNanos = nowNanos;
        }

        synchronized boolean tryAcquire(long nowNanos) {
            long elapsedNanos = Math.max(0L, nowNanos - lastRefillNanos);
            double refill = (elapsedNanos / 1_000_000_000.0) * ratePerSecond;
            if (refill > 0) {
                tokens = Math.min(burst, tokens + refill);
                lastRefillNanos = nowNanos;
            }
            if (tokens >= 1.0) {
                tokens -= 1.0;
                return true;
            }
            return false;
        }
    }

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public boolean tryAcquire(String keyId, int rateLimitPerSecond) {
        return tryAcquire(keyId, rateLimitPerSecond, Math.max(rateLimitPerSecond * 2, 1), System.nanoTime());
    }

    public boolean tryAcquire(String keyId, int rateLimitPerSecond, int burst, long nowNanos) {
        int rate = rateLimitPerSecond > 0 ? rateLimitPerSecond : 1000;
        int maxBurst = burst > 0 ? burst : rate * 2;
        Bucket bucket = buckets.computeIfAbsent(keyId, k -> new Bucket(rate, maxBurst, nowNanos));
        return bucket.tryAcquire(nowNanos);
    }
}
