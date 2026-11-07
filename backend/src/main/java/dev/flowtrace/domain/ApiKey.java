package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

public record ApiKey(
        UUID id,
        UUID projectId,
        String name,
        String keyPrefix,
        String keyHash,
        int rateLimitPerS,
        Instant createdAt,
        Instant lastUsedAt,
        Instant revokedAt
) {
    public boolean isActive() {
        return revokedAt == null;
    }
}
