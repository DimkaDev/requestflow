package dev.flowtrace.application;

import dev.flowtrace.application.port.out.UsageRepository;
import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.PlanTier;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;

/**
 * Non-blocking usage metering and real-time quota guard (ADR-0007 / Epic E4).
 * Accumulates events and byte volumes in-memory via LongAdder and flushes
 * deltas to PostgreSQL in batch every <= 10 seconds without blocking live ingest threads.
 */
@ApplicationScoped
public class UsageMeterService {

    public record BucketKey(UUID organizationId, UUID projectId, LocalDate date) {
    }

    private final UsageRepository usageRepository;
    private final MeterRegistry meterRegistry;

    private final ConcurrentMap<BucketKey, LongAdder> eventDeltas = new ConcurrentHashMap<>();
    private final ConcurrentMap<BucketKey, LongAdder> byteDeltas = new ConcurrentHashMap<>();
    private final ConcurrentMap<UUID, AtomicLong> monthlyUsageCache = new ConcurrentHashMap<>();

    @Inject
    public UsageMeterService(UsageRepository usageRepository, MeterRegistry meterRegistry) {
        this.usageRepository = usageRepository;
        this.meterRegistry = meterRegistry;
    }

    /**
     * Non-blocking record call invoked on every validated ingested event.
     */
    public void recordEvent(UUID organizationId, UUID projectId, long eventCount, long byteCount) {
        if (organizationId == null || projectId == null || eventCount <= 0) {
            return;
        }
        LocalDate today = LocalDate.now();
        BucketKey key = new BucketKey(organizationId, projectId, today);
        eventDeltas.computeIfAbsent(key, k -> new LongAdder()).add(eventCount);
        if (byteCount > 0) {
            byteDeltas.computeIfAbsent(key, k -> new LongAdder()).add(byteCount);
        }
        monthlyUsageCache.computeIfAbsent(organizationId, k -> new AtomicLong(0)).addAndGet(eventCount);
    }

    /**
     * Fast in-memory quota guard.
     * Free plan hard-caps at 100,000 events/month.
     * Paid plans (Pro, Business, Enterprise) have soft quotas.
     */
    public boolean isIngestAllowed(UUID organizationId, PlanTier planTier) {
        if (organizationId == null) {
            return true;
        }
        PlanTier tier = planTier != null ? planTier : PlanTier.FREE;
        if (tier.isSoftQuota()) {
            return true;
        }
        long quota = tier.monthlyEventQuota();
        long currentUsed = getMonthlyUsage(organizationId);
        return currentUsed < quota;
    }

    public long getMonthlyUsage(UUID organizationId) {
        AtomicLong cached = monthlyUsageCache.get(organizationId);
        if (cached != null) {
            return cached.get();
        }
        long count = usageRepository.getMonthlyEventsCount(organizationId, YearMonth.now());
        monthlyUsageCache.put(organizationId, new AtomicLong(count));
        return count;
    }

    /**
     * Batch flusher running every 10 seconds to persist accumulated counters.
     */
    @Scheduled(every = "10s")
    public void flushDeltas() {
        if (eventDeltas.isEmpty()) {
            return;
        }
        List<UsageRepository.UsageDelta> batch = new ArrayList<>();
        for (Map.Entry<BucketKey, LongAdder> entry : eventDeltas.entrySet()) {
            BucketKey key = entry.getKey();
            long ev = entry.getValue().sumThenReset();
            LongAdder bAdder = byteDeltas.get(key);
            long bytes = bAdder != null ? bAdder.sumThenReset() : 0L;
            if (ev > 0 || bytes > 0) {
                batch.add(new UsageRepository.UsageDelta(key.organizationId(), key.projectId(), key.date(), ev, bytes));
            }
        }
        if (!batch.isEmpty()) {
            try {
                usageRepository.recordUsageBatch(batch);
            } catch (Exception e) {
                // Do not crash the scheduler loop; log metric
                meterRegistry.counter("usage_flush_errors_total").increment();
            }
        }
    }

    /**
     * Queries detailed organization usage and project breakdown.
     */
    public OrganizationUsage getOrganizationUsage(UUID organizationId, YearMonth month, PlanTier planTier) {
        flushDeltas();
        return usageRepository.getOrganizationUsage(organizationId, month, planTier);
    }

    public void clearMemoryCache() {
        eventDeltas.clear();
        byteDeltas.clear();
        monthlyUsageCache.clear();
    }
}
