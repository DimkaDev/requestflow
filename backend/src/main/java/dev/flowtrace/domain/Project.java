package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

public record Project(
        UUID id,
        UUID ownerId,
        String name,
        boolean autoDiscover,
        int retentionDays,
        Instant createdAt
) {
}
