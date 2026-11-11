package dev.flowtrace.application;

import dev.flowtrace.application.port.out.EventFanout;
import dev.flowtrace.application.port.out.OrganizationRepository;
import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.application.port.out.TraceRepository;
import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.CarryPayload;
import dev.flowtrace.domain.CheckpointEvent;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.EntityInfo;
import dev.flowtrace.domain.HopResolver;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.TokenBucketRateLimiter;
import dev.flowtrace.domain.UiEvent;
import dev.flowtrace.domain.ValidationException;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class IngestEventUseCase {

    public record RawEventInput(
            Integer v,
            String key,
            String traceId,
            String node,
            String from,
            String type,
            String branch,
            Long ts,
            String label,
            Map<String, Object> attrs,
            Long seq,
            EntityInfo entity,
            CarryPayload carry
    ) {
        public RawEventInput(
                Integer v,
                String key,
                String traceId,
                String node,
                String from,
                String type,
                String branch,
                Long ts,
                String label,
                Map<String, Object> attrs,
                Long seq
        ) {
            this(v, key, traceId, node, from, type, branch, ts, label, attrs, seq, null, null);
        }
    }

    public record RejectedItem(int index, String reason) {
    }

    public record BatchIngestResult(
            int accepted,
            List<RejectedItem> rejected,
            List<Long> ackSeqs
    ) {
    }

    private record CachedKeyEntry(ApiKey apiKey, long expiresAtMs) {
    }

    private static final long KEY_CACHE_TTL_MS = 60_000L;

    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final UsageMeterService usageMeterService;
    private final TraceRepository traceRepository;
    private final EventFanout eventFanout;
    private final MeterRegistry meterRegistry;
    private final HopResolver hopResolver = new HopResolver();
    private final TokenBucketRateLimiter rateLimiter = new TokenBucketRateLimiter();
    private final StatsTracker statsTracker = new StatsTracker();
    private final Map<String, CachedKeyEntry> keyCache = new ConcurrentHashMap<>();
    private final Map<UUID, DiagramGraph> diagramCache = new ConcurrentHashMap<>();
    private final Map<UUID, Project> projectCache = new ConcurrentHashMap<>();
    private final Map<UUID, Boolean> orgDeletedCache = new ConcurrentHashMap<>();
    private final Map<UUID, PlanTier> orgPlanTierCache = new ConcurrentHashMap<>();

    @Inject
    public IngestEventUseCase(
            ProjectRepository projectRepository,
            OrganizationRepository organizationRepository,
            UsageMeterService usageMeterService,
            TraceRepository traceRepository,
            EventFanout eventFanout,
            MeterRegistry meterRegistry
    ) {
        this.projectRepository = projectRepository;
        this.organizationRepository = organizationRepository;
        this.usageMeterService = usageMeterService;
        this.traceRepository = traceRepository;
        this.eventFanout = eventFanout;
        this.meterRegistry = meterRegistry;
    }

    public IngestEventUseCase(
            ProjectRepository projectRepository,
            OrganizationRepository organizationRepository,
            TraceRepository traceRepository,
            EventFanout eventFanout,
            MeterRegistry meterRegistry
    ) {
        this(projectRepository, organizationRepository, null, traceRepository, eventFanout, meterRegistry);
    }

    public Optional<ApiKey> authenticateKey(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            return Optional.empty();
        }
        String hash = ApiKeyCrypto.sha256Hex(rawKey.trim());
        long now = System.currentTimeMillis();
        CachedKeyEntry cached = keyCache.get(hash);
        if (cached != null && cached.expiresAtMs() > now) {
            return Optional.of(cached.apiKey());
        }
        Optional<ApiKey> found = projectRepository.findActiveKeyByHash(hash);
        found.ifPresent(k -> keyCache.put(hash, new CachedKeyEntry(k, now + KEY_CACHE_TTL_MS)));
        return found;
    }

    public void evictKeyCache() {
        keyCache.clear();
        projectCache.clear();
        orgDeletedCache.clear();
        orgPlanTierCache.clear();
    }

    private UUID getProjectOrganizationId(UUID projectId) {
        Project project = projectCache.computeIfAbsent(projectId, id ->
                projectRepository.findById(id).orElse(new Project(id, id, "Default", true, 7, Instant.now()))
        );
        return project.organizationId();
    }

    private PlanTier getProjectPlanTier(UUID orgId) {
        if (orgId == null || organizationRepository == null) {
            return PlanTier.FREE;
        }
        return orgPlanTierCache.computeIfAbsent(orgId, id ->
                organizationRepository.findById(id).map(Organization::planTier).orElse(PlanTier.FREE)
        );
    }

    private boolean isProjectOrganizationDeleted(UUID projectId) {
        UUID orgId = getProjectOrganizationId(projectId);
        if (orgId == null || organizationRepository == null) {
            return false;
        }
        return orgDeletedCache.computeIfAbsent(orgId, id ->
                organizationRepository.findById(id).map(Organization::isDeleted).orElse(false)
        );
    }

    public void invalidateDiagramCache(UUID projectId, DiagramGraph newGraph) {
        if (newGraph != null) {
            diagramCache.put(projectId, newGraph);
        } else {
            diagramCache.remove(projectId);
        }
        projectCache.remove(projectId);
    }

    /**
     * Ingests a batch of 1..100 events from any protocol (http, udp, tcp, simulator).
     */
    public BatchIngestResult ingestBatch(String protocol, String fallbackApiKey, List<RawEventInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            recordDrop(protocol, "empty_batch");
            return new BatchIngestResult(0, List.of(new RejectedItem(0, "empty payload")), List.of());
        }
        if (inputs.size() > 100) {
            recordDrop(protocol, "batch_too_large");
            return new BatchIngestResult(0, List.of(new RejectedItem(0, "batch exceeds max 100 events")), List.of());
        }

        int accepted = 0;
        List<RejectedItem> rejected = new ArrayList<>();
        List<Long> ackSeqs = new ArrayList<>();

        for (int i = 0; i < inputs.size(); i++) {
            RawEventInput raw = inputs.get(i);
            if (raw == null) {
                rejected.add(new RejectedItem(i, "null event"));
                recordDrop(protocol, "validation");
                continue;
            }
            String effectiveKey = (raw.key() != null && !raw.key().isBlank()) ? raw.key() : fallbackApiKey;
            Optional<ApiKey> apiKeyOpt = authenticateKey(effectiveKey);
            if (apiKeyOpt.isEmpty()) {
                rejected.add(new RejectedItem(i, "invalid or revoked API key"));
                recordDrop(protocol, "unauthorized");
                continue;
            }
            ApiKey apiKey = apiKeyOpt.get();
            if (!apiKey.hasScope("ingest")) {
                rejected.add(new RejectedItem(i, "API key lacks 'ingest' scope"));
                recordDrop(protocol, "insufficient_scope");
                continue;
            }
            if (isProjectOrganizationDeleted(apiKey.projectId())) {
                rejected.add(new RejectedItem(i, "organization is scheduled for deletion"));
                recordDrop(protocol, "org_deleted");
                continue;
            }

            UUID orgId = getProjectOrganizationId(apiKey.projectId());
            PlanTier planTier = getProjectPlanTier(orgId);
            if (usageMeterService != null && !usageMeterService.isIngestAllowed(orgId, planTier)) {
                rejected.add(new RejectedItem(i, "monthly event quota exceeded (" + planTier.monthlyEventQuota() + " events)"));
                recordDrop(protocol, "quota_exceeded");
                continue;
            }

            if (!rateLimiter.tryAcquire(apiKey.id().toString(), apiKey.rateLimitPerS())) {
                rejected.add(new RejectedItem(i, "rate limit exceeded"));
                recordDrop(protocol, "rate_limit");
                continue;
            }

            long startNanos = System.nanoTime();
            long serverTs = System.currentTimeMillis();
            CheckpointEvent validated;
            try {
                validated = CheckpointEvent.validateAndCreate(
                        raw.v(),
                        effectiveKey,
                        raw.traceId(),
                        raw.node(),
                        raw.from(),
                        raw.type(),
                        raw.branch(),
                        raw.ts(),
                        serverTs,
                        raw.label(),
                        raw.attrs(),
                        raw.seq(),
                        raw.entity(),
                        raw.carry()
                );
            } catch (ValidationException ve) {
                rejected.add(new RejectedItem(i, ve.getMessage()));
                recordDrop(protocol, "validation");
                continue;
            }

            processValidatedEvent(protocol, apiKey.projectId(), validated, startNanos);
            accepted++;
            if (validated.seq() != null) {
                ackSeqs.add(validated.seq());
            }
        }

        return new BatchIngestResult(accepted, rejected, ackSeqs);
    }

    /**
     * Direct internal ingestion for a known project (used by DemoSimulator after passing rate/validation rules).
     */
    public void ingestForProject(String protocol, UUID projectId, CheckpointEvent validated) {
        long startNanos = System.nanoTime();
        processValidatedEvent(protocol, projectId, validated, startNanos);
    }

    private void processValidatedEvent(String protocol, UUID projectId, CheckpointEvent validated, long startNanos) {
        meterRegistry.counter("ingest_events_total", "protocol", protocol).increment();

        Project project = projectCache.computeIfAbsent(projectId, id ->
                projectRepository.findById(id).orElse(new Project(id, id, "Default", true, 7, Instant.now()))
        );
        DiagramGraph diagram = diagramCache.computeIfAbsent(projectId, id ->
                projectRepository.getLatestDiagram(id).map(DiagramVersion::graph).orElseGet(DiagramGraph::defaultSampleDiagram)
        );

        HopResolver.ResolutionResult resolution = hopResolver.resolve(
                projectId,
                project.autoDiscover(),
                diagram,
                validated
        );

        if (resolution.duplicateIgnored()) {
            return;
        }

        if (resolution.updatedDiagram() != null) {
            diagramCache.put(projectId, resolution.updatedDiagram());
            projectRepository.saveDiagramVersion(projectId, resolution.updatedDiagram());
        }

        for (UiEvent uiEvent : resolution.uiEvents()) {
            statsTracker.recordEvent(projectId, uiEvent);
            eventFanout.publish(projectId, uiEvent);
        }

        traceRepository.enqueueAsync(projectId, resolution.resolvedFromNode(), validated);

        if (usageMeterService != null && project.organizationId() != null) {
            usageMeterService.recordEvent(project.organizationId(), projectId, 1, 128L);
        }

        Timer.builder("hop_latency_seconds")
                .register(meterRegistry)
                .record(System.nanoTime() - startNanos, TimeUnit.NANOSECONDS);
    }

    public UiEvent.SnapshotEvent buildSnapshot(UUID projectId) {
        DiagramGraph diagram = diagramCache.computeIfAbsent(projectId, id ->
                projectRepository.getLatestDiagram(id).map(DiagramVersion::graph).orElseGet(DiagramGraph::defaultSampleDiagram)
        );
        long now = System.currentTimeMillis();
        List<UiEvent.ActiveTracePosition> active = hopResolver.getActiveTraces(projectId, now);
        UiEvent.StatsEvent stats = statsTracker.harvestWindow(projectId, 1000L);
        return new UiEvent.SnapshotEvent(diagram, active, stats, now);
    }

    @Scheduled(every = "1s", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void broadcastPeriodicStatsAndIdleSweeps() {
        long now = System.currentTimeMillis();
        for (UUID projectId : statsTracker.activeProjects()) {
            UiEvent.StatsEvent stats = statsTracker.harvestWindow(projectId, 1000L);
            if (!stats.nodes().isEmpty() || !stats.edges().isEmpty()) {
                eventFanout.publish(projectId, stats);
            }
        }
        for (var expired : hopResolver.sweepIdleTraces(now)) {
            eventFanout.publish(expired.getKey(), expired.getValue());
        }
    }

    public void recordDrop(String protocol, String reason) {
        meterRegistry.counter("ingest_dropped_total", "protocol", protocol, "reason", reason).increment();
    }
}
