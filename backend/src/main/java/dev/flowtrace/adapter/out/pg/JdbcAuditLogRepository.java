package dev.flowtrace.adapter.out.pg;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.port.out.AuditLogRepository;
import dev.flowtrace.domain.AuditLogEntry;
import dev.flowtrace.domain.UuidV7;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class JdbcAuditLogRepository implements AuditLogRepository {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper;

    @Inject
    public JdbcAuditLogRepository(DataSource dataSource, ObjectMapper objectMapper) {
        this.dataSource = dataSource;
        this.objectMapper = objectMapper;
    }

    @Override
    public AuditLogEntry append(
            UUID organizationId,
            UUID actorUserId,
            String actorEmail,
            String action,
            String targetType,
            String targetId,
            Map<String, Object> meta
    ) {
        UUID id = UuidV7.generate();
        Instant now = Instant.now();
        String resolvedEmail = resolveActorEmail(actorUserId, actorEmail);
        Map<String, Object> safeMeta = meta != null ? meta : Collections.emptyMap();
        String metaJson;
        try {
            metaJson = safeMeta.isEmpty() ? "{}" : objectMapper.writeValueAsString(safeMeta);
        } catch (Exception e) {
            metaJson = "{}";
        }

        String sql = """
                INSERT INTO audit_log
                (id, organization_id, actor_user_id, actor_email, action, target_type, target_id, meta, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, organizationId);
            if (actorUserId != null) {
                ps.setObject(3, actorUserId);
            } else {
                ps.setNull(3, Types.OTHER);
            }
            ps.setString(4, resolvedEmail);
            ps.setString(5, action);
            ps.setString(6, targetType);
            ps.setString(7, targetId != null ? targetId : "");
            ps.setString(8, metaJson);
            ps.setTimestamp(9, Timestamp.from(now));
            ps.executeUpdate();
            return new AuditLogEntry(
                    id,
                    organizationId,
                    actorUserId,
                    resolvedEmail,
                    action,
                    targetType,
                    targetId != null ? targetId : "",
                    safeMeta,
                    now
            );
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to append audit log entry for organization " + organizationId, e);
        }
    }

    @Override
    public List<AuditLogEntry> listByOrganization(UUID organizationId, String actionFilter, int limit) {
        int safeLimit = Math.clamp(limit <= 0 ? 50 : limit, 1, 200);
        StringBuilder sql = new StringBuilder("""
                SELECT id, organization_id, actor_user_id, actor_email, action, target_type, target_id, meta, created_at
                FROM audit_log
                WHERE organization_id = ?
                """);
        boolean hasFilter = actionFilter != null && !actionFilter.isBlank();
        if (hasFilter) {
            sql.append(" AND LOWER(action) LIKE ?");
        }
        sql.append(" ORDER BY created_at DESC LIMIT ").append(safeLimit);

        List<AuditLogEntry> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            ps.setObject(1, organizationId);
            if (hasFilter) {
                ps.setString(2, actionFilter.trim().toLowerCase() + "%");
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapEntry(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list audit logs for organization " + organizationId, e);
        }
    }

    private String resolveActorEmail(UUID actorUserId, String providedEmail) {
        if (providedEmail != null && !providedEmail.isBlank()) {
            return providedEmail.trim();
        }
        if (actorUserId == null) {
            return "system@flowtrace.local";
        }
        String sql = "SELECT email FROM users WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, actorUserId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    String found = rs.getString("email");
                    if (found != null && !found.isBlank()) {
                        return found;
                    }
                }
            }
        } catch (SQLException ignored) {
        }
        return "user-" + actorUserId.toString().substring(0, 8) + "@flowtrace.local";
    }

    private AuditLogEntry mapEntry(ResultSet rs) throws SQLException {
        String actorStr = rs.getString("actor_user_id");
        String metaStr = rs.getString("meta");
        Map<String, Object> meta = Collections.emptyMap();
        if (metaStr != null && !metaStr.isBlank()) {
            try {
                meta = objectMapper.readValue(metaStr, new TypeReference<>() {
                });
            } catch (Exception ignored) {
            }
        }
        return new AuditLogEntry(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("organization_id")),
                actorStr != null ? UUID.fromString(actorStr) : null,
                rs.getString("actor_email"),
                rs.getString("action"),
                rs.getString("target_type"),
                rs.getString("target_id"),
                meta,
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
