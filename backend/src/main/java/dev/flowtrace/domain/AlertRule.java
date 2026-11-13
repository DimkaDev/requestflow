package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

public record AlertRule(
        UUID id,
        UUID projectId,
        String name,
        String severity,
        String metric,
        double threshold,
        int windowSeconds,
        String targetNode,
        String channelType,
        String channelTarget,
        boolean enabled,
        Instant mutedUntil,
        Instant lastFiredAt,
        int fireCount,
        Instant createdAt
) {
    public static AlertRule create(
            UUID projectId,
            String name,
            String severity,
            String metric,
            double threshold,
            int windowSeconds,
            String targetNode,
            String channelType,
            String channelTarget
    ) {
        return new AlertRule(
                UuidV7.generate(),
                projectId,
                name,
                severity != null ? severity : "CRITICAL",
                metric != null ? metric : "error_rate",
                threshold,
                windowSeconds > 0 ? windowSeconds : 300,
                targetNode,
                channelType != null ? channelType : "WEBHOOK",
                channelTarget != null ? channelTarget : "",
                true,
                null,
                null,
                0,
                Instant.now()
        );
    }

    public AlertRule withEnabled(boolean nextEnabled) {
        return new AlertRule(
                id, projectId, name, severity, metric, threshold, windowSeconds,
                targetNode, channelType, channelTarget, nextEnabled, mutedUntil,
                lastFiredAt, fireCount, createdAt
        );
    }

    public AlertRule withMutedUntil(Instant nextMutedUntil) {
        return new AlertRule(
                id, projectId, name, severity, metric, threshold, windowSeconds,
                targetNode, channelType, channelTarget, enabled, nextMutedUntil,
                lastFiredAt, fireCount, createdAt
        );
    }

    public AlertRule withFired(Instant firedAt) {
        return new AlertRule(
                id, projectId, name, severity, metric, threshold, windowSeconds,
                targetNode, channelType, channelTarget, enabled, mutedUntil,
                firedAt, fireCount + 1, createdAt
        );
    }
}
