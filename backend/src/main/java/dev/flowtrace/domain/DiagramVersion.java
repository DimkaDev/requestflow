package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

public record DiagramVersion(
        UUID id,
        UUID projectId,
        int version,
        DiagramGraph graph,
        Instant createdAt,
        String authorEmail,
        String changeSummary
) {
    public DiagramVersion(UUID id, UUID projectId, int version, DiagramGraph graph, Instant createdAt) {
        this(id, projectId, version, graph, createdAt, "dev@flowtrace.local", "Published diagram");
    }
}
