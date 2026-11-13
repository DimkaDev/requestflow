package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.AlertRule;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AlertRuleRepository {
    AlertRule save(AlertRule rule);
    List<AlertRule> findByProjectId(UUID projectId);
    Optional<AlertRule> findById(UUID projectId, UUID alertId);
    void delete(UUID projectId, UUID alertId);
}
