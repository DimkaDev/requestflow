package dev.flowtrace.domain;

import java.util.Locale;

/**
 * Subscription lifecycle states (ADR-0011 / Epic E3).
 */
public enum SubscriptionStatus {
    ACTIVE,
    PAST_DUE,
    CANCELED,
    TRIALING;

    public static SubscriptionStatus fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return ACTIVE;
        }
        try {
            return SubscriptionStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ACTIVE;
        }
    }
}
