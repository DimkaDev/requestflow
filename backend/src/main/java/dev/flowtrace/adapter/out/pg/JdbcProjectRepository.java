package dev.flowtrace.adapter.out.pg;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.UuidV7;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class JdbcProjectRepository implements ProjectRepository {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    @Inject
    public JdbcProjectRepository(DataSource dataSource, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
    }

    @Override
    public UUID ensureUser(String externalId, String email) {
        String selectSql = "SELECT id FROM users WHERE external_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(selectSql)) {
            ps.setString(1, externalId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return UUID.fromString(rs.getString("id"));
                }
            }
            UUID newId = UuidV7.generate();
            String insertSql = "INSERT INTO users (id, external_id, email, created_at) VALUES (?, ?, ?, ?)";
            try (PreparedStatement ins = conn.prepareStatement(insertSql)) {
                ins.setObject(1, newId);
                ins.setString(2, externalId);
                ins.setString(3, email);
                ins.setTimestamp(4, Timestamp.from(Instant.now()));
                ins.executeUpdate();
            }
            return newId;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to ensure user: " + externalId, e);
        }
    }

    @Override
    public List<Project> findByOwner(UUID ownerId) {
        String sql = "SELECT id, owner_id, name, auto_discover, retention_days, created_at FROM projects WHERE owner_id = ? ORDER BY created_at DESC";
        List<Project> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, ownerId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapProject(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list projects", e);
        }
    }

    @Override
    public Optional<Project> findById(UUID projectId) {
        String sql = "SELECT id, owner_id, name, auto_discover, retention_days, created_at FROM projects WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapProject(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find project " + projectId, e);
        }
    }

    @Override
    public Project createProject(UUID ownerId, String name, boolean autoDiscover, int retentionDays, DiagramGraph initialDiagram) {
        return createProjectWithId(UuidV7.generate(), ownerId, name, autoDiscover, retentionDays, initialDiagram);
    }

    public Project createProjectWithId(UUID projectId, UUID ownerId, String name, boolean autoDiscover, int retentionDays, DiagramGraph initialDiagram) {
        Instant now = Instant.now();
        String insertProject = "INSERT INTO projects (id, owner_id, name, auto_discover, retention_days, created_at) VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement(insertProject)) {
                ps.setObject(1, projectId);
                ps.setObject(2, ownerId);
                ps.setString(3, name);
                ps.setBoolean(4, autoDiscover);
                ps.setInt(5, retentionDays);
                ps.setTimestamp(6, Timestamp.from(now));
                ps.executeUpdate();
            }
            saveDiagramVersion(projectId, initialDiagram);
            return new Project(projectId, ownerId, name, autoDiscover, retentionDays, now);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create project", e);
        }
    }

    @Override
    public Project updateProject(UUID projectId, String name, Boolean autoDiscover, Integer retentionDays) {
        Project current = findById(projectId).orElseThrow();
        String newName = (name != null && !name.isBlank()) ? name.trim() : current.name();
        boolean newDiscover = (autoDiscover != null) ? autoDiscover : current.autoDiscover();
        int newRetention = (retentionDays != null && retentionDays >= 1) ? retentionDays : current.retentionDays();

        String sql = "UPDATE projects SET name = ?, auto_discover = ?, retention_days = ? WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newName);
            ps.setBoolean(2, newDiscover);
            ps.setInt(3, newRetention);
            ps.setObject(4, projectId);
            ps.executeUpdate();
            return new Project(projectId, current.ownerId(), newName, newDiscover, newRetention, current.createdAt());
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to update project", e);
        }
    }

    @Override
    public void deleteProject(UUID projectId) {
        String sql = "DELETE FROM projects WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to delete project", e);
        }
    }

    @Override
    public Optional<DiagramVersion> getLatestDiagram(UUID projectId) {
        String sql = "SELECT id, project_id, version, graph, created_at FROM diagrams WHERE project_id = ? ORDER BY version DESC LIMIT 1";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapDiagram(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to load latest diagram", e);
        }
    }

    @Override
    public synchronized DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph) {
        try (Connection conn = dataSource.getConnection()) {
            int nextVersion = 1;
            try (PreparedStatement maxPs = conn.prepareStatement("SELECT COALESCE(MAX(version), 0) FROM diagrams WHERE project_id = ?")) {
                maxPs.setObject(1, projectId);
                try (ResultSet rs = maxPs.executeQuery()) {
                    if (rs.next()) {
                        nextVersion = rs.getInt(1) + 1;
                    }
                }
            }

            UUID diagId = UuidV7.generate();
            Instant now = Instant.now();
            String json = objectMapper.writeValueAsString(graph);
            try (PreparedStatement ins = conn.prepareStatement(
                    "INSERT INTO diagrams (id, project_id, version, graph, created_at) VALUES (?, ?, ?, ?, ?)")) {
                ins.setObject(1, diagId);
                ins.setObject(2, projectId);
                ins.setInt(3, nextVersion);
                ins.setString(4, json);
                ins.setTimestamp(5, Timestamp.from(now));
                ins.executeUpdate();
            }

            // Keep last 20 versions (spec section 8)
            int minKeepVersion = nextVersion - 20;
            if (minKeepVersion > 0) {
                try (PreparedStatement trim = conn.prepareStatement(
                        "DELETE FROM diagrams WHERE project_id = ? AND version <= ?")) {
                    trim.setObject(1, projectId);
                    trim.setInt(2, minKeepVersion);
                    trim.executeUpdate();
                }
            }

            return new DiagramVersion(diagId, projectId, nextVersion, graph, now);
        } catch (SQLException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to save diagram version", e);
        }
    }

    @Override
    public List<DiagramVersion> listDiagramVersions(UUID projectId) {
        String sql = "SELECT id, project_id, version, graph, created_at FROM diagrams WHERE project_id = ? ORDER BY version DESC LIMIT 20";
        List<DiagramVersion> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapDiagram(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list diagram versions", e);
        }
    }

    @Override
    public List<ApiKey> listApiKeys(UUID projectId) {
        String sql = "SELECT id, project_id, name, key_prefix, key_hash, rate_limit_per_s, created_at, last_used_at, revoked_at FROM api_keys WHERE project_id = ? ORDER BY created_at DESC";
        List<ApiKey> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapApiKey(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list API keys", e);
        }
    }

    @Override
    public ApiKey createApiKey(UUID projectId, String name, String keyPrefix, String keyHash, int rateLimitPerS) {
        UUID id = UuidV7.generate();
        Instant now = Instant.now();
        String sql = "INSERT INTO api_keys (id, project_id, name, key_prefix, key_hash, rate_limit_per_s, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, projectId);
            ps.setString(3, name);
            ps.setString(4, keyPrefix);
            ps.setString(5, keyHash);
            ps.setInt(6, rateLimitPerS);
            ps.setTimestamp(7, Timestamp.from(now));
            ps.executeUpdate();
            return new ApiKey(id, projectId, name, keyPrefix, keyHash, rateLimitPerS, now, null, null);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create API key", e);
        }
    }

    @Override
    public Optional<ApiKey> findActiveKeyByHash(String keyHash) {
        String sql = "SELECT id, project_id, name, key_prefix, key_hash, rate_limit_per_s, created_at, last_used_at, revoked_at FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, keyHash);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapApiKey(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to lookup API key by hash", e);
        }
    }

    @Override
    public boolean revokeApiKey(UUID projectId, UUID keyId) {
        String sql = "UPDATE api_keys SET revoked_at = ? WHERE id = ? AND project_id = ? AND revoked_at IS NULL";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(Instant.now()));
            ps.setObject(2, keyId);
            ps.setObject(3, projectId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to revoke API key", e);
        }
    }

    @Override
    public void touchApiKeyLastUsed(UUID keyId) {
        String sql = "UPDATE api_keys SET last_used_at = ? WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(Instant.now()));
            ps.setObject(2, keyId);
            ps.executeUpdate();
        } catch (SQLException ignored) {
        }
    }

    private Project mapProject(ResultSet rs) throws SQLException {
        return new Project(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("owner_id")),
                rs.getString("name"),
                rs.getBoolean("auto_discover"),
                rs.getInt("retention_days"),
                rs.getTimestamp("created_at").toInstant()
        );
    }

    private DiagramVersion mapDiagram(ResultSet rs) throws SQLException {
        try {
            DiagramGraph graph = objectMapper.readValue(rs.getString("graph"), DiagramGraph.class);
            return new DiagramVersion(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("project_id")),
                    rs.getInt("version"),
                    graph,
                    rs.getTimestamp("created_at").toInstant()
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to parse diagram JSON", e);
        }
    }

    private ApiKey mapApiKey(ResultSet rs) throws SQLException {
        Timestamp lastUsed = rs.getTimestamp("last_used_at");
        Timestamp revoked = rs.getTimestamp("revoked_at");
        return new ApiKey(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("project_id")),
                rs.getString("name"),
                rs.getString("key_prefix"),
                rs.getString("key_hash"),
                rs.getInt("rate_limit_per_s"),
                rs.getTimestamp("created_at").toInstant(),
                lastUsed != null ? lastUsed.toInstant() : null,
                revoked != null ? revoked.toInstant() : null
        );
    }
}
