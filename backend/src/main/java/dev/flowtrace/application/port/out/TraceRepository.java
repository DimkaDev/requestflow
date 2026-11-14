package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.CheckpointEvent;
import dev.flowtrace.domain.TraceSummary;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TraceRepository {

    /**
     * Enqueues a resolved checkpoint event for asynchronous batched persistence.
     * Never blocks the caller.
     */
    void enqueueAsync(UUID projectId, String resolvedFromNode, CheckpointEvent event);

    /**
     * Forces an immediate flush of pending batched events (useful for tests and graceful shutdown).
     */
    void flushNow();

    List<TraceSummary> searchTraces(
            UUID projectId,
            Instant from,
            Instant to,
            String status,
            String node,
            int limit,
            String cursor
    );

    Optional<TraceSummary.TraceDetail> findTraceDetail(UUID projectId, String traceId);

    long countNodeEventsSince(UUID projectId, String nodeKey, Instant since);

    List<TraceSummary.TraceEventRecord> findRecentNodeEvents(UUID projectId, String nodeKey, int limit);

    int purgeExpiredTraces();
}
