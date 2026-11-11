package dev.flowtrace.adapter.out.pg;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.port.out.ConnectorRepository;
import dev.flowtrace.domain.ConnectorConfig;
import dev.flowtrace.domain.ConnectorStatus;
import dev.flowtrace.domain.ConnectorType;
import dev.flowtrace.domain.WebhookMapping;
import jakarta.enterprise.context.ApplicationScoped;

import javax.sql.DataSource;
import java.sql.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class JdbcConnectorRepository implements ConnectorRepository {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    public JdbcConnectorRepository(DataSource dataSource, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
    }

    @Override
    public ConnectorConfig save(ConnectorConfig config) {
        String sql = """
            INSERT INTO project_connectors (
                id, project_id, name, connector_type, token_prefix, token_hash,
                mapping_json, status, last_event_at, total_events, last_error, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                mapping_json = EXCLUDED.mapping_json,
                updated_at = EXCLUDED.updated_at
            """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, config.id());
            ps.setObject(2, config.projectId());
            ps.setString(3, config.name());
            ps.setString(4, config.type().name());
            ps.setString(5, config.tokenPrefix());
            ps.setString(6, config.tokenHash());
            ps.setString(7, serializeMapping(config.mapping()));
            ps.setString(8, config.status().name());
            ps.setTimestamp(9, config.lastEventAt() != null ? Timestamp.from(config.lastEventAt()) : null);
            ps.setLong(10, config.totalEvents());
            ps.setString(11, config.lastError());
            ps.setTimestamp(12, Timestamp.from(config.createdAt()));
            ps.setTimestamp(13, Timestamp.from(config.updatedAt()));
            ps.executeUpdate();
            return config;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to save connector", e);
        }
    }

    @Override
    public Optional<ConnectorConfig> findById(UUID projectId, UUID connectorId) {
        String sql = "SELECT * FROM project_connectors WHERE id = ? AND project_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, connectorId);
            ps.setObject(2, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to find connector by id", e);
        }
        return Optional.empty();
    }

    @Override
    public Optional<ConnectorConfig> findByTokenHash(String tokenHash) {
        String sql = "SELECT * FROM project_connectors WHERE token_hash = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, tokenHash);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to find connector by token hash", e);
        }
        return Optional.empty();
    }

    @Override
    public List<ConnectorConfig> findByProjectId(UUID projectId) {
        String sql = "SELECT * FROM project_connectors WHERE project_id = ? ORDER BY created_at DESC";
        List<ConnectorConfig> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRow(rs));
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list connectors by project id", e);
        }
        return list;
    }

    @Override
    public void delete(UUID projectId, UUID connectorId) {
        String sql = "DELETE FROM project_connectors WHERE id = ? AND project_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, connectorId);
            ps.setObject(2, projectId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to delete connector", e);
        }
    }

    @Override
    public void recordEventReceived(UUID connectorId, ConnectorStatus status, String lastError) {
        String sql = """
            UPDATE project_connectors
            SET status = ?,
                last_event_at = ?,
                total_events = total_events + 1,
                last_error = ?,
                updated_at = ?
            WHERE id = ?
            """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setTimestamp(2, Timestamp.from(Instant.now()));
            ps.setString(3, lastError);
            ps.setTimestamp(4, Timestamp.from(Instant.now()));
            ps.setObject(5, connectorId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update connector operational stats", e);
        }
    }

    private ConnectorConfig mapRow(ResultSet rs) throws SQLException {
        Timestamp lastEventTs = rs.getTimestamp("last_event_at");
        return new ConnectorConfig(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("name"),
                ConnectorType.valueOf(rs.getString("connector_type")),
                rs.getString("token_prefix"),
                rs.getString("token_hash"),
                deserializeMapping(rs.getString("mapping_json")),
                ConnectorStatus.valueOf(rs.getString("status")),
                lastEventTs != null ? lastEventTs.toInstant() : null,
                rs.getLong("total_events"),
                rs.getString("last_error"),
                rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("updated_at").toInstant()
        );
    }

    private String serializeMapping(WebhookMapping mapping) {
        if (mapping == null) return null;
        try {
            return objectMapper.writeValueAsString(mapping);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    private WebhookMapping deserializeMapping(String json) {
        if (json == null || json.isBlank()) return WebhookMapping.genericPreset();
        try {
            return objectMapper.readValue(json, WebhookMapping.class);
        } catch (JsonProcessingException e) {
            return WebhookMapping.genericPreset();
        }
    }
}
