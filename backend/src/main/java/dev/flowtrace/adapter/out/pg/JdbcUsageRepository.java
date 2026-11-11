package dev.flowtrace.adapter.out.pg;

import dev.flowtrace.application.port.out.UsageRepository;
import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.ProjectUsage;
import dev.flowtrace.domain.UsageBucket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class JdbcUsageRepository implements UsageRepository {

    private final DataSource dataSource;

    @Inject
    public JdbcUsageRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public void recordUsageBatch(List<UsageDelta> deltas) {
        if (deltas == null || deltas.isEmpty()) {
            return;
        }

        String sql = """
            INSERT INTO usage_counters (organization_id, project_id, bucket_date, events_count, bytes_count)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (project_id, bucket_date)
            DO UPDATE SET
                events_count = usage_counters.events_count + EXCLUDED.events_count,
                bytes_count = usage_counters.bytes_count + EXCLUDED.bytes_count
            """;

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            for (UsageDelta d : deltas) {
                ps.setObject(1, d.organizationId());
                ps.setObject(2, d.projectId());
                ps.setDate(3, Date.valueOf(d.date()));
                ps.setLong(4, d.eventsCount());
                ps.setLong(5, d.bytesCount());
                ps.addBatch();
            }
            ps.executeBatch();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to execute usage counters batch update", e);
        }
    }

    @Override
    public long getMonthlyEventsCount(UUID organizationId, YearMonth month) {
        LocalDate startDate = month.atDay(1);
        LocalDate endDate = month.atEndOfMonth();

        String sql = """
            SELECT COALESCE(SUM(events_count), 0)
            FROM usage_counters
            WHERE organization_id = ? AND bucket_date >= ? AND bucket_date <= ?
            """;

        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.setDate(2, Date.valueOf(startDate));
            ps.setDate(3, Date.valueOf(endDate));
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to query monthly usage count for org " + organizationId, e);
        }
        return 0L;
    }

    @Override
    public OrganizationUsage getOrganizationUsage(UUID organizationId, YearMonth month, PlanTier planTier) {
        LocalDate startDate = month.atDay(1);
        LocalDate endDate = month.atEndOfMonth();

        String projectSql = """
            SELECT p.id, p.name,
                   COALESCE(SUM(uc.events_count), 0) AS total_events,
                   COALESCE(SUM(uc.bytes_count), 0) AS total_bytes
            FROM projects p
            LEFT JOIN usage_counters uc
                   ON uc.project_id = p.id
                  AND uc.bucket_date >= ?
                  AND uc.bucket_date <= ?
            WHERE p.organization_id = ?
            GROUP BY p.id, p.name
            ORDER BY total_events DESC, p.name ASC
            """;

        String dailySql = """
            SELECT project_id, bucket_date, events_count, bytes_count
            FROM usage_counters
            WHERE organization_id = ?
              AND bucket_date >= ?
              AND bucket_date <= ?
            ORDER BY bucket_date ASC
            """;

        long totalEvents = 0L;
        long totalBytes = 0L;
        Map<UUID, List<UsageBucket>> dailyByProject = new HashMap<>();

        try (Connection conn = dataSource.getConnection()) {
            try (PreparedStatement psDaily = conn.prepareStatement(dailySql)) {
                psDaily.setObject(1, organizationId);
                psDaily.setDate(2, Date.valueOf(startDate));
                psDaily.setDate(3, Date.valueOf(endDate));
                try (ResultSet rs = psDaily.executeQuery()) {
                    while (rs.next()) {
                        UUID pid = (UUID) rs.getObject("project_id");
                        LocalDate date = rs.getDate("bucket_date").toLocalDate();
                        long ev = rs.getLong("events_count");
                        long bytes = rs.getLong("bytes_count");
                        dailyByProject.computeIfAbsent(pid, k -> new ArrayList<>())
                                .add(new UsageBucket(date, ev, bytes));
                    }
                }
            }

            List<ProjectUsage> projects = new ArrayList<>();
            try (PreparedStatement psProjects = conn.prepareStatement(projectSql)) {
                psProjects.setDate(1, Date.valueOf(startDate));
                psProjects.setDate(2, Date.valueOf(endDate));
                psProjects.setObject(3, organizationId);
                try (ResultSet rs = psProjects.executeQuery()) {
                    while (rs.next()) {
                        UUID pid = (UUID) rs.getObject("id");
                        String name = rs.getString("name");
                        long pEvents = rs.getLong("total_events");
                        long pBytes = rs.getLong("total_bytes");
                        totalEvents += pEvents;
                        totalBytes += pBytes;

                        List<UsageBucket> history = dailyByProject.getOrDefault(pid, List.of());
                        projects.add(new ProjectUsage(pid, name, pEvents, pBytes, history));
                    }
                }
            }

            return OrganizationUsage.of(organizationId, planTier, totalEvents, totalBytes, projects);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to load organization usage breakdown for " + organizationId, e);
        }
    }
}
