package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.CustomBlockDefinition;
import dev.flowtrace.domain.DiagramDraft;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.Project;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectRepository {

    UUID ensureUser(String externalId, String email);

    List<Project> findByOwner(UUID ownerId);

    List<Project> findAccessibleByUser(UUID userId, UUID organizationId, UUID workspaceId);

    Optional<Project> findById(UUID projectId);

    Project createProject(UUID ownerId, String name, boolean autoDiscover, int retentionDays, DiagramGraph initialDiagram);

    Project createProjectInOrganization(
            UUID ownerId,
            UUID organizationId,
            UUID workspaceId,
            String name,
            boolean autoDiscover,
            int retentionDays,
            DiagramGraph initialDiagram
    );

    Project updateProject(UUID projectId, String name, Boolean autoDiscover, Integer retentionDays);

    void deleteProject(UUID projectId);

    Optional<DiagramVersion> getLatestDiagram(UUID projectId);

    DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph);

    DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph, String authorEmail, String changeSummary);

    List<DiagramVersion> listDiagramVersions(UUID projectId);

    Optional<DiagramVersion> findDiagramVersion(UUID projectId, int version);

    Optional<DiagramDraft> getDiagramDraft(UUID projectId);

    DiagramDraft saveDiagramDraft(UUID projectId, DiagramGraph graph, int basedOnVersion, String updatedBy);

    List<CustomBlockDefinition> listCustomBlocks(UUID organizationId);

    CustomBlockDefinition createCustomBlock(CustomBlockDefinition block);

    boolean deleteCustomBlock(UUID organizationId, UUID blockId);

    List<ApiKey> listApiKeys(UUID projectId);

    ApiKey createApiKey(UUID projectId, String name, String keyPrefix, String keyHash, int rateLimitPerS);

    ApiKey createApiKey(UUID projectId, String name, String keyPrefix, String keyHash, int rateLimitPerS, String scopes);

    ApiKey rotateApiKey(UUID projectId, UUID oldKeyId, ApiKey newKey, java.time.Instant oldKeyExpiresAt);

    void updateApiKeyUsage(UUID keyId, String lastIpHash);

    Optional<ApiKey> findActiveKeyByHash(String keyHash);

    boolean revokeApiKey(UUID projectId, UUID keyId);

    void touchApiKeyLastUsed(UUID keyId);
}
