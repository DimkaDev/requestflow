package dev.flowtrace.domain;

import java.time.LocalDate;

public record UsageBucket(
        LocalDate date,
        long eventsCount,
        long bytesCount
) {
}
