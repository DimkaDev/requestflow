package dev.flowtrace.domain;

public enum EventType {
    enter,
    error,
    end,
    complete,
    fail,
    abandon;

    public boolean isTerminal() {
        return this == end || this == complete || this == fail || this == abandon;
    }

    public static EventType fromString(String value) {
        if (value == null || value.isBlank()) {
            return enter;
        }
        return switch (value.trim().toLowerCase()) {
            case "enter" -> enter;
            case "error" -> error;
            case "end" -> end;
            case "complete" -> complete;
            case "fail" -> fail;
            case "abandon" -> abandon;
            default -> throw new IllegalArgumentException("Invalid event type: " + value + " (expected enter|error|end|complete|fail|abandon)");
        };
    }
}
