package dev.flowtrace.domain;

public enum EventType {
    enter,
    error,
    end;

    public static EventType fromString(String value) {
        if (value == null || value.isBlank()) {
            return enter;
        }
        return switch (value.trim().toLowerCase()) {
            case "enter" -> enter;
            case "error" -> error;
            case "end" -> end;
            default -> throw new IllegalArgumentException("Invalid event type: " + value + " (expected enter|error|end)");
        };
    }
}
