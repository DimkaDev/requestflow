package dev.flowtrace.domain;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Top-level multi-tenant Organization entity with 30-day soft-delete support (TASK-1.1, E1-Step-6).
 */
public record Organization(
        UUID id,
        String name,
        String slug,
        String billingEmail,
        PlanTier planTier,
        Instant createdAt,
        Instant deletedAt
) {
    public static final long SOFT_DELETE_RETENTION_DAYS = 30L;

    public Organization(
            UUID id,
            String name,
            String slug,
            String billingEmail,
            PlanTier planTier,
            Instant createdAt
    ) {
        this(id, name, slug, billingEmail, planTier, createdAt, null);
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public static String slugify(String raw) {
        if (raw == null || raw.isBlank()) {
            return "org-" + UuidV7.generateString().substring(0, 8);
        }
        String clean = raw.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (clean.isBlank()) {
            return "org-" + UuidV7.generateString().substring(0, 8);
        }
        return clean.length() > 64 ? clean.substring(0, 64) : clean;
    }
}
