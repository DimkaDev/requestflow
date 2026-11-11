package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Logical environment or team Workspace within an Organization (TASK-1.1).
 */
public record Workspace(
        UUID id,
        UUID organizationId,
        String name,
        String slug,
        Instant createdAt
) {
    public static String slugify(String raw) {
        return Organization.slugify(raw);
    }
}
