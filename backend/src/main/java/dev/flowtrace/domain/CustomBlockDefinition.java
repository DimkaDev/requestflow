package dev.flowtrace.domain;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record CustomBlockDefinition(
        UUID id,
        UUID organizationId,
        String name,
        String category,
        NodeType nodeType,
        String role,
        String icon,
        String tint,
        String keyPattern,
        Map<String, Object> defaultProps,
        Instant createdAt
) {
}
