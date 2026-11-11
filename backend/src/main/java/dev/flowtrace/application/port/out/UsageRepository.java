package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.PlanTier;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

public interface UsageRepository {

    record UsageDelta(
            UUID organizationId,
            UUID projectId,
            LocalDate date,
            long eventsCount,
            long bytesCount
    ) {
    }

    void recordUsageBatch(List<UsageDelta> deltas);

    long getMonthlyEventsCount(UUID organizationId, YearMonth month);

    OrganizationUsage getOrganizationUsage(UUID organizationId, YearMonth month, PlanTier planTier);
}
