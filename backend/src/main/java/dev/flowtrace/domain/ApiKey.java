package dev.flowtrace.domain;

import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.UUID;

/**
 * Pure Java 21 domain record for API Keys with scoped access, GDPR-compliant IP tracking and rotation grace period.
 */
public record ApiKey(
        UUID id,
        UUID projectId,
        String name,
        String keyPrefix,
        String keyHash,
        int rateLimitPerS,
        String scopes,
        String lastIpHash,
        Instant createdAt,
        Instant lastUsedAt,
        Instant revokedAt,
        Instant expiresAt
) {
    public ApiKey(
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
        this(id, projectId, name, keyPrefix, keyHash, rateLimitPerS, "ingest", null, createdAt, lastUsedAt, revokedAt, null);
    }

    public boolean isActive() {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(Instant.now()));
    }

    public boolean hasScope(String requiredScope) {
        if (requiredScope == null || requiredScope.isBlank()) {
            return true;
        }
        if (scopes == null || scopes.isBlank()) {
            return "ingest".equalsIgnoreCase(requiredScope);
        }
        String req = requiredScope.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(scopes.split("[,;\\s]+"))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .anyMatch(s -> s.equals("*") || s.equals("admin") || s.equals(req));
    }
}
