package dev.flowtrace.adapter.out.pg;

import dev.flowtrace.application.port.out.AlertRuleRepository;
import dev.flowtrace.domain.AlertRule;
import jakarta.enterprise.context.ApplicationScoped;
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
public class JdbcAlertRuleRepository implements AlertRuleRepository {

    private final DataSource dataSource;

    public JdbcAlertRuleRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public AlertRule save(AlertRule rule) {
        String sql = """
            INSERT INTO alert_rules (
                id, project_id, name, severity, metric, threshold, window_seconds,
                target_node, channel_type, channel_target, enabled, muted_until,
                last_fired_at, fire_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                severity = EXCLUDED.severity,
                metric = EXCLUDED.metric,
                threshold = EXCLUDED.threshold,
                window_seconds = EXCLUDED.window_seconds,
                target_node = EXCLUDED.target_node,
                channel_type = EXCLUDED.channel_type,
                channel_target = EXCLUDED.channel_target,
                enabled = EXCLUDED.enabled,
                muted_until = EXCLUDED.muted_until,
                last_fired_at = EXCLUDED.last_fired_at,
                fire_count = EXCLUDED.fire_count
            """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, rule.id());
            ps.setObject(2, rule.projectId());
            ps.setString(3, rule.name());
            ps.setString(4, rule.severity());
            ps.setString(5, rule.metric());
            ps.setDouble(6, rule.threshold());
            ps.setInt(7, rule.windowSeconds());
            ps.setString(8, rule.targetNode());
            ps.setString(9, rule.channelType());
            ps.setString(10, rule.channelTarget());
            ps.setBoolean(11, rule.enabled());
            ps.setTimestamp(12, rule.mutedUntil() != null ? Timestamp.from(rule.mutedUntil()) : null);
            ps.setTimestamp(13, rule.lastFiredAt() != null ? Timestamp.from(rule.lastFiredAt()) : null);
            ps.setInt(14, rule.fireCount());
            ps.setTimestamp(15, Timestamp.from(rule.createdAt()));
            ps.executeUpdate();
            return rule;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to save alert rule", e);
        }
    }

    @Override
    public List<AlertRule> findByProjectId(UUID projectId) {
        String sql = "SELECT * FROM alert_rules WHERE project_id = ? ORDER BY created_at DESC";
        List<AlertRule> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapRow(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list alert rules", e);
        }
    }

    @Override
    public Optional<AlertRule> findById(UUID projectId, UUID alertId) {
        String sql = "SELECT * FROM alert_rules WHERE id = ? AND project_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, alertId);
            ps.setObject(2, projectId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapRow(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to find alert rule", e);
        }
    }

    @Override
    public void delete(UUID projectId, UUID alertId) {
        String sql = "DELETE FROM alert_rules WHERE id = ? AND project_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, alertId);
            ps.setObject(2, projectId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to delete alert rule", e);
        }
    }

    private AlertRule mapRow(ResultSet rs) throws SQLException {
        Timestamp mutedTs = rs.getTimestamp("muted_until");
        Timestamp firedTs = rs.getTimestamp("last_fired_at");
        Instant mutedUntil = mutedTs != null ? mutedTs.toInstant() : null;
        Instant lastFiredAt = firedTs != null ? firedTs.toInstant() : null;
        return new AlertRule(
                rs.getObject("id", UUID.class),
                rs.getObject("project_id", UUID.class),
                rs.getString("name"),
                rs.getString("severity"),
                rs.getString("metric"),
                rs.getDouble("threshold"),
                rs.getInt("window_seconds"),
                rs.getString("target_node"),
                rs.getString("channel_type"),
                rs.getString("channel_target"),
                rs.getBoolean("enabled"),
                mutedUntil,
                lastFiredAt,
                rs.getInt("fire_count"),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
