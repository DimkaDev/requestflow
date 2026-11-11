package dev.flowtrace.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Pure domain logic for Hop Resolution (spec section 6.1 & v1.1).
 * Maintains bounded in-memory TraceState (30s idle expiry), idempotency cache (10s TTL),
 * and carried items state (ops set/add/remove/clear, limits, totals).
 */
public class HopResolver {

    public static final long DEFAULT_IDLE_TIMEOUT_MS = 30_000L;
    public static final long IDEMPOTENCY_WINDOW_MS = 10_000L;
    public static final int MAX_CARRIED_ITEMS_PER_TRACE = 50;

    public record TraceBranchKey(UUID projectId, String traceId, String branch) {
    }

    public record IdempotencyKey(UUID projectId, String traceId, String branch, long seq) {
    }

    public record TraceStateEntry(
            String lastNode,
            long updatedAtMs,
            EntityInfo entity,
            Map<String, CarryItem> carriedItems
    ) {
        public TraceStateEntry(String lastNode, long updatedAtMs) {
            this(lastNode, updatedAtMs, null, Collections.emptyMap());
        }
    }

    public record ResolutionResult(
            boolean duplicateIgnored,
            String resolvedFromNode,
            List<UiEvent> uiEvents,
            DiagramGraph updatedDiagram
    ) {
    }

    private final long idleTimeoutMs;
    private final Map<TraceBranchKey, TraceStateEntry> traceStates = new ConcurrentHashMap<>();
    private final Map<IdempotencyKey, Long> recentSeqs = new ConcurrentHashMap<>();
    private final AtomicInteger autoEdgeCounter = new AtomicInteger(100);

    public HopResolver() {
        this(DEFAULT_IDLE_TIMEOUT_MS);
    }

    public HopResolver(long idleTimeoutMs) {
        this.idleTimeoutMs = idleTimeoutMs;
    }

    /**
     * Resolves an incoming CheckpointEvent into UI events (spawn, hop, end, complete, fail, abandon, carry, diagram_patch)
     * according to spec section 6.1 & v1.1.
     */
    public synchronized ResolutionResult resolve(
            UUID projectId,
            boolean autoDiscover,
            DiagramGraph currentDiagram,
            CheckpointEvent event
    ) {
        long now = event.serverTs();
        evictExpired(now);

        // Rule 9: Idempotency check on (projectId, traceId, branch, seq) within 10s
        if (event.seq() != null) {
            IdempotencyKey idemKey = new IdempotencyKey(projectId, event.traceId(), event.branch(), event.seq());
            Long previousTs = recentSeqs.get(idemKey);
            if (previousTs != null && (now - previousTs) <= IDEMPOTENCY_WINDOW_MS) {
                return new ResolutionResult(true, null, List.of(), null);
            }
            recentSeqs.put(idemKey, now);
        }

        TraceBranchKey stateKey = new TraceBranchKey(projectId, event.traceId(), event.branch());
        TraceStateEntry existingState = traceStates.get(stateKey);
        if (existingState != null && (now - existingState.updatedAtMs()) > idleTimeoutMs) {
            traceStates.remove(stateKey);
            existingState = null;
        }

        // Entity & Carry state resolution
        EntityInfo currentEntity = event.entity() != null
                ? event.entity()
                : (existingState != null ? existingState.entity() : null);

        Map<String, CarryItem> baseItems = (existingState != null && existingState.carriedItems() != null)
                ? existingState.carriedItems()
                : Collections.emptyMap();
        Map<String, CarryItem> updatedItems = event.carry() != null
                ? applyCarry(baseItems, event.carry())
                : baseItems;
        CarrySummary carrySummary = computeSummary(updatedItems);

        String fromNode = null;
        // Rule 1: If `from` is present -> hop `from -> node`
        if (event.from() != null && !event.from().isBlank()) {
            fromNode = event.from();
        } else if (existingState != null && existingState.lastNode() != null) {
            // Rule 2: Else if TraceState has a last node -> hop `last -> node`
            // Avoid self-loop if terminal event or in-place carry update is sent right after entering
            boolean isTerminal = event.type().isTerminal();
            if (!(isTerminal && existingState.lastNode().equals(event.node()))) {
                fromNode = existingState.lastNode();
            }
        }

        DiagramGraph workingDiagram = currentDiagram != null ? currentDiagram : DiagramGraph.defaultSampleDiagram();
        boolean diagramModified = false;
        List<UiEvent.PatchOp> patchOps = new ArrayList<>();
        List<UiEvent> emitted = new ArrayList<>();

        // In-place carry update at existing node without movement
        if (fromNode != null && fromNode.equals(event.node()) && event.type() == EventType.enter && event.carry() != null) {
            emitted.add(new UiEvent.CarryEvent(
                    event.traceId(),
                    event.branch(),
                    event.node(),
                    event.carry().op(),
                    carrySummary,
                    now
            ));
            traceStates.put(stateKey, new TraceStateEntry(event.node(), now, currentEntity, updatedItems));
            return new ResolutionResult(false, fromNode, List.copyOf(emitted), null);
        }

        // Rule 6: Check if `from` (when present) and `node` exist in diagram
        if (fromNode != null && workingDiagram.findNode(fromNode).isEmpty() && autoDiscover) {
            DiagramGraph.DiagramNode discoveredSource = createAutoLayoutNode(workingDiagram, fromNode);
            workingDiagram = workingDiagram.withAddedNode(discoveredSource);
            patchOps.add(UiEvent.PatchOp.addNode(discoveredSource));
            diagramModified = true;
        }

        if (workingDiagram.findNode(event.node()).isEmpty() && autoDiscover) {
            DiagramGraph.DiagramNode discoveredTarget = createAutoLayoutNode(workingDiagram, event.node());
            workingDiagram = workingDiagram.withAddedNode(discoveredTarget);
            patchOps.add(UiEvent.PatchOp.addNode(discoveredTarget));
            diagramModified = true;
        }

        String status = (event.type() == EventType.error) ? "error" : "ok";

        if (fromNode == null) {
            // Rule 3: Spawn at `node`
            emitted.add(new UiEvent.SpawnEvent(
                    event.traceId(),
                    event.branch(),
                    event.node(),
                    status,
                    event.label(),
                    event.attrs(),
                    now,
                    currentEntity,
                    carrySummary
            ));
        } else {
            // Rule 5: Check if edge `from -> node` exists
            Optional<DiagramGraph.DiagramEdge> existingEdge = workingDiagram.findEdge(fromNode, event.node());
            String edgeId = null;
            boolean unmapped = false;

            if (existingEdge.isPresent()) {
                edgeId = existingEdge.get().id();
            } else if (autoDiscover) {
                edgeId = "e_disc_" + autoEdgeCounter.incrementAndGet() + "_" + fromNode + "_" + event.node();
                DiagramGraph.DiagramEdge newEdge = new DiagramGraph.DiagramEdge(
                        edgeId,
                        fromNode,
                        event.node(),
                        event.label(),
                        true
                );
                workingDiagram = workingDiagram.withAddedEdge(newEdge);
                patchOps.add(UiEvent.PatchOp.addEdge(newEdge));
                diagramModified = true;
            } else {
                unmapped = true;
            }

            if (!patchOps.isEmpty()) {
                emitted.add(new UiEvent.DiagramPatchEvent(List.copyOf(patchOps)));
                patchOps.clear();
            }

            emitted.add(new UiEvent.HopEvent(
                    event.traceId(),
                    event.branch(),
                    fromNode,
                    event.node(),
                    edgeId,
                    unmapped,
                    status,
                    event.label(),
                    event.attrs(),
                    now,
                    event.seq(),
                    currentEntity,
                    carrySummary
            ));
        }

        if (!patchOps.isEmpty()) {
            emitted.add(0, new UiEvent.DiagramPatchEvent(List.copyOf(patchOps)));
        }

        // Rule 4, 8 & v1.1 Terminal events: Update TraceState or emit terminal outcome
        if (event.type() == EventType.end) {
            traceStates.remove(stateKey);
            emitted.add(new UiEvent.EndEvent(event.traceId(), event.branch(), event.node(), now, "end"));
        } else if (event.type() == EventType.complete) {
            traceStates.remove(stateKey);
            emitted.add(new UiEvent.CompleteEvent(event.traceId(), event.branch(), event.node(), currentEntity, carrySummary, now));
        } else if (event.type() == EventType.fail) {
            traceStates.remove(stateKey);
            emitted.add(new UiEvent.FailEvent(event.traceId(), event.branch(), event.node(), currentEntity, event.label() != null ? event.label() : "error", now));
        } else if (event.type() == EventType.abandon) {
            traceStates.remove(stateKey);
            emitted.add(new UiEvent.AbandonEvent(event.traceId(), event.branch(), event.node(), currentEntity, carrySummary, now));
        } else {
            traceStates.put(stateKey, new TraceStateEntry(event.node(), now, currentEntity, updatedItems));
        }

        return new ResolutionResult(
                false,
                fromNode,
                List.copyOf(emitted),
                diagramModified ? workingDiagram : null
        );
    }

    /**
     * Sweeps idle traces older than idleTimeoutMs and returns `end` events for them (Rule 8).
     */
    public synchronized List<Map.Entry<UUID, UiEvent.EndEvent>> sweepIdleTraces(long nowMs) {
        List<Map.Entry<UUID, UiEvent.EndEvent>> expiredEvents = new ArrayList<>();
        var iterator = traceStates.entrySet().iterator();
        while (iterator.hasNext()) {
            var entry = iterator.next();
            if ((nowMs - entry.getValue().updatedAtMs()) > idleTimeoutMs) {
                iterator.remove();
                TraceBranchKey key = entry.getKey();
                expiredEvents.add(Map.entry(
                        key.projectId(),
                        new UiEvent.EndEvent(key.traceId(), key.branch(), entry.getValue().lastNode(), nowMs, "idle_timeout")
                ));
            }
        }
        recentSeqs.entrySet().removeIf(e -> (nowMs - e.getValue()) > IDEMPOTENCY_WINDOW_MS);
        return expiredEvents;
    }

    public List<UiEvent.ActiveTracePosition> getActiveTraces(UUID projectId, long nowMs) {
        List<UiEvent.ActiveTracePosition> list = new ArrayList<>();
        for (var entry : traceStates.entrySet()) {
            if (entry.getKey().projectId().equals(projectId)
                    && (nowMs - entry.getValue().updatedAtMs()) <= idleTimeoutMs) {
                list.add(new UiEvent.ActiveTracePosition(
                        entry.getKey().traceId(),
                        entry.getKey().branch(),
                        entry.getValue().lastNode(),
                        entry.getValue().entity(),
                        computeSummary(entry.getValue().carriedItems())
                ));
            }
        }
        return list;
    }

    private Map<String, CarryItem> applyCarry(Map<String, CarryItem> current, CarryPayload payload) {
        Map<String, CarryItem> updated = new LinkedHashMap<>(current);
        if (payload == null || payload.op() == null) {
            return Collections.unmodifiableMap(updated);
        }
        switch (payload.op()) {
            case clear -> updated.clear();
            case set -> {
                updated.clear();
                if (payload.items() != null) {
                    for (CarryItem item : payload.items()) {
                        if (updated.size() >= MAX_CARRIED_ITEMS_PER_TRACE) break;
                        updated.put(item.sku(), item);
                    }
                }
            }
            case add -> {
                if (payload.items() != null) {
                    for (CarryItem item : payload.items()) {
                        CarryItem existing = updated.get(item.sku());
                        if (existing != null) {
                            updated.put(item.sku(), existing.withQty(existing.qty() + item.qty()));
                        } else if (updated.size() < MAX_CARRIED_ITEMS_PER_TRACE) {
                            updated.put(item.sku(), item);
                        }
                    }
                }
            }
            case remove -> {
                if (payload.items() != null) {
                    for (CarryItem item : payload.items()) {
                        CarryItem existing = updated.get(item.sku());
                        if (existing != null) {
                            int remaining = existing.qty() - item.qty();
                            if (remaining > 0) {
                                updated.put(item.sku(), existing.withQty(remaining));
                            } else {
                                updated.remove(item.sku());
                            }
                        }
                    }
                }
            }
        }
        return Collections.unmodifiableMap(updated);
    }

    public CarrySummary computeSummary(Map<String, CarryItem> items) {
        if (items == null || items.isEmpty()) {
            return CarrySummary.empty();
        }
        int totalQty = 0;
        double totalPrice = 0.0;
        String currency = "EUR";
        List<String> icons = new ArrayList<>();
        for (CarryItem item : items.values()) {
            totalQty += item.qty();
            totalPrice += (item.qty() * item.price());
            if (item.currency() != null && !item.currency().isBlank()) {
                currency = item.currency();
            }
            if (item.icon() != null && !item.icon().isBlank() && icons.size() < 3 && !icons.contains(item.icon())) {
                icons.add(item.icon());
            }
        }
        return new CarrySummary(totalQty, Math.round(totalPrice * 100.0) / 100.0, currency, List.copyOf(icons));
    }

    private void evictExpired(long nowMs) {
        if (recentSeqs.size() > 5_000) {
            recentSeqs.entrySet().removeIf(e -> (nowMs - e.getValue()) > IDEMPOTENCY_WINDOW_MS);
        }
        if (traceStates.size() > 10_000) {
            traceStates.entrySet().removeIf(e -> (nowMs - e.getValue().updatedAtMs()) > idleTimeoutMs);
        }
    }

    private DiagramGraph.DiagramNode createAutoLayoutNode(DiagramGraph graph, String nodeKey) {
        int existingCount = graph.nodes() != null ? graph.nodes().size() : 0;
        double maxY = graph.nodes() != null
                ? graph.nodes().stream().mapToDouble(DiagramGraph.DiagramNode::y).max().orElse(0)
                : 0;
        int col = existingCount % 3;
        double x = (col - 1) * 220.0;
        double y = maxY + 140.0;
        String label = formatLabel(nodeKey);
        return new DiagramGraph.DiagramNode(nodeKey, label, NodeType.service, x, y, "cpu", true);
    }

    private static String formatLabel(String key) {
        String[] parts = key.split("[-_.]");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part.isEmpty()) continue;
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                sb.append(part.substring(1));
            }
        }
        return sb.isEmpty() ? key : sb.toString();
    }
}
