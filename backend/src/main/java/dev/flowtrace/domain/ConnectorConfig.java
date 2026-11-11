package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Connector configuration & operational status (Gate G1-E / E20-10).
 * Framework-free pure Java domain record.
 */
public record ConnectorConfig(
        UUID id,
        UUID projectId,
        String name,
        ConnectorType type,
        String tokenPrefix,
        String tokenHash,
        WebhookMapping mapping,
        ConnectorStatus status,
        Instant lastEventAt,
        long totalEvents,
        String lastError,
        Instant createdAt,
        Instant updatedAt
) {
    public static ConnectorConfig create(
            UUID projectId,
            String name,
            ConnectorType type,
            String tokenPrefix,
            String tokenHash,
            WebhookMapping mapping
    ) {
        Instant now = Instant.now();
        return new ConnectorConfig(
                UUID.randomUUID(),
                projectId,
                name,
                type,
                tokenPrefix,
                tokenHash,
                mapping != null ? mapping : WebhookMapping.genericPreset(),
                ConnectorStatus.WAITING,
                null,
                0L,
                null,
                now,
                now
        );
    }
}
