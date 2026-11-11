package dev.flowtrace.application;

import dev.flowtrace.application.port.out.UsageRepository;
import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.PlanTier;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.jupiter.api.Assertions.*;

public class UsageMeterServiceTest {

    private InMemoryUsageRepository mockRepository;
    private UsageMeterService meterService;

    @BeforeEach
    public void setUp() {
        mockRepository = new InMemoryUsageRepository();
        meterService = new UsageMeterService(mockRepository, new SimpleMeterRegistry());
    }

    @Test
    @DisplayName("Accumulates usage non-blockingly and flushes deltas in batch")
    public void testAccumulateAndFlush() {
        UUID orgId = UUID.randomUUID();
        UUID projA = UUID.randomUUID();
        UUID projB = UUID.randomUUID();

        // Record events
        meterService.recordEvent(orgId, projA, 10, 1024);
        meterService.recordEvent(orgId, projA, 15, 2048);
        meterService.recordEvent(orgId, projB, 5, 512);

        assertEquals(30, meterService.getMonthlyUsage(orgId));

        // Flush
        meterService.flushDeltas();

        assertEquals(2, mockRepository.batches.size());
        long totalEventsFlushed = mockRepository.batches.stream()
                .mapToLong(UsageRepository.UsageDelta::eventsCount)
                .sum();
        long totalBytesFlushed = mockRepository.batches.stream()
                .mapToLong(UsageRepository.UsageDelta::bytesCount)
                .sum();

        assertEquals(30, totalEventsFlushed);
        assertEquals(3584, totalBytesFlushed);

        // Subsequent flush without new events does not emit empty batches
        mockRepository.batches.clear();
        meterService.flushDeltas();
        assertTrue(mockRepository.batches.isEmpty());
    }

    @Test
    @DisplayName("Enforces hard quota for FREE tier and soft quota for paid tiers")
    public void testQuotaGuard() {
        UUID orgId = UUID.randomUUID();
        UUID projId = UUID.randomUUID();

        // 1. FREE tier allows up to 100,000 events
        mockRepository.monthlyCount.set(99_999L);
        meterService.clearMemoryCache();
        assertTrue(meterService.isIngestAllowed(orgId, PlanTier.FREE));

        // Exactly at quota -> blocked on FREE
        mockRepository.monthlyCount.set(100_000L);
        meterService.clearMemoryCache();
        assertFalse(meterService.isIngestAllowed(orgId, PlanTier.FREE));

        // Exceeded quota -> blocked on FREE
        mockRepository.monthlyCount.set(150_000L);
        meterService.clearMemoryCache();
        assertFalse(meterService.isIngestAllowed(orgId, PlanTier.FREE));

        // 2. PRO tier has soft quota (5,000,000 limit) -> allowed even when over quota
        mockRepository.monthlyCount.set(6_000_000L);
        meterService.clearMemoryCache();
        assertTrue(meterService.isIngestAllowed(orgId, PlanTier.PRO));

        // 3. BUSINESS tier has soft quota (25,000,000 limit) -> allowed even when over quota
        mockRepository.monthlyCount.set(30_000_000L);
        meterService.clearMemoryCache();
        assertTrue(meterService.isIngestAllowed(orgId, PlanTier.BUSINESS));
    }

    private static class InMemoryUsageRepository implements UsageRepository {
        final List<UsageDelta> batches = new ArrayList<>();
        final AtomicLong monthlyCount = new AtomicLong(0L);

        @Override
        public void recordUsageBatch(List<UsageDelta> deltas) {
            batches.addAll(deltas);
        }

        @Override
        public long getMonthlyEventsCount(UUID organizationId, YearMonth month) {
            return monthlyCount.get();
        }

        @Override
        public OrganizationUsage getOrganizationUsage(UUID organizationId, YearMonth month, PlanTier planTier) {
            return OrganizationUsage.of(organizationId, planTier, monthlyCount.get(), 0L, List.of());
        }
    }
}
