package dev.flowtrace.domain;

import java.util.List;
import java.util.UUID;

public record OrganizationUsage(
        UUID organizationId,
        PlanTier planTier,
        long monthlyQuota,
        long totalEventsThisMonth,
        long totalBytesThisMonth,
        double percentUsed,
        boolean isQuotaExceeded,
        List<ProjectUsage> projectBreakdown
) {
    public static OrganizationUsage of(
            UUID organizationId,
            PlanTier planTier,
            long totalEventsThisMonth,
            long totalBytesThisMonth,
            List<ProjectUsage> projectBreakdown
    ) {
        long quota = planTier != null ? planTier.monthlyEventQuota() : PlanTier.FREE.monthlyEventQuota();
        double percent = quota > 0 ? (double) totalEventsThisMonth / quota * 100.0 : 0.0;
        boolean exceeded = quota > 0 && totalEventsThisMonth >= quota;
        return new OrganizationUsage(
                organizationId,
                planTier != null ? planTier : PlanTier.FREE,
                quota,
                totalEventsThisMonth,
                totalBytesThisMonth,
                Math.round(percent * 10.0) / 10.0,
                exceeded,
                projectBreakdown != null ? projectBreakdown : List.of()
        );
    }
}
