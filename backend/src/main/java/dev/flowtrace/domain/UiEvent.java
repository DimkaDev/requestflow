package dev.flowtrace.domain;

import java.util.List;
import java.util.Map;

/**
 * Real-time UI events streamed over WebSocket (spec section 7).
 */
public sealed interface UiEvent permits
        UiEvent.SnapshotEvent,
        UiEvent.SpawnEvent,
        UiEvent.HopEvent,
        UiEvent.EndEvent,
        UiEvent.DiagramPatchEvent,
        UiEvent.StatsEvent,
        UiEvent.DroppedEvent {

    String t();

    record ActiveTracePosition(String traceId, String branch, String node) {
    }

    record NodeMetric(long in, long errors) {
    }

    record EdgeMetric(long hops, long errors) {
    }

    record PatchOp(String op, DiagramGraph.DiagramNode node, DiagramGraph.DiagramEdge edge) {
        public static PatchOp addNode(DiagramGraph.DiagramNode node) {
            return new PatchOp("addNode", node, null);
        }

        public static PatchOp addEdge(DiagramGraph.DiagramEdge edge) {
            return new PatchOp("addEdge", null, edge);
        }
    }

    record SnapshotEvent(
            String t,
            DiagramGraph diagram,
            List<ActiveTracePosition> active,
            StatsEvent stats,
            long serverTime
    ) implements UiEvent {
        public SnapshotEvent(DiagramGraph diagram, List<ActiveTracePosition> active, StatsEvent stats, long serverTime) {
            this("snapshot", diagram, active, stats, serverTime);
        }
    }

    record SpawnEvent(
            String t,
            String traceId,
            String branch,
            String node,
            String status,
            String label,
            Map<String, Object> attrs,
            long ts
    ) implements UiEvent {
        public SpawnEvent(String traceId, String branch, String node, String status, String label, Map<String, Object> attrs, long ts) {
            this("spawn", traceId, branch, node, status, label, attrs, ts);
        }
    }

    record HopEvent(
            String t,
            String traceId,
            String branch,
            String from,
            String to,
            String edgeId,
            boolean unmapped,
            String status,
            String label,
            Map<String, Object> attrs,
            long ts,
            Long seq
    ) implements UiEvent {
        public HopEvent(
                String traceId,
                String branch,
                String from,
                String to,
                String edgeId,
                boolean unmapped,
                String status,
                String label,
                Map<String, Object> attrs,
                long ts,
                Long seq
        ) {
            this("hop", traceId, branch, from, to, edgeId, unmapped, status, label, attrs, ts, seq);
        }
    }

    record EndEvent(
            String t,
            String traceId,
            String branch,
            String node,
            long ts
    ) implements UiEvent {
        public EndEvent(String traceId, String branch, String node, long ts) {
            this("end", traceId, branch, node, ts);
        }
    }

    record DiagramPatchEvent(
            String t,
            List<PatchOp> ops
    ) implements UiEvent {
        public DiagramPatchEvent(List<PatchOp> ops) {
            this("diagram_patch", ops);
        }
    }

    record StatsEvent(
            String t,
            long windowMs,
            Map<String, NodeMetric> nodes,
            Map<String, EdgeMetric> edges
    ) implements UiEvent {
        public StatsEvent(long windowMs, Map<String, NodeMetric> nodes, Map<String, EdgeMetric> edges) {
            this("stats", windowMs, nodes, edges);
        }
    }

    record DroppedEvent(
            String t,
            long count
    ) implements UiEvent {
        public DroppedEvent(long count) {
            this("dropped", count);
        }
    }
}
