package dev.flowtrace.domain;

/**
 * Mutation operation applied to carried items in TraceState.
 */
public enum CarryOp {
    set,
    add,
    remove,
    clear;

    public static CarryOp fromString(String value) {
        if (value == null || value.isBlank()) {
            throw new ValidationException("carry.op is required");
        }
        return switch (value.trim().toLowerCase()) {
            case "set" -> set;
            case "add" -> add;
            case "remove" -> remove;
            case "clear" -> clear;
            default -> throw new ValidationException("Invalid carry.op: " + value + " (expected set|add|remove|clear)");
        };
    }
}
