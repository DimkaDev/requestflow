package dev.flowtrace.domain;

import java.util.List;

/**
 * Lightweight summary of active carried items sent with UI stream events.
 */
public record CarrySummary(
        int count,
        double total,
        String currency,
        List<String> topIcons
) {
    public static CarrySummary empty() {
        return new CarrySummary(0, 0.0, "EUR", List.of());
    }
}
