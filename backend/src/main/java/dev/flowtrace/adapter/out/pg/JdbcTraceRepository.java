package dev.flowtrace.adapter.out.pg;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.port.out.TraceRepository;
import dev.flowtrace.domain.CheckpointEvent;
import dev.flowtrace.domain.EventType;
import dev.flowtrace.domain.TraceSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.quarkus.scheduler.Scheduled;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.TimeUnit;

/**
 * Asynchronous batched trace writer + search/replay repository (spec section 8).
 * Writes are queued in a bounded queue and flushed every 250ms or 500 events.
 * The live ingest path never waits for the DB.
 */
@ApplicationScoped
public class JdbcTraceRepository implements TraceRepository {

    private record PendingWrite(UUID projectId, String resolvedFromNode, CheckpointEvent event) {
    }

    private static final int MAX_QUEUE_CAPACITY = 20_000;
    private static final int BATCH_FLUSH_SIZE = 500;

    private final javax.sql.DataSource dataSource;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final BlockingQueue<PendingWrite> writeQueue = new ArrayBlockingQueue<>(MAX_QUEUE_CAPACITY);

    @Inject
    public JdbcTraceRepository(javax.sql.DataSource dataSource, ObjectMapper objectMapper, MeterRegistry meterRegistry) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
    }

    @Override
    public void enqueueAsync(UUID projectId, String resolvedFromNode, CheckpointEvent event) {
        boolean offered = writeQueue.offer(new PendingWrite(projectId, resolvedFromNode, event));
        if (!offered) {
            meterRegistry.counter("ingest_dropped_total", "protocol", "db_queue", "reason", "buffer_full").increment();
        }
    }

    @Scheduled(every = "PT0.25S", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledFlush() {
        if (!writeQueue.isEmpty()) {
            flushNow();
        }
    }

    @PreDestroy
    void onShutdown() {
        flushNow();
    }

    @Override
    public synchronized void flushNow() {
        if (writeQueue.isEmpty()) {
            return;
        }
        long startNanos = System.nanoTime();
        List<PendingWrite> batch = new ArrayList<>(BATCH_FLUSH_SIZE);
        while (!writeQueue.isEmpty()) {
            batch.clear();
            writeQueue.drainTo(batch, BATCH_FLUSH_SIZE);
            if (batch.isEmpty()) {
                break;
            }
            persistBatch(batch);
        }
        Timer.builder("db_flush_seconds")
                .register(meterRegistry)
                .record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
    }

    private void persistBatch(List<PendingWrite> batch) {
        String insertEventSql = """
                INSERT INTO trace_events
                (project_id, trace_id, branch, from_node, node, type, label, attrs, client_ts, server_ts, seq)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;

        try (Connection conn = dataSource.getConnection()) {
            boolean oldAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(false);
            try (PreparedStatement eventPs = conn.prepareStatement(insertEventSql)) {
                for (PendingWrite item : batch) {
                    CheckpointEvent ev = item.event();
                    Instant serverInstant = Instant.ofEpochMilli(ev.serverTs());
                    String attrsJson = (ev.attrs() == null || ev.attrs().isEmpty())
                            ? "{}"
                            : objectMapper.writeValueAsString(ev.attrs());

                    eventPs.setObject(1, item.projectId());
                    eventPs.setString(2, ev.traceId());
                    eventPs.setString(3, ev.branch());
                    if (item.resolvedFromNode() != null) {
                        eventPs.setString(4, item.resolvedFromNode());
                    } else {
                        eventPs.setNull(4, Types.VARCHAR);
                    }
                    eventPs.setString(5, ev.node());
                    eventPs.setString(6, ev.type().name());
                    if (ev.label() != null) {
                        eventPs.setString(7, ev.label());
                    } else {
                        eventPs.setNull(7, Types.VARCHAR);
                    }
                    eventPs.setString(8, attrsJson);
                    if (ev.clientTs() != null) {
                        eventPs.setLong(9, ev.clientTs());
                    } else {
                        eventPs.setNull(9, Types.BIGINT);
                    }
                    eventPs.setTimestamp(10, Timestamp.from(serverInstant));
                    if (ev.seq() != null) {
                        eventPs.setLong(11, ev.seq());
                    } else {
                        eventPs.setNull(11, Types.BIGINT);
                    }
                    eventPs.addBatch();

                    upsertTraceSummary(conn, item.projectId(), ev, serverInstant);
                }
                eventPs.executeBatch();
                conn.commit();
            } catch (Exception e) {
                conn.rollback();
            } finally {
                conn.setAutoCommit(oldAutoCommit);
            }
        } catch (SQLException ignored) {
        }
    }

    private void upsertTraceSummary(Connection conn, UUID projectId, CheckpointEvent ev, Instant serverInstant) throws SQLException {
        String updateSql = """
                UPDATE traces
                SET last_event_at = ?,
                    ended = CASE WHEN ? THEN TRUE ELSE ended END,
                    status = CASE WHEN ? = 'error' THEN 'error' ELSE status END,
                    event_count = event_count + 1,
                    last_node = ?
                WHERE project_id = ? AND id = ?
                """;
        boolean isEnd = (ev.type() == EventType.end);
        String newStatus = (ev.type() == EventType.error) ? "error" : "ok";

        try (PreparedStatement upd = conn.prepareStatement(updateSql)) {
            upd.setTimestamp(1, Timestamp.from(serverInstant));
            upd.setBoolean(2, isEnd);
            upd.setString(3, newStatus);
            upd.setString(4, ev.node());
            upd.setObject(5, projectId);
            upd.setString(6, ev.traceId());
            int rows = upd.executeUpdate();
            if (rows == 0) {
                String insertSql = """
                        INSERT INTO traces (id, project_id, started_at, last_event_at, ended, status, event_count, last_node)
                        VALUES (?, ?, ?, ?, ?, ?, 1, ?)
                        """;
                try (PreparedStatement ins = conn.prepareStatement(insertSql)) {
                    ins.setString(1, ev.traceId());
                    ins.setObject(2, projectId);
                    ins.setTimestamp(3, Timestamp.from(serverInstant));
                    ins.setTimestamp(4, Timestamp.from(serverInstant));
                    ins.setBoolean(5, isEnd);
                    ins.setString(6, newStatus);
                    ins.setString(7, ev.node());
                    ins.executeUpdate();
                } catch (SQLException duplicateIgnored) {
                    // Concurrent insert fallback
                }
            }
        }
    }

    @Override
    public List<TraceSummary> searchTraces(
            UUID projectId,
            Instant from,
            Instant to,
            String status,
            String node,
            int limit,
            String cursor
    ) {
        flushNow();
        StringBuilder sql = new StringBuilder("""
                SELECT id, project_id, started_at, last_event_at, ended, status, event_count, last_node
                FROM traces t
                WHERE t.project_id = ?
                """);
        List<Object> params = new ArrayList<>();
        params.add(projectId);

        if (from != null) {
            sql.append(" AND t.started_at >= ?");
            params.add(Timestamp.from(from));
        }
        if (to != null) {
            sql.append(" AND t.last_event_at <= ?");
            params.add(Timestamp.from(to));
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND t.status = ?");
            params.add(status.trim().toLowerCase());
        }
        if (cursor != null && !cursor.isBlank()) {
            sql.append(" AND t.id LIKE ?");
            params.add(cursor.trim().toLowerCase() + "%");
        }
        if (node != null && !node.isBlank()) {
            sql.append(" AND EXISTS (SELECT 1 FROM trace_events te WHERE te.project_id = t.project_id AND te.trace_id = t.id AND (te.node = ? OR te.from_node = ?))");
            params.add(node.trim());
            params.add(node.trim());
        }

        int safeLimit = Math.clamp(limit <= 0 ? 50 : limit, 1, 200);
        sql.append(" ORDER BY t.last_event_at DESC LIMIT ").append(safeLimit);

        List<TraceSummary> results = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    results.add(mapTraceSummary(rs));
                }
            }
            return results;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to search traces", e);
        }
    }

    @Override
    public Optional<TraceSummary.TraceDetail> findTraceDetail(UUID projectId, String traceId) {
        flushNow();
        String summarySql = "SELECT id, project_id, started_at, last_event_at, ended, status, event_count, last_node FROM traces WHERE project_id = ? AND id = ?";
        String eventsSql = "SELECT id, project_id, trace_id, branch, from_node, node, type, label, attrs, client_ts, server_ts, seq FROM trace_events WHERE project_id = ? AND trace_id = ? ORDER BY server_ts ASC, id ASC";

        try (Connection conn = dataSource.getConnection()) {
            TraceSummary summary;
            try (PreparedStatement ps = conn.prepareStatement(summarySql)) {
                ps.setObject(1, projectId);
                ps.setString(2, traceId.toLowerCase());
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        return Optional.empty();
                    }
                    summary = mapTraceSummary(rs);
                }
            }

            List<TraceSummary.TraceEventRecord> events = new ArrayList<>();
            try (PreparedStatement ps = conn.prepareStatement(eventsSql)) {
                ps.setObject(1, projectId);
                ps.setString(2, traceId.toLowerCase());
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        String attrsJson = rs.getString("attrs");
                        Map<String, Object> attrs = Collections.emptyMap();
                        if (attrsJson != null && !attrsJson.isBlank()) {
                            try {
                                attrs = objectMapper.readValue(attrsJson, new TypeReference<>() {
                                });
                            } catch (Exception ignored) {
                            }
                        }
                        long clientTsVal = rs.getLong("client_ts");
                        Long clientTs = rs.wasNull() ? null : clientTsVal;
                        long seqVal = rs.getLong("seq");
                        Long seq = rs.wasNull() ? null : seqVal;

                        events.add(new TraceSummary.TraceEventRecord(
                                rs.getLong("id"),
                                UUID.fromString(rs.getString("project_id")),
                                rs.getString("trace_id"),
                                rs.getString("branch"),
                                rs.getString("from_node"),
                                rs.getString("node"),
                                EventType.fromString(rs.getString("type")),
                                rs.getString("label"),
                                attrs,
                                clientTs,
                                rs.getTimestamp("server_ts").toInstant(),
                                seq
                        ));
                    }
                }
            }

            return Optional.of(new TraceSummary.TraceDetail(summary, events));
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to fetch trace detail", e);
        }
    }

    @Scheduled(every = "6h", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledPurgeExpiredTraces() {
        purgeExpiredTraces();
    }

    @Override
    public int purgeExpiredTraces() {
        flushNow();
        int totalDeleted = 0;
        String selectProjects = "SELECT id, retention_days FROM projects";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(selectProjects);
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                UUID projectId = UUID.fromString(rs.getString("id"));
                int days = Math.max(1, rs.getInt("retention_days"));
                Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
                try (PreparedStatement delEv = conn.prepareStatement("DELETE FROM trace_events WHERE project_id = ? AND server_ts < ?");
                     PreparedStatement delTr = conn.prepareStatement("DELETE FROM traces WHERE project_id = ? AND last_event_at < ?")) {
                    delEv.setObject(1, projectId);
                    delEv.setTimestamp(2, Timestamp.from(cutoff));
                    delEv.executeUpdate();

                    delTr.setObject(1, projectId);
                    delTr.setTimestamp(2, Timestamp.from(cutoff));
                    totalDeleted += delTr.executeUpdate();
                }
            }
        } catch (SQLException ignored) {
        }
        return totalDeleted;
    }

    private TraceSummary mapTraceSummary(ResultSet rs) throws SQLException {
        return new TraceSummary(
                rs.getString("id"),
                UUID.fromString(rs.getString("project_id")),
                rs.getTimestamp("started_at").toInstant(),
                rs.getTimestamp("last_event_at").toInstant(),
                rs.getBoolean("ended"),
                rs.getString("status"),
                rs.getInt("event_count"),
                rs.getString("last_node")
        );
    }
}
