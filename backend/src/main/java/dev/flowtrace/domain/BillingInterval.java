package dev.flowtrace.domain;

import java.util.Locale;

/**
 * Billing interval for subscriptions (Monthly or Annual with 20% discount).
 */
public enum BillingInterval {
    MONTHLY,
    ANNUAL;

    public static BillingInterval fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MONTHLY;
        }
        try {
            return BillingInterval.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return MONTHLY;
        }
    }
}
