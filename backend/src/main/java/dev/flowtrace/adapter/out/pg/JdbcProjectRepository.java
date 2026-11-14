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
        String sql = "SELECT id, owner_id, organization_id, workspace_id, name, auto_discover, retention_days, created_at FROM projects WHERE owner_id = ? ORDER BY created_at DESC";
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
    public List<Project> findAccessibleByUser(UUID userId, UUID organizationId, UUID workspaceId) {
        StringBuilder sql = new StringBuilder("""
                SELECT p.id, p.owner_id, p.organization_id, p.workspace_id, p.name, p.auto_discover, p.retention_days, p.created_at
                FROM projects p
                LEFT JOIN organizations o ON o.id = p.organization_id
                WHERE (o.id IS NULL OR o.deleted_at IS NULL)
                AND (
                    p.owner_id = ?
                    OR p.organization_id IN (
                        SELECT m.organization_id FROM organization_members m
                        WHERE m.user_id = ? AND m.role <> 'BILLING_ADMIN'
                    )
                )
                """);
        if (organizationId != null) {
            sql.append(" AND p.organization_id = ?");
        }
        if (workspaceId != null) {
            sql.append(" AND p.workspace_id = ?");
        }
        sql.append(" ORDER BY p.created_at DESC");

        List<Project> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            int idx = 1;
            ps.setObject(idx++, userId);
            ps.setObject(idx++, userId);
            if (organizationId != null) {
                ps.setObject(idx++, organizationId);
            }
            if (workspaceId != null) {
                ps.setObject(idx++, workspaceId);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapProject(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list accessible projects", e);
        }
    }

    @Override
    public Optional<Project> findById(UUID projectId) {
        String sql = "SELECT id, owner_id, organization_id, workspace_id, name, auto_discover, retention_days, created_at FROM projects WHERE id = ?";
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
        return createProjectWithId(UuidV7.generate(), ownerId, null, null, name, autoDiscover, retentionDays, initialDiagram);
    }

    @Override
    public Project createProjectInOrganization(
            UUID ownerId,
            UUID organizationId,
            UUID workspaceId,
            String name,
            boolean autoDiscover,
            int retentionDays,
            DiagramGraph initialDiagram
    ) {
        return createProjectWithId(UuidV7.generate(), ownerId, organizationId, workspaceId, name, autoDiscover, retentionDays, initialDiagram);
    }

    public Project createProjectWithId(
            UUID projectId,
            UUID ownerId,
            String name,
            boolean autoDiscover,
            int retentionDays,
            DiagramGraph initialDiagram
    ) {
        return createProjectWithId(projectId, ownerId, null, null, name, autoDiscover, retentionDays, initialDiagram);
    }

    public Project createProjectWithId(
            UUID projectId,
            UUID ownerId,
            UUID organizationId,
            UUID workspaceId,
            String name,
            boolean autoDiscover,
            int retentionDays,
            DiagramGraph initialDiagram
    ) {
        Instant now = Instant.now();
        String insertProject = "INSERT INTO projects (id, owner_id, organization_id, workspace_id, name, auto_discover, retention_days, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection()) {
            try (PreparedStatement ps = conn.prepareStatement(insertProject)) {
                ps.setObject(1, projectId);
                ps.setObject(2, ownerId);
                ps.setObject(3, organizationId);
                ps.setObject(4, workspaceId);
                ps.setString(5, name);
                ps.setBoolean(6, autoDiscover);
                ps.setInt(7, retentionDays);
                ps.setTimestamp(8, Timestamp.from(now));
                ps.executeUpdate();
            }
            saveDiagramVersion(projectId, initialDiagram);
            return new Project(projectId, ownerId, organizationId, workspaceId, name, autoDiscover, retentionDays, now);
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
            return new Project(
                    projectId,
                    current.ownerId(),
                    current.organizationId(),
                    current.workspaceId(),
                    newName,
                    newDiscover,
                    newRetention,
                    current.createdAt()
            );
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
        String sql = "SELECT id, project_id, version, graph, created_at, author_email, change_summary FROM diagrams WHERE project_id = ? ORDER BY version DESC LIMIT 1";
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
        return saveDiagramVersion(projectId, graph, "dev@flowtrace.local", "Published diagram");
    }

    @Override
    public synchronized DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph, String authorEmail, String changeSummary) {
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
            String effectiveAuthor = (authorEmail != null && !authorEmail.isBlank()) ? authorEmail.trim() : "dev@flowtrace.local";
            String effectiveSummary = (changeSummary != null && !changeSummary.isBlank()) ? changeSummary.trim() : "Published version v" + nextVersion;

            try (PreparedStatement ins = conn.prepareStatement(
                    "INSERT INTO diagrams (id, project_id, version, graph, created_at, author_email, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
                ins.setObject(1, diagId);
                ins.setObject(2, projectId);
                ins.setInt(3, nextVersion);
                ins.setString(4, json);
                ins.setTimestamp(5, Timestamp.from(now));
                ins.setString(6, effectiveAuthor);
                ins.setString(7, effectiveSummary);
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

            return new DiagramVersion(diagId, projectId, nextVersion, graph, now, effectiveAuthor, effectiveSummary);
        } catch (SQLException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to save diagram version", e);
        }
    }

    @Override
    public List<DiagramVersion> listDiagramVersions(UUID projectId) {
        String sql = "SELECT id, project_id, version, graph, created_at, author_email, change_summary FROM diagrams WHERE project_id = ? ORDER BY version DESC LIMIT 20";
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
    public Optional<DiagramVersion> findDiagramVersion(UUID projectId, int version) {
        String sql = "SELECT id, project_id, version, graph, created_at, author_email, change_summary FROM diagrams WHERE project_id = ? AND version = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            ps.setInt(2, version);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapDiagram(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find diagram version " + version, e);
        }
    }

    @Override
    public Optional<dev.flowtrace.domain.DiagramDraft> getDiagramDraft(UUID projectId) {
        String sql = "SELECT project_id, draft_version, based_on_version, graph, updated_by, updated_at FROM project_diagram_drafts WHERE project_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    DiagramGraph graph = objectMapper.readValue(rs.getString("graph"), DiagramGraph.class);
                    return Optional.of(new dev.flowtrace.domain.DiagramDraft(
                            UUID.fromString(rs.getString("project_id")),
                            rs.getInt("draft_version"),
                            rs.getInt("based_on_version"),
                            graph,
                            rs.getString("updated_by"),
                            rs.getTimestamp("updated_at").toInstant()
                    ));
                }
            }
            return Optional.empty();
        } catch (SQLException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to load diagram draft", e);
        }
    }

    @Override
    public synchronized dev.flowtrace.domain.DiagramDraft saveDiagramDraft(
            UUID projectId,
            DiagramGraph graph,
            int basedOnVersion,
            String updatedBy
    ) {
        Instant now = Instant.now();
        String effectiveUser = (updatedBy != null && !updatedBy.isBlank()) ? updatedBy.trim() : "dev@flowtrace.local";
        try (Connection conn = dataSource.getConnection()) {
            String json = objectMapper.writeValueAsString(graph);
            int currentDraftVer = 0;
            try (PreparedStatement sel = conn.prepareStatement("SELECT draft_version FROM project_diagram_drafts WHERE project_id = ?")) {
                sel.setObject(1, projectId);
                try (ResultSet rs = sel.executeQuery()) {
                    if (rs.next()) {
                        currentDraftVer = rs.getInt(1);
                    }
                }
            }
            int nextDraftVer = currentDraftVer + 1;
            if (currentDraftVer == 0) {
                try (PreparedStatement ins = conn.prepareStatement(
                        "INSERT INTO project_diagram_drafts (project_id, draft_version, based_on_version, graph, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)")) {
                    ins.setObject(1, projectId);
                    ins.setInt(2, nextDraftVer);
                    ins.setInt(3, basedOnVersion);
                    ins.setString(4, json);
                    ins.setString(5, effectiveUser);
                    ins.setTimestamp(6, Timestamp.from(now));
                    ins.executeUpdate();
                }
            } else {
                try (PreparedStatement upd = conn.prepareStatement(
                        "UPDATE project_diagram_drafts SET draft_version = ?, based_on_version = ?, graph = ?, updated_by = ?, updated_at = ? WHERE project_id = ?")) {
                    upd.setInt(1, nextDraftVer);
                    upd.setInt(2, basedOnVersion);
                    upd.setString(3, json);
                    upd.setString(4, effectiveUser);
                    upd.setTimestamp(5, Timestamp.from(now));
                    upd.setObject(6, projectId);
                    upd.executeUpdate();
                }
            }
            return new dev.flowtrace.domain.DiagramDraft(projectId, nextDraftVer, basedOnVersion, graph, effectiveUser, now);
        } catch (SQLException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to save diagram draft", e);
        }
    }

    @Override
    public List<dev.flowtrace.domain.CustomBlockDefinition> listCustomBlocks(UUID organizationId) {
        String sql = "SELECT id, organization_id, name, category, node_type, role, icon, tint, key_pattern, default_props, created_at FROM org_custom_blocks WHERE organization_id = ? ORDER BY created_at DESC";
        List<dev.flowtrace.domain.CustomBlockDefinition> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapCustomBlock(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list custom blocks", e);
        }
    }

    @Override
    public dev.flowtrace.domain.CustomBlockDefinition createCustomBlock(dev.flowtrace.domain.CustomBlockDefinition block) {
        String sql = "INSERT INTO org_custom_blocks (id, organization_id, name, category, node_type, role, icon, tint, key_pattern, default_props, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            String propsJson = block.defaultProps() != null ? objectMapper.writeValueAsString(block.defaultProps()) : "{}";
            ps.setObject(1, block.id());
            ps.setObject(2, block.organizationId());
            ps.setString(3, block.name());
            ps.setString(4, block.category());
            ps.setString(5, block.nodeType().name());
            ps.setString(6, block.role());
            ps.setString(7, block.icon());
            ps.setString(8, block.tint());
            ps.setString(9, block.keyPattern());
            ps.setString(10, propsJson);
            ps.setTimestamp(11, Timestamp.from(block.createdAt()));
            ps.executeUpdate();
            return block;
        } catch (SQLException | JsonProcessingException e) {
            throw new IllegalStateException("Failed to create custom block", e);
        }
    }

    @Override
    public boolean deleteCustomBlock(UUID organizationId, UUID blockId) {
        String sql = "DELETE FROM org_custom_blocks WHERE id = ? AND organization_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, blockId);
            ps.setObject(2, organizationId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to delete custom block", e);
        }
    }

    @Override
    public List<ApiKey> listApiKeys(UUID projectId) {
        String sql = "SELECT id, project_id, name, key_prefix, key_hash, rate_limit_per_s, scopes, last_ip_hash, created_at, last_used_at, revoked_at, expires_at FROM api_keys WHERE project_id = ? ORDER BY created_at DESC";
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
        return createApiKey(projectId, name, keyPrefix, keyHash, rateLimitPerS, "ingest");
    }

    @Override
    public ApiKey createApiKey(UUID projectId, String name, String keyPrefix, String keyHash, int rateLimitPerS, String scopes) {
        UUID id = UuidV7.generate();
        Instant now = Instant.now();
        String effectiveScopes = (scopes == null || scopes.isBlank()) ? "ingest" : scopes.trim();
        String sql = "INSERT INTO api_keys (id, project_id, name, key_prefix, key_hash, rate_limit_per_s, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, projectId);
            ps.setString(3, name);
            ps.setString(4, keyPrefix);
            ps.setString(5, keyHash);
            ps.setInt(6, rateLimitPerS);
            ps.setString(7, effectiveScopes);
            ps.setTimestamp(8, Timestamp.from(now));
            ps.executeUpdate();
            return new ApiKey(id, projectId, name, keyPrefix, keyHash, rateLimitPerS, effectiveScopes, null, now, null, null, null);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create API key", e);
        }
    }

    @Override
    public ApiKey rotateApiKey(UUID projectId, UUID oldKeyId, ApiKey newKey, Instant oldKeyExpiresAt) {
        String scheduleSql = "UPDATE api_keys SET expires_at = ? WHERE id = ? AND project_id = ? AND revoked_at IS NULL";
        String insertSql = "INSERT INTO api_keys (id, project_id, name, key_prefix, key_hash, rate_limit_per_s, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement psSched = conn.prepareStatement(scheduleSql)) {
                psSched.setTimestamp(1, Timestamp.from(oldKeyExpiresAt));
                psSched.setObject(2, oldKeyId);
                psSched.setObject(3, projectId);
                psSched.executeUpdate();
            }
            try (PreparedStatement psInsert = conn.prepareStatement(insertSql)) {
                psInsert.setObject(1, newKey.id());
                psInsert.setObject(2, newKey.projectId());
                psInsert.setString(3, newKey.name());
                psInsert.setString(4, newKey.keyPrefix());
                psInsert.setString(5, newKey.keyHash());
                psInsert.setInt(6, newKey.rateLimitPerS());
                psInsert.setString(7, newKey.scopes());
                psInsert.setTimestamp(8, Timestamp.from(newKey.createdAt()));
                psInsert.executeUpdate();
            }
            conn.commit();
            return newKey;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to rotate API key", e);
        }
    }

    @Override
    public Optional<ApiKey> findActiveKeyByHash(String keyHash) {
        String sql = "SELECT id, project_id, name, key_prefix, key_hash, rate_limit_per_s, scopes, last_ip_hash, created_at, last_used_at, revoked_at, expires_at FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)";
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
        updateApiKeyUsage(keyId, null);
    }

    @Override
    public void updateApiKeyUsage(UUID keyId, String lastIpHash) {
        String sql = lastIpHash != null
                ? "UPDATE api_keys SET last_used_at = ?, last_ip_hash = ? WHERE id = ?"
                : "UPDATE api_keys SET last_used_at = ? WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(Instant.now()));
            if (lastIpHash != null) {
                ps.setString(2, lastIpHash);
                ps.setObject(3, keyId);
            } else {
                ps.setObject(2, keyId);
            }
            ps.executeUpdate();
        } catch (SQLException ignored) {
        }
    }

    private Project mapProject(ResultSet rs) throws SQLException {
        String orgStr = rs.getString("organization_id");
        String wsStr = rs.getString("workspace_id");
        return new Project(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("owner_id")),
                orgStr != null ? UUID.fromString(orgStr) : null,
                wsStr != null ? UUID.fromString(wsStr) : null,
                rs.getString("name"),
                rs.getBoolean("auto_discover"),
                rs.getInt("retention_days"),
                rs.getTimestamp("created_at").toInstant()
        );
    }

    private DiagramVersion mapDiagram(ResultSet rs) throws SQLException {
        try {
            DiagramGraph graph = objectMapper.readValue(rs.getString("graph"), DiagramGraph.class);
            String authorEmail = "dev@flowtrace.local";
            String changeSummary = "Published diagram";
            try {
                String ae = rs.getString("author_email");
                if (ae != null && !ae.isBlank()) authorEmail = ae;
            } catch (SQLException ignored) {
            }
            try {
                String cs = rs.getString("change_summary");
                if (cs != null && !cs.isBlank()) changeSummary = cs;
            } catch (SQLException ignored) {
            }
            return new DiagramVersion(
                    UUID.fromString(rs.getString("id")),
                    UUID.fromString(rs.getString("project_id")),
                    rs.getInt("version"),
                    graph,
                    rs.getTimestamp("created_at").toInstant(),
                    authorEmail,
                    changeSummary
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to parse diagram JSON", e);
        }
    }

    @SuppressWarnings("unchecked")
    private dev.flowtrace.domain.CustomBlockDefinition mapCustomBlock(ResultSet rs) throws SQLException {
        java.util.Map<String, Object> defaultProps = java.util.Collections.emptyMap();
        String propsJson = rs.getString("default_props");
        if (propsJson != null && !propsJson.isBlank()) {
            try {
                defaultProps = objectMapper.readValue(propsJson, java.util.Map.class);
            } catch (Exception ignored) {
            }
        }
        dev.flowtrace.domain.NodeType nodeType = dev.flowtrace.domain.NodeType.service;
        try {
            nodeType = dev.flowtrace.domain.NodeType.valueOf(rs.getString("node_type"));
        } catch (Exception ignored) {
        }
        return new dev.flowtrace.domain.CustomBlockDefinition(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("organization_id")),
                rs.getString("name"),
                rs.getString("category"),
                nodeType,
                rs.getString("role"),
                rs.getString("icon"),
                rs.getString("tint"),
                rs.getString("key_pattern"),
                defaultProps,
                rs.getTimestamp("created_at").toInstant()
        );
    }

    private ApiKey mapApiKey(ResultSet rs) throws SQLException {
        Timestamp lastUsed = rs.getTimestamp("last_used_at");
        Timestamp revoked = rs.getTimestamp("revoked_at");
        Timestamp expires = null;
        try {
            expires = rs.getTimestamp("expires_at");
        } catch (SQLException ignored) {
        }
        String scopes = "ingest";
        try {
            String sc = rs.getString("scopes");
            if (sc != null && !sc.isBlank()) {
                scopes = sc;
            }
        } catch (SQLException ignored) {
        }
        String lastIpHash = null;
        try {
            lastIpHash = rs.getString("last_ip_hash");
        } catch (SQLException ignored) {
        }

        return new ApiKey(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("project_id")),
                rs.getString("name"),
                rs.getString("key_prefix"),
                rs.getString("key_hash"),
                rs.getInt("rate_limit_per_s"),
                scopes,
                lastIpHash,
                rs.getTimestamp("created_at").toInstant(),
                lastUsed != null ? lastUsed.toInstant() : null,
                revoked != null ? revoked.toInstant() : null,
                expires != null ? expires.toInstant() : null
        );
    }
}
