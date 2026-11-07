package dev.flowtrace.application;

import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.domain.CheckpointEvent;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.EventType;
import dev.flowtrace.domain.NodeType;
import dev.flowtrace.domain.UuidV7;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Built-in DemoSimulator (spec section 13).
 * Injects synthetic traces through the real IngestEventUseCase pipeline for a project's current diagram.
 * Walks the graph from source nodes, picks outgoing edges at decision nodes, applies random per-hop delay 80-600ms,
 * and auto-stops after 15 minutes.
 */
@ApplicationScoped
public class DemoSimulator {

    public static final long AUTO_STOP_DURATION_MS = 15 * 60 * 1000L;

    public record DemoConfig(
            UUID projectId,
            double ratePerSecond,
            double errorRate,
            long startedAtMs,
            long expiresAtMs
    ) {
    }

    private final IngestEventUseCase ingestEventUseCase;
    private final ProjectRepository projectRepository;
    private final Map<UUID, DemoConfig> activeConfigs = new ConcurrentHashMap<>();
    private final Map<UUID, Long> lastSpawnTimeMs = new ConcurrentHashMap<>();
    private final ScheduledExecutorService hopScheduler = Executors.newScheduledThreadPool(2, r -> {
        Thread t = new Thread(r, "flowtrace-demo-simulator");
        t.setDaemon(true);
        return t;
    });
    private final AtomicLong seqGenerator = new AtomicLong(1);

    @Inject
    public DemoSimulator(IngestEventUseCase ingestEventUseCase, ProjectRepository projectRepository) {
        this.ingestEventUseCase = ingestEventUseCase;
        this.projectRepository = projectRepository;
    }

    public DemoConfig startDemo(UUID projectId, Double ratePerSecond, Double errorRate) {
        double rate = (ratePerSecond == null || ratePerSecond <= 0) ? 2.5 : Math.min(ratePerSecond, 50.0);
        double err = (errorRate == null || errorRate < 0) ? 0.04 : Math.min(errorRate, 1.0);
        if (err > 1.0) {
            err = err / 100.0;
        }
        long now = System.currentTimeMillis();
        DemoConfig cfg = new DemoConfig(projectId, rate, err, now, now + AUTO_STOP_DURATION_MS);
        activeConfigs.put(projectId, cfg);
        lastSpawnTimeMs.put(projectId, 0L);
        return cfg;
    }

    public void stopDemo(UUID projectId) {
        activeConfigs.remove(projectId);
        lastSpawnTimeMs.remove(projectId);
    }

    public DemoConfig getStatus(UUID projectId) {
        DemoConfig cfg = activeConfigs.get(projectId);
        if (cfg != null && System.currentTimeMillis() > cfg.expiresAtMs()) {
            stopDemo(projectId);
            return null;
        }
        return cfg;
    }

    @Scheduled(every = "PT0.2S", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void tickSimulators() {
        long now = System.currentTimeMillis();
        for (var entry : activeConfigs.entrySet()) {
            UUID projectId = entry.getKey();
            DemoConfig cfg = entry.getValue();
            if (now > cfg.expiresAtMs()) {
                stopDemo(projectId);
                continue;
            }
            long intervalMs = Math.max(40L, Math.round(1000.0 / cfg.ratePerSecond()));
            long last = lastSpawnTimeMs.getOrDefault(projectId, 0L);
            if ((now - last) >= intervalMs) {
                lastSpawnTimeMs.put(projectId, now);
                launchSyntheticTrace(projectId, cfg);
            }
        }
    }

    public void launchSyntheticTrace(UUID projectId, DemoConfig cfg) {
        DiagramGraph graph = projectRepository.getLatestDiagram(projectId)
                .map(DiagramVersion::graph)
                .orElseGet(DiagramGraph::defaultSampleDiagram);
        if (graph.nodes() == null || graph.nodes().isEmpty()) {
            return;
        }

        // Find source nodes (or nodes with no incoming edges, or first node)
        List<DiagramGraph.DiagramNode> sources = graph.nodes().stream()
                .filter(n -> n.type() == NodeType.source)
                .toList();
        if (sources.isEmpty()) {
            sources = List.of(graph.nodes().getFirst());
        }

        ThreadLocalRandom rng = ThreadLocalRandom.current();
        DiagramGraph.DiagramNode startNode = sources.get(rng.nextInt(sources.size()));
        String traceId = UuidV7.generateString();
        String tier = rng.nextBoolean() ? "pro" : "free";
        String region = rng.nextBoolean() ? "eu-west-1" : "us-east-1";

        List<PlannedHop> steps = planWalk(graph, startNode, tier, cfg.errorRate(), rng);
        long cumulativeDelayMs = 0L;

        for (int i = 0; i < steps.size(); i++) {
            PlannedHop step = steps.get(i);
            boolean isLast = (i == steps.size() - 1);
            long scheduledDelay = cumulativeDelayMs;
            hopScheduler.schedule(() -> {
                if (!activeConfigs.containsKey(projectId)) {
                    return;
                }
                long ts = System.currentTimeMillis();
                CheckpointEvent event = CheckpointEvent.validateAndCreate(
                        1,
                        null,
                        traceId,
                        step.nodeKey(),
                        step.fromKey(),
                        step.eventType().name(),
                        "main",
                        ts,
                        ts,
                        step.label(),
                        Map.of("tier", tier, "region", region, "synthetic", true),
                        seqGenerator.getAndIncrement()
                );
                ingestEventUseCase.ingestForProject("demo", projectId, event);

                if (isLast && step.eventType() != EventType.end) {
                    hopScheduler.schedule(() -> {
                        long endTs = System.currentTimeMillis();
                        CheckpointEvent endEvent = CheckpointEvent.validateAndCreate(
                                1,
                                null,
                                traceId,
                                step.nodeKey(),
                                null,
                                EventType.end.name(),
                                "main",
                                endTs,
                                endTs,
                                null,
                                Map.of("tier", tier, "region", region),
                                seqGenerator.getAndIncrement()
                        );
                        ingestEventUseCase.ingestForProject("demo", projectId, endEvent);
                    }, 220L, TimeUnit.MILLISECONDS);
                }
            }, scheduledDelay, TimeUnit.MILLISECONDS);

            cumulativeDelayMs += rng.nextLong(140L, 460L);
        }
    }

    private record PlannedHop(String fromKey, String nodeKey, String label, EventType eventType) {
    }

    private List<PlannedHop> planWalk(
            DiagramGraph graph,
            DiagramGraph.DiagramNode startNode,
            String tier,
            double errorRate,
            ThreadLocalRandom rng
    ) {
        List<PlannedHop> result = new ArrayList<>();
        DiagramGraph.DiagramNode current = startNode;
        String prevKey = null;
        String edgeLabel = null;

        for (int depth = 0; depth < 10 && current != null; depth++) {
            String currentKey = current.key();
            List<DiagramGraph.DiagramEdge> outgoing = graph.edges() == null ? List.of() :
                    graph.edges().stream().filter(e -> e.from().equals(currentKey)).toList();

            boolean isTerminal = outgoing.isEmpty() || current.type() == NodeType.end;
            boolean shouldError = (depth > 0) && (rng.nextDouble() < errorRate);
            EventType type = shouldError ? EventType.error : EventType.enter;

            result.add(new PlannedHop(prevKey, currentKey, edgeLabel, type));
            if (shouldError || isTerminal) {
                break;
            }

            DiagramGraph.DiagramEdge chosenEdge;
            if (current.type() == NodeType.decision && outgoing.size() > 1) {
                // Pick edge matching tier or random
                chosenEdge = outgoing.get(rng.nextInt(outgoing.size()));
            } else {
                chosenEdge = outgoing.get(rng.nextInt(outgoing.size()));
            }

            prevKey = currentKey;
            edgeLabel = chosenEdge.label();
            current = graph.findNode(chosenEdge.to()).orElse(null);
        }

        return result;
    }
}
