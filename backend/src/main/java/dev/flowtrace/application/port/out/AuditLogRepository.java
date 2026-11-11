package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.AuditLogEntry;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Outbound port for persisting and querying multi-tenant organization audit logs (E1-Step-8).
 */
public interface AuditLogRepository {

    AuditLogEntry append(
            UUID organizationId,
            UUID actorUserId,
            String actorEmail,
            String action,
            String targetType,
            String targetId,
            Map<String, Object> meta
    );

    List<AuditLogEntry> listByOrganization(UUID organizationId, String actionFilter, int limit);
}
