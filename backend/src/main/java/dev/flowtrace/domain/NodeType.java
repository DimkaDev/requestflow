package dev.flowtrace.domain;

public enum NodeType {
    source,
    service,
    decision,
    datastore,
    queue,
    external,
    end;

    public static NodeType fromString(String value) {
        if (value == null || value.isBlank()) {
            return service;
        }
        try {
            return NodeType.valueOf(value.trim().toLowerCase());
        } catch (IllegalArgumentException e) {
            return service;
        }
    }
}
