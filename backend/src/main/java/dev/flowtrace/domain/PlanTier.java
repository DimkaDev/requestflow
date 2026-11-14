package dev.flowtrace.domain;

import java.util.List;
import java.util.Locale;

/**
 * Commercial SaaS pricing tiers (Epic 1 & Epic 2 foundation + DEC-19 Editor limits).
 */
public enum PlanTier {
    FREE(
            "Starter Free",
            "For side projects and local evaluation.",
            0,
            0,
            100_000L,
            1.00,
            3,
            1,
            25,
            50,
            List.of("standard", "shop", "tech", "business"),
            List.of("100k events / month", "3 days trace retention", "25 blocks per diagram", "Standard & Shop packs")
    ),
    PRO(
            "Pro Mesh",
            "For growing SaaS and microservices.",
            29,
            23,
            5_000_000L,
            1.20,
            14,
            5,
            100,
            250,
            List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks"),
            List.of("5M events / month (120% soft cap)", "14 days trace retention", "100 blocks per diagram", "All 7 packs + My blocks")
    ),
    BUSINESS(
            "Business Ops",
            "High-volume production & CRO shops.",
            99,
            79,
            25_000_000L,
            1.20,
            30,
            Integer.MAX_VALUE,
            500,
            1200,
            List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks"),
            List.of("25M events / month (120% soft cap)", "30 days trace retention", "500 blocks & unlimited seats", "EU B2B VAT & Webhooks")
    ),
    ENTERPRISE(
            "Enterprise",
            "Dedicated throughput and custom SLA.",
            299,
            239,
            100_000_000L,
            1.20,
            90,
            Integer.MAX_VALUE,
            1000,
            2500,
            List.of("standard", "shop", "aws", "gcp", "tech", "ai-agent", "business", "my-blocks"),
            List.of("100M+ events / month (120% soft cap)", "90 days trace retention", "1,000 blocks per diagram", "Priority SLA & Audit export")
    );

    private final String displayName;
    private final String subtitle;
    private final int monthlyPriceUsd;
    private final int annualMonthlyPriceUsd;
    private final long monthlyEventQuota;
    private final double softCapMultiplier;
    private final int maxRetentionDays;
    private final int maxSeats;
    private final int maxBlocksPerProject;
    private final int maxEdgesPerProject;
    private final List<String> allowedPacks;
    private final List<String> features;

    PlanTier(
            String displayName,
            String subtitle,
            int monthlyPriceUsd,
            int annualMonthlyPriceUsd,
            long monthlyEventQuota,
            double softCapMultiplier,
            int maxRetentionDays,
            int maxSeats,
            int maxBlocksPerProject,
            int maxEdgesPerProject,
            List<String> allowedPacks,
            List<String> features
    ) {
        this.displayName = displayName;
        this.subtitle = subtitle;
        this.monthlyPriceUsd = monthlyPriceUsd;
        this.annualMonthlyPriceUsd = annualMonthlyPriceUsd;
        this.monthlyEventQuota = monthlyEventQuota;
        this.softCapMultiplier = softCapMultiplier;
        this.maxRetentionDays = maxRetentionDays;
        this.maxSeats = maxSeats;
        this.maxBlocksPerProject = maxBlocksPerProject;
        this.maxEdgesPerProject = maxEdgesPerProject;
        this.allowedPacks = allowedPacks;
        this.features = features;
    }

    public String displayName() {
        return displayName;
    }

    public String subtitle() {
        return subtitle;
    }

    public int monthlyPriceUsd() {
        return monthlyPriceUsd;
    }

    public int annualMonthlyPriceUsd() {
        return annualMonthlyPriceUsd;
    }

    public long monthlyEventQuota() {
        return monthlyEventQuota;
    }

    public double softCapMultiplier() {
        return softCapMultiplier;
    }

    public long effectiveHardStopQuota() {
        return Math.round(monthlyEventQuota * softCapMultiplier);
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

    public List<String> features() {
        return features;
    }

    public boolean isSoftQuota() {
        return this != FREE;
    }

    public PlanCatalogEntry toCatalogEntry() {
        return new PlanCatalogEntry(
                this,
                displayName,
                subtitle,
                monthlyPriceUsd,
                annualMonthlyPriceUsd,
                monthlyEventQuota,
                softCapMultiplier,
                effectiveHardStopQuota(),
                maxRetentionDays,
                maxSeats,
                maxBlocksPerProject,
                maxEdgesPerProject,
                allowedPacks,
                features
        );
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
