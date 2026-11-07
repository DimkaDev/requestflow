package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.Project;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository {

    UUID ensureUser(String externalId, String email);

    List<Project> findByOwner(UUID ownerId);

    Optional<Project> findById(UUID projectId);

    Project createProject(UUID ownerId, String name, boolean autoDiscover, int retentionDays, DiagramGraph initialDiagram);

    Project updateProject(UUID projectId, String name, Boolean autoDiscover, Integer retentionDays);

    void deleteProject(UUID projectId);

    Optional<DiagramVersion> getLatestDiagram(UUID projectId);

    DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph);

    List<DiagramVersion> listDiagramVersions(UUID projectId);

    List<ApiKey> listApiKeys(UUID projectId);

    ApiKey createApiKey(UUID projectId, String name, String keyPrefix, String keyHash, int rateLimitPerS);

    Optional<ApiKey> findActiveKeyByHash(String keyHash);

    boolean revokeApiKey(UUID projectId, UUID keyId);

    void touchApiKeyLastUsed(UUID keyId);
}
