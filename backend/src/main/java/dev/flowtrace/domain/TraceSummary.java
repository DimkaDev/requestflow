package dev.flowtrace.domain;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record TraceSummary(
        String id,
        UUID projectId,
        Instant startedAt,
        Instant lastEventAt,
        boolean ended,
        String status,
        int eventCount,
        String lastNode
) {
    public record TraceEventRecord(
            long id,
            UUID projectId,
            String traceId,
            String branch,
            String fromNode,
            String node,
            EventType type,
            String label,
            Map<String, Object> attrs,
            Long clientTs,
            Instant serverTs,
            Long seq
    ) {
    }

    public record TraceDetail(
            TraceSummary summary,
            List<TraceEventRecord> events
    ) {
    }
}
