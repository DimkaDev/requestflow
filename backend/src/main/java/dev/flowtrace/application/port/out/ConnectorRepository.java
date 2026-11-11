package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.ConnectorConfig;
import dev.flowtrace.domain.ConnectorStatus;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Outbound port for connector configurations and health (Gate G1-E / E20).
 */
public interface ConnectorRepository {

    ConnectorConfig save(ConnectorConfig config);

    Optional<ConnectorConfig> findById(UUID projectId, UUID connectorId);

    Optional<ConnectorConfig> findByTokenHash(String tokenHash);

    List<ConnectorConfig> findByProjectId(UUID projectId);

    void delete(UUID projectId, UUID connectorId);

    void recordEventReceived(UUID connectorId, ConnectorStatus status, String lastError);
}
