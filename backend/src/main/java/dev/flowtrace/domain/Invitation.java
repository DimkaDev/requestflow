package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Organization invitation token with a 7-day TTL and SHA-256 token_hash storage (E1-Step-3, E1-Step-5).
 * Plaintext {@code token} is populated only once on creation or resend; subsequent reads return {@code token = null}
 * alongside {@code tokenPrefix} and {@code tokenHash}.
 */
public record Invitation(
        UUID id,
        UUID organizationId,
        String email,
        OrgRole role,
        String token,
        String tokenPrefix,
        String tokenHash,
        String status,
        UUID invitedBy,
        Instant expiresAt,
        Instant createdAt
) {
    public static final long DEFAULT_TTL_SECONDS = 7L * 24 * 3600;

    public Invitation(
            UUID id,
            UUID organizationId,
            String email,
            OrgRole role,
            String token,
            String status,
            UUID invitedBy,
            Instant expiresAt,
            Instant createdAt
    ) {
        this(
                id,
                organizationId,
                email,
                role,
                token,
                token != null && token.length() >= 14 ? token.substring(0, 14) : token,
                token != null ? ApiKeyCrypto.sha256Hex(token) : null,
                status,
                invitedBy,
                expiresAt,
                createdAt
        );
    }

    public Invitation withOneTimeToken(String rawToken) {
        return new Invitation(
                id,
                organizationId,
                email,
                role,
                rawToken,
                tokenPrefix,
                tokenHash,
                status,
                invitedBy,
                expiresAt,
                createdAt
        );
    }

    public boolean isExpired(Instant now) {
        return expiresAt != null && expiresAt.isBefore(now);
    }

    public boolean isPending(Instant now) {
        return "PENDING".equalsIgnoreCase(status) && !isExpired(now);
    }
}
