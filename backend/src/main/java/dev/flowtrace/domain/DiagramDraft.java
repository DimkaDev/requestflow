package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

public record DiagramDraft(
        UUID projectId,
        int draftVersion,
        int basedOnVersion,
        DiagramGraph graph,
        String updatedBy,
        Instant updatedAt
) {
}
