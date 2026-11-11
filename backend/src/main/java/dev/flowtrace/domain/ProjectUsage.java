package dev.flowtrace.domain;

import java.util.List;
import java.util.UUID;

public record ProjectUsage(
        UUID projectId,
        String projectName,
        long eventsThisMonth,
        long bytesThisMonth,
        List<UsageBucket> dailyHistory
) {
}
