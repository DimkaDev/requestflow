package dev.flowtrace.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Immutable multi-tenant audit log record (E1-Step-8).
 */
public record AuditLogEntry(
        UUID id,
        UUID organizationId,
        UUID actorUserId,
        String actorEmail,
        String action,
        String targetType,
        String targetId,
        Map<String, Object> meta,
        Instant createdAt
) {
}
