package dev.flowtrace.domain;

/**
 * Health and operational status of a connector (Gate G1-E / E20-10).
 * Framework-free pure Java domain enum.
 */
public enum ConnectorStatus {
    WAITING,
    CONNECTED,
    ERROR
}
