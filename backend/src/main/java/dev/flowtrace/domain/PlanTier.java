package dev.flowtrace.domain;

import java.util.List;
import java.util.Locale;

/**
 * Commercial SaaS pricing tiers (Epic 1 & Epic 2 foundation + DEC-19 Editor limits).
 */
public enum PlanTier {
    FREE(100_000L, 3, 1, 25, 50, List.of("standard", "shop", "tech", "business")),
    PRO(5_000_000L, 14, 5, 100, 250, List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks")),
    BUSINESS(25_000_000L, 30, Integer.MAX_VALUE, 500, 1200, List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks")),
    ENTERPRISE(100_000_000L, 90, Integer.MAX_VALUE, 1000, 2500, List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks"));

    private final long monthlyEventQuota;
    private final int maxRetentionDays;
    private final int maxSeats;
    private final int maxBlocksPerProject;
    private final int maxEdgesPerProject;
    private final List<String> allowedPacks;

    PlanTier(
            long monthlyEventQuota,
            int maxRetentionDays,
            int maxSeats,
            int maxBlocksPerProject,
            int maxEdgesPerProject,
            List<String> allowedPacks
    ) {
        this.monthlyEventQuota = monthlyEventQuota;
        this.maxRetentionDays = maxRetentionDays;
        this.maxSeats = maxSeats;
        this.maxBlocksPerProject = maxBlocksPerProject;
        this.maxEdgesPerProject = maxEdgesPerProject;
        this.allowedPacks = allowedPacks;
    }

    public long monthlyEventQuota() {
        return monthlyEventQuota;
    }

    public int maxRetentionDays() {
        return maxRetentionDays;
    }

    public int maxSeats() {
        return maxSeats;
    }

    public int maxBlocksPerProject() {
        return maxBlocksPerProject;
    }

    public int maxEdgesPerProject() {
        return maxEdgesPerProject;
    }

    public List<String> allowedPacks() {
        return allowedPacks;
    }

    public boolean isSoftQuota() {
        return this != FREE;
    }

    public static PlanTier fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return FREE;
        }
        try {
            return PlanTier.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return FREE;
        }
    }
}
