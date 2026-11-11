package dev.flowtrace.domain;

import java.util.Locale;

/**
 * Commercial SaaS pricing tiers (Epic 1 & Epic 2 foundation).
 */
public enum PlanTier {
    FREE(100_000L, 3, 1),
    PRO(5_000_000L, 14, 5),
    BUSINESS(25_000_000L, 30, Integer.MAX_VALUE),
    ENTERPRISE(100_000_000L, 90, Integer.MAX_VALUE);

    private final long monthlyEventQuota;
    private final int maxRetentionDays;
    private final int maxSeats;

    PlanTier(long monthlyEventQuota, int maxRetentionDays, int maxSeats) {
        this.monthlyEventQuota = monthlyEventQuota;
        this.maxRetentionDays = maxRetentionDays;
        this.maxSeats = maxSeats;
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
