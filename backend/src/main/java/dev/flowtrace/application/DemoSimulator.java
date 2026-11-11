package dev.flowtrace.application;

import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.domain.CarryItem;
import dev.flowtrace.domain.CarryOp;
import dev.flowtrace.domain.CarryPayload;
import dev.flowtrace.domain.CheckpointEvent;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.EntityInfo;
import dev.flowtrace.domain.EventType;
import dev.flowtrace.domain.NodeType;
import dev.flowtrace.domain.UuidV7;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Collections;
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
 * Built-in DemoSimulator (spec section 13 & v1.1 Live Shop).
 * Injects synthetic traces through the real IngestEventUseCase pipeline for a project's current diagram.
 * Supports both technical graphs and business shopping personas (buyer, abandoner, browser, hesitant)
 * with customer avatars, carried items with prices, and terminal business events.
 */
@ApplicationScoped
public class DemoSimulator {

    public static final long AUTO_STOP_DURATION_MS = 15 * 60 * 1000L;

    public static final List<CarryItem> DEMO_CATALOG = List.of(
            new CarryItem("candle-lavender", "Lavender Candle", "emoji:🕯️", null, 1, 14.50, "EUR"),
            new CarryItem("coffee-beans", "Artisan Coffee Beans", "emoji:☕", null, 1, 18.00, "EUR"),
            new CarryItem("organic-tee", "Cotton T-Shirt", "emoji:👕", null, 1, 29.00, "EUR"),
            new CarryItem("wireless-headphones", "Nordic Headphones", "emoji:🎧", null, 1, 89.00, "EUR"),
            new CarryItem("crafted-journal", "Crafted Journal", "emoji:📚", null, 1, 22.00, "EUR")
    );

    public static final List<String> DEMO_AVATARS = List.of("cat", "fox", "bear", "dog", "rabbit");
    public static final List<String> DEMO_NAMES = List.of("Alice", "Marc", "Elena", "Lucas", "Sofia", "Julian", "Clara");

    public record DemoConfig(
            UUID projectId,
            double ratePerSecond,
            double errorRate,
            long startedAtMs,
            long expiresAtMs
    ) {
    }

    public record PlannedHop(
            String fromKey,
            String nodeKey,
            String label,
            EventType eventType,
            EntityInfo entity,
            CarryPayload carry
    ) {
        public PlannedHop(String fromKey, String nodeKey, String label, EventType eventType) {
            this(fromKey, nodeKey, label, eventType, null, null);
        }
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

        ThreadLocalRandom rng = ThreadLocalRandom.current();
        String traceId = UuidV7.generateString();
        String tier = rng.nextBoolean() ? "pro" : "free";
        String region = rng.nextBoolean() ? "eu-west-1" : "us-east-1";

        List<PlannedHop> steps;
        boolean isCommerce = isCommerceGraph(graph);

        if (isCommerce) {
            steps = planCommerceScenario(graph, rng, cfg.errorRate());
        } else {
            List<DiagramGraph.DiagramNode> sources = graph.nodes().stream()
                    .filter(n -> n.type() == NodeType.source)
                    .toList();
            if (sources.isEmpty()) {
                sources = List.of(graph.nodes().getFirst());
            }
            DiagramGraph.DiagramNode startNode = sources.get(rng.nextInt(sources.size()));
            steps = planWalk(graph, startNode, tier, cfg.errorRate(), rng);
        }

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
                        Map.of("tier", tier, "region", region, "synthetic", true, "demo", true),
                        seqGenerator.getAndIncrement(),
                        step.entity(),
                        step.carry()
                );
                ingestEventUseCase.ingestForProject("demo", projectId, event);

                if (isLast && !step.eventType().isTerminal()) {
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
                                Map.of("tier", tier, "region", region, "synthetic", true),
                                seqGenerator.getAndIncrement()
                        );
                        ingestEventUseCase.ingestForProject("demo", projectId, endEvent);
                    }, 220L, TimeUnit.MILLISECONDS);
                }
            }, scheduledDelay, TimeUnit.MILLISECONDS);

            cumulativeDelayMs += rng.nextLong(180L, 480L);
        }
    }

    public boolean isCommerceGraph(DiagramGraph graph) {
        if (graph == null || graph.nodes() == null) return false;
        return graph.nodes().stream().anyMatch(n ->
                n.key().equals("cart") || n.key().equals("paid") || n.key().equals("visit")
        );
    }

    public List<PlannedHop> planCommerceScenario(DiagramGraph graph, ThreadLocalRandom rng, double errorRate) {
        List<PlannedHop> steps = new ArrayList<>();
        String avatar = DEMO_AVATARS.get(rng.nextInt(DEMO_AVATARS.size()));
        String name = DEMO_NAMES.get(rng.nextInt(DEMO_NAMES.size()));
        String ref = "c-" + rng.nextInt(100, 999);
        EntityInfo customer = new EntityInfo("customer", ref, name, avatar);

        CarryItem item1 = DEMO_CATALOG.get(rng.nextInt(DEMO_CATALOG.size()));
        CarryItem item2 = DEMO_CATALOG.get(rng.nextInt(DEMO_CATALOG.size()));

        double roll = rng.nextDouble();

        if (roll < 0.50) {
            // Buyer (50%): visit -> browse -> product -> cart -> checkout -> payment -> paid (complete)
            steps.add(new PlannedHop(null, "visit", "enter storefront", EventType.enter, customer, null));
            steps.add(new PlannedHop("visit", "browse", "browse catalog", EventType.enter));
            steps.add(new PlannedHop("browse", "product", "view product", EventType.enter));
            steps.add(new PlannedHop("product", "cart", "add to cart", EventType.enter, null, new CarryPayload(CarryOp.add, List.of(item1, item2))));
            steps.add(new PlannedHop("cart", "checkout", "proceed to checkout", EventType.enter));
            steps.add(new PlannedHop("checkout", "payment", "card payment", EventType.enter));
            steps.add(new PlannedHop("payment", "paid", "payment authorized", EventType.complete));
        } else if (roll < 0.75) {
            // Abandoner (25%): visit -> browse -> product -> cart -> abandoned
            steps.add(new PlannedHop(null, "visit", "enter storefront", EventType.enter, customer, null));
            steps.add(new PlannedHop("visit", "browse", "browse catalog", EventType.enter));
            steps.add(new PlannedHop("browse", "product", "view product", EventType.enter));
            steps.add(new PlannedHop("product", "cart", "add to cart", EventType.enter, null, new CarryPayload(CarryOp.add, List.of(item1))));
            steps.add(new PlannedHop("cart", "abandoned", "cart abandoned", EventType.abandon));
        } else if (roll < 0.88) {
            // Browser (13%): visit -> browse -> product -> browse -> abandoned
            steps.add(new PlannedHop(null, "visit", "enter storefront", EventType.enter, customer, null));
            steps.add(new PlannedHop("visit", "browse", "browse catalog", EventType.enter));
            steps.add(new PlannedHop("browse", "product", "view product", EventType.enter));
            steps.add(new PlannedHop("product", "browse", "view more", EventType.enter));
            steps.add(new PlannedHop("browse", "abandoned", "bounce", EventType.abandon));
        } else {
            // Hesitant / Payment Fail (12%): visit -> product -> cart -> checkout (removes 1) -> payment -> payment-failed
            steps.add(new PlannedHop(null, "visit", "enter storefront", EventType.enter, customer, null));
            steps.add(new PlannedHop("visit", "browse", "browse catalog", EventType.enter));
            steps.add(new PlannedHop("browse", "product", "view product", EventType.enter));
            steps.add(new PlannedHop("product", "cart", "add 2 items", EventType.enter, null, new CarryPayload(CarryOp.add, List.of(item1, item2))));
            steps.add(new PlannedHop("cart", "checkout", "remove 1 item", EventType.enter, null, new CarryPayload(CarryOp.remove, List.of(item2))));
            steps.add(new PlannedHop("checkout", "payment", "card payment", EventType.enter));
            boolean cardDeclined = rng.nextDouble() < Math.max(errorRate, 0.50);
            if (cardDeclined) {
                steps.add(new PlannedHop("payment", "payment-failed", "insufficient funds", EventType.fail));
            } else {
                steps.add(new PlannedHop("payment", "paid", "authorized", EventType.complete));
            }
        }

        // Filter steps to nodes that actually exist in the current graph
        List<PlannedHop> validSteps = new ArrayList<>();
        String lastValidKey = null;
        for (PlannedHop step : steps) {
            if (graph.findNode(step.nodeKey()).isPresent()) {
                validSteps.add(new PlannedHop(lastValidKey, step.nodeKey(), step.label(), step.eventType(), step.entity(), step.carry()));
                lastValidKey = step.nodeKey();
            }
        }
        return validSteps.isEmpty() ? steps : validSteps;
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
