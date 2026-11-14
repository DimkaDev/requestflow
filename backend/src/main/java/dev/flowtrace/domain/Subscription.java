package dev.flowtrace.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Organization subscription state, 7-day dunning grace period, and EU B2B VAT profile (ADR-0011).
 */
public record Subscription(
        UUID organizationId,
        String provider,
        String providerCustomerId,
        String providerSubscriptionId,
        PlanTier planTier,
        BillingInterval billingInterval,
        SubscriptionStatus status,
        Instant currentPeriodStart,
        Instant currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        Instant gracePeriodEndsAt,
        String companyName,
        String billingCountry,
        String vatId,
        String promoCode,
        int discountPercent,
        Instant updatedAt
) {
    private static final Pattern EU_VAT_PATTERN = Pattern.compile("^[A-Z]{2}[0-9A-Z]{8,12}$");

    public static Subscription defaultFree(UUID organizationId, Instant now) {
        Instant ts = now != null ? now : Instant.now();
        return new Subscription(
                organizationId,
                "sandbox",
                "cus_free_" + organizationId.toString().substring(0, 8),
                "sub_free_" + organizationId.toString().substring(0, 8),
                PlanTier.FREE,
                BillingInterval.MONTHLY,
                SubscriptionStatus.ACTIVE,
                ts,
                ts.plus(Duration.ofDays(30)),
                false,
                null,
                null,
                null,
                null,
                null,
                0,
                ts
        );
    }

    public boolean isInGracePeriod(Instant now) {
        Instant check = now != null ? now : Instant.now();
        return status == SubscriptionStatus.PAST_DUE
                && gracePeriodEndsAt != null
                && check.isBefore(gracePeriodEndsAt);
    }

    public boolean isGracePeriodExpired(Instant now) {
        Instant check = now != null ? now : Instant.now();
        return status == SubscriptionStatus.PAST_DUE
                && gracePeriodEndsAt != null
                && !check.isBefore(gracePeriodEndsAt);
    }

    public static boolean isValidEuVatId(String rawVatId) {
        if (rawVatId == null || rawVatId.isBlank()) {
            return true;
        }
        String normalized = normalizeVatId(rawVatId);
        return EU_VAT_PATTERN.matcher(normalized).matches();
    }

    public static String normalizeVatId(String rawVatId) {
        if (rawVatId == null) {
            return null;
        }
        String cleaned = rawVatId.replaceAll("[\\s.\\-]", "").toUpperCase(Locale.ROOT);
        return cleaned.isEmpty() ? null : cleaned;
    }

    public static int resolvePromoDiscountPercent(String promoCode) {
        if (promoCode == null || promoCode.isBlank()) {
            return 0;
        }
        return switch (promoCode.trim().toUpperCase(Locale.ROOT)) {
            case "LAUNCH20", "BELGIUM20" -> 20;
            case "FLOW50", "STARTUP50" -> 50;
            default -> 0;
        };
    }
}
