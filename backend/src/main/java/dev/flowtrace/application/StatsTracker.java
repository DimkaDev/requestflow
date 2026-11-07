package dev.flowtrace.application;

import dev.flowtrace.domain.UiEvent;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.LongAdder;

/**
 * Tracks rolling 1-second node and edge counters per project to drive UI badges and edge heat (spec section 7).
 */
public class StatsTracker {

    private static final class ProjectCounters {
        final Map<String, LongAdder> nodeIn = new ConcurrentHashMap<>();
        final Map<String, LongAdder> nodeErrors = new ConcurrentHashMap<>();
        final Map<String, LongAdder> edgeHops = new ConcurrentHashMap<>();
        final Map<String, LongAdder> edgeErrors = new ConcurrentHashMap<>();
    }

    private final Map<UUID, ProjectCounters> countersByProject = new ConcurrentHashMap<>();

    public void recordEvent(UUID projectId, UiEvent event) {
        ProjectCounters pc = countersByProject.computeIfAbsent(projectId, k -> new ProjectCounters());
        switch (event) {
            case UiEvent.SpawnEvent spawn -> {
                pc.nodeIn.computeIfAbsent(spawn.node(), k -> new LongAdder()).increment();
                if ("error".equals(spawn.status())) {
                    pc.nodeErrors.computeIfAbsent(spawn.node(), k -> new LongAdder()).increment();
                }
            }
            case UiEvent.HopEvent hop -> {
                pc.nodeIn.computeIfAbsent(hop.to(), k -> new LongAdder()).increment();
                boolean isErr = "error".equals(hop.status());
                if (isErr) {
                    pc.nodeErrors.computeIfAbsent(hop.to(), k -> new LongAdder()).increment();
                }
                if (hop.edgeId() != null) {
                    pc.edgeHops.computeIfAbsent(hop.edgeId(), k -> new LongAdder()).increment();
                    if (isErr) {
                        pc.edgeErrors.computeIfAbsent(hop.edgeId(), k -> new LongAdder()).increment();
                    }
                }
            }
            default -> {
            }
        }
    }

    /**
     * Collects and resets the 1s window counters for a project.
     */
    public UiEvent.StatsEvent harvestWindow(UUID projectId, long windowMs) {
        ProjectCounters pc = countersByProject.get(projectId);
        if (pc == null) {
            return new UiEvent.StatsEvent(windowMs, Map.of(), Map.of());
        }
        Map<String, UiEvent.NodeMetric> nodes = new HashMap<>();
        for (var entry : pc.nodeIn.entrySet()) {
            long inCount = entry.getValue().sumThenReset();
            LongAdder errAdder = pc.nodeErrors.get(entry.getKey());
            long errCount = errAdder != null ? errAdder.sumThenReset() : 0L;
            if (inCount > 0 || errCount > 0) {
                nodes.put(entry.getKey(), new UiEvent.NodeMetric(inCount, errCount));
            }
        }
        Map<String, UiEvent.EdgeMetric> edges = new HashMap<>();
        for (var entry : pc.edgeHops.entrySet()) {
            long hopCount = entry.getValue().sumThenReset();
            LongAdder errAdder = pc.edgeErrors.get(entry.getKey());
            long errCount = errAdder != null ? errAdder.sumThenReset() : 0L;
            if (hopCount > 0 || errCount > 0) {
                edges.put(entry.getKey(), new UiEvent.EdgeMetric(hopCount, errCount));
            }
        }
        return new UiEvent.StatsEvent(windowMs, nodes, edges);
    }

    public Set<UUID> activeProjects() {
        return countersByProject.keySet();
    }
}
