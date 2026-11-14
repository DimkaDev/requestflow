package dev.flowtrace.domain;

import java.util.List;

/**
 * Declarative plan catalog entry exposed by EntitlementsService and GET /api/v1/billing/plans.
 */
public record PlanCatalogEntry(
        PlanTier tier,
        String name,
        String subtitle,
        int monthlyPriceUsd,
        int annualMonthlyPriceUsd,
        long monthlyEventQuota,
        double softCapMultiplier,
        long effectiveHardStopQuota,
        int maxRetentionDays,
        int maxSeats,
        int maxBlocksPerProject,
        int maxEdgesPerProject,
        List<String> allowedPacks,
        List<String> features
) {
}
