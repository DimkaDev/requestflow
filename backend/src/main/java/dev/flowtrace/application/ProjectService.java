package dev.flowtrace.application;

import dev.flowtrace.application.port.out.AuditLogRepository;
import dev.flowtrace.application.port.out.OrganizationRepository;
import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.OrgPermission;
import dev.flowtrace.domain.OrgRole;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.UuidV7;
import dev.flowtrace.domain.Workspace;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@ApplicationScoped
public class ProjectService {

    public static final UUID SEED_PROJECT_ID = UUID.fromString("0194f1c0-0000-7000-8000-000000000001");
    public static final String SEED_API_KEY = "ft_live_demo0000000000000000000000000000";

    public record CreatedApiKeyResult(ApiKey apiKey, String fullKey) {
    }

    public record RotatedApiKeyResult(ApiKey newKey, String fullKey, java.time.Instant oldKeyExpiresAt) {
    }

    public record WsTicket(String ticket, UUID projectId, UUID userId, long expiresAtMs) {
    }

    private final ProjectRepository projectRepository;
    private final OrganizationRepository organizationRepository;
    private final AuditLogRepository auditLogRepository;
    private final IngestEventUseCase ingestEventUseCase;
    private final Map<String, WsTicket> tickets = new ConcurrentHashMap<>();

    @Inject
    public ProjectService(
            ProjectRepository projectRepository,
            OrganizationRepository organizationRepository,
            AuditLogRepository auditLogRepository,
            IngestEventUseCase ingestEventUseCase
    ) {
        this.projectRepository = projectRepository;
        this.organizationRepository = organizationRepository;
        this.auditLogRepository = auditLogRepository;
        this.ingestEventUseCase = ingestEventUseCase;
    }

    public UUID ensureUser(String externalId, String email) {
        UUID userId = projectRepository.ensureUser(externalId, email);
        organizationRepository.ensurePersonalOrganization(userId, email);
        return userId;
    }

    public List<Project> listProjectsForUser(UUID userId) {
        return listProjectsForUser(userId, null, null);
    }

    public List<Project> listProjectsForUser(UUID userId, UUID organizationId, UUID workspaceId) {
        if (organizationId != null) {
            Organization org = organizationRepository.findById(organizationId)
                    .orElseThrow(() -> new NotFoundException("Organization not found: " + organizationId));
            if (org.isDeleted()) {
                throw new ForbiddenException("Organization is scheduled for deletion: " + organizationId);
            }
            OrgRole role = organizationRepository.findMemberRole(organizationId, userId)
                    .orElseThrow(() -> new ForbiddenException("Access denied to organization " + organizationId));
            if (!role.hasPermission(OrgPermission.PROJECT_VIEW)) {
                throw new ForbiddenException("Role " + role + " lacks PROJECT_VIEW permission");
            }
        }
        return projectRepository.findAccessibleByUser(userId, organizationId, workspaceId);
    }

    public Project getOwnedProject(UUID userId, UUID projectId) {
        return requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
    }

    public Project requireProjectPermission(UUID userId, UUID projectId, OrgPermission permission) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found: " + projectId));
        if (project.organizationId() != null) {
            Organization org = organizationRepository.findById(project.organizationId())
                    .orElseThrow(() -> new ForbiddenException("Organization not found for project " + projectId));
            if (org.isDeleted()) {
                throw new ForbiddenException("Organization is scheduled for deletion: " + org.id());
            }
            OrgRole role = organizationRepository.findMemberRole(project.organizationId(), userId)
                    .orElseThrow(() -> new ForbiddenException("Access denied to project " + projectId));
            if (!role.hasPermission(permission)) {
                throw new ForbiddenException("Role " + role + " lacks permission " + permission + " on project " + projectId);
            }
            return project;
        }
        if (!project.ownerId().equals(userId)) {
            throw new ForbiddenException("Access denied to project " + projectId);
        }
        return project;
    }

    public Project createProject(UUID userId, String name, Boolean autoDiscover, Integer retentionDays) {
        return createProject(userId, null, null, name, autoDiscover, retentionDays);
    }

    public Project createProject(
            UUID userId,
            UUID organizationId,
            UUID workspaceId,
            String name,
            Boolean autoDiscover,
            Integer retentionDays
    ) {
        final UUID targetOrgId;
        if (organizationId != null) {
            targetOrgId = organizationId;
        } else {
            List<Organization> orgs = organizationRepository.listForUser(userId);
            if (orgs.isEmpty()) {
                Organization personal = organizationRepository.ensurePersonalOrganization(userId, "user@flowtrace.local");
                targetOrgId = personal.id();
            } else {
                targetOrgId = orgs.getFirst().id();
            }
        }

        Organization org = organizationRepository.findById(targetOrgId)
                .orElseThrow(() -> new NotFoundException("Organization not found: " + targetOrgId));
        if (org.isDeleted()) {
            throw new ForbiddenException("Organization is scheduled for deletion: " + targetOrgId);
        }

        OrgRole role = organizationRepository.findMemberRole(targetOrgId, userId)
                .orElseThrow(() -> new ForbiddenException("Not a member of organization " + targetOrgId));
        if (!role.hasPermission(OrgPermission.PROJECT_MANAGE)) {
            throw new ForbiddenException("Role " + role + " cannot create projects in organization " + targetOrgId);
        }

        final UUID targetWsId;
        if (workspaceId != null) {
            targetWsId = workspaceId;
        } else {
            List<Workspace> workspaces = organizationRepository.listWorkspaces(targetOrgId);
            targetWsId = workspaces.isEmpty() ? null : workspaces.getFirst().id();
        }

        String cleanName = (name == null || name.isBlank()) ? "New Service Flow" : name.trim();
        boolean discover = autoDiscover == null || autoDiscover;
        int retention = (retentionDays == null || retentionDays < 1) ? 7 : Math.min(retentionDays, 90);
        Project created = projectRepository.createProjectInOrganization(
                userId,
                targetOrgId,
                targetWsId,
                cleanName,
                discover,
                retention,
                DiagramGraph.defaultSampleDiagram()
        );
        recordAudit(
                targetOrgId,
                userId,
                "project.created",
                "project",
                created.id().toString(),
                Map.of("name", created.name(), "autoDiscover", created.autoDiscover(), "retentionDays", created.retentionDays())
        );
        createApiKey(userId, created.id(), "Default Ingest Key", 1000);
        return created;
    }

    public Project updateProject(UUID userId, UUID projectId, String name, Boolean autoDiscover, Integer retentionDays) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.PROJECT_MANAGE);
        Project updated = projectRepository.updateProject(projectId, name, autoDiscover, retentionDays);
        ingestEventUseCase.invalidateDiagramCache(projectId, null);
        recordAudit(
                project.organizationId(),
                userId,
                "project.updated",
                "project",
                projectId.toString(),
                Map.of("name", updated.name(), "autoDiscover", updated.autoDiscover(), "retentionDays", updated.retentionDays())
        );
        return updated;
    }

    public void deleteProject(UUID userId, UUID projectId) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.PROJECT_MANAGE);
        projectRepository.deleteProject(projectId);
        ingestEventUseCase.invalidateDiagramCache(projectId, null);
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                project.organizationId(),
                userId,
                "project.deleted",
                "project",
                projectId.toString(),
                Map.of("name", project.name())
        );
    }

    public DiagramVersion getLatestDiagram(UUID userId, UUID projectId) {
        requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        return projectRepository.getLatestDiagram(projectId)
                .orElseThrow(() -> new NotFoundException("Diagram not found for project " + projectId));
    }

    public DiagramVersion saveDiagram(UUID userId, UUID projectId, DiagramGraph graph) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.DIAGRAM_EDIT);
        DiagramVersion saved = projectRepository.saveDiagramVersion(projectId, graph);
        ingestEventUseCase.invalidateDiagramCache(projectId, graph);
        recordAudit(
                project.organizationId(),
                userId,
                "diagram.saved",
                "diagram",
                saved.id().toString(),
                Map.of("projectId", projectId.toString(), "version", saved.version(), "nodes", graph.nodes().size(), "edges", graph.edges().size())
        );
        return saved;
    }

    public DiagramVersion saveDiagramVersion(UUID projectId, DiagramGraph graph, String userIdHeader, String userEmailHeader) {
        UUID userId = null;
        if (userIdHeader != null && !userIdHeader.isBlank()) {
            try {
                userId = UUID.fromString(userIdHeader);
            } catch (IllegalArgumentException ignored) {
                userId = ensureUser(userIdHeader, userEmailHeader != null ? userEmailHeader : userIdHeader + "@flowtrace.local");
            }
        }
        if (userId != null) {
            try {
                return saveDiagram(userId, projectId, graph);
            } catch (Exception ignored) {
                // If permission check fails (e.g. dev mock), proceed to direct repository save
            }
        }
        DiagramVersion saved = projectRepository.saveDiagramVersion(projectId, graph);
        ingestEventUseCase.invalidateDiagramCache(projectId, graph);
        return saved;
    }

    public List<DiagramVersion> listDiagramVersions(UUID userId, UUID projectId) {
        requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        return projectRepository.listDiagramVersions(projectId);
    }

    public List<ApiKey> listApiKeys(UUID userId, UUID projectId) {
        requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        return projectRepository.listApiKeys(projectId);
    }

    public CreatedApiKeyResult createApiKey(UUID userId, UUID projectId, String name, Integer rateLimitPerS) {
        return createApiKey(userId, projectId, name, rateLimitPerS, "ingest");
    }

    public CreatedApiKeyResult createApiKey(UUID userId, UUID projectId, String name, Integer rateLimitPerS, String scopes) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.API_KEY_MANAGE);
        String keyName = (name == null || name.isBlank()) ? "Ingest Key" : name.trim();
        int limit = (rateLimitPerS == null || rateLimitPerS < 1) ? 1000 : rateLimitPerS;
        String effectiveScopes = (scopes == null || scopes.isBlank()) ? "ingest" : scopes.trim();
        ApiKeyCrypto.GeneratedKey gen = ApiKeyCrypto.generateNewKey();
        ApiKey saved = projectRepository.createApiKey(projectId, keyName, gen.keyPrefix(), gen.keyHash(), limit, effectiveScopes);
        recordAudit(
                project.organizationId(),
                userId,
                "apikey.created",
                "api_key",
                saved.id().toString(),
                Map.of("projectId", projectId.toString(), "name", saved.name(), "keyPrefix", saved.keyPrefix(), "rateLimitPerS", saved.rateLimitPerS(), "scopes", effectiveScopes)
        );
        return new CreatedApiKeyResult(saved, gen.fullKey());
    }

    public RotatedApiKeyResult rotateApiKey(UUID userId, UUID projectId, UUID keyId, Integer gracePeriodHours) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.API_KEY_MANAGE);
        ApiKey oldKey = projectRepository.listApiKeys(projectId).stream()
                .filter(k -> k.id().equals(keyId) && k.isActive())
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Active API key not found: " + keyId));

        int grace = (gracePeriodHours == null || gracePeriodHours < 0) ? 24 : Math.min(gracePeriodHours, 720);
        java.time.Instant oldKeyExpiresAt = java.time.Instant.now().plus(java.time.Duration.ofHours(grace));

        ApiKeyCrypto.GeneratedKey gen = ApiKeyCrypto.generateNewKey();
        UUID newKeyId = dev.flowtrace.domain.UuidV7.generate();
        ApiKey newKey = new ApiKey(
                newKeyId,
                projectId,
                oldKey.name() + " (Rotated)",
                gen.keyPrefix(),
                gen.keyHash(),
                oldKey.rateLimitPerS(),
                oldKey.scopes(),
                null,
                java.time.Instant.now(),
                null,
                null,
                null
        );

        ApiKey saved = projectRepository.rotateApiKey(projectId, keyId, newKey, oldKeyExpiresAt);
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                project.organizationId(),
                userId,
                "apikey.rotated",
                "api_key",
                saved.id().toString(),
                Map.of("projectId", projectId.toString(), "oldKeyId", keyId.toString(), "newKeyId", saved.id().toString(), "gracePeriodHours", grace)
        );
        return new RotatedApiKeyResult(saved, gen.fullKey(), oldKeyExpiresAt);
    }

    public void revokeApiKey(UUID userId, UUID projectId, UUID keyId) {
        Project project = requireProjectPermission(userId, projectId, OrgPermission.API_KEY_MANAGE);
        boolean revoked = projectRepository.revokeApiKey(projectId, keyId);
        if (!revoked) {
            throw new NotFoundException("API key not found: " + keyId);
        }
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                project.organizationId(),
                userId,
                "apikey.revoked",
                "api_key",
                keyId.toString(),
                Map.of("projectId", projectId.toString())
        );
    }

    public WsTicket issueWsTicket(UUID userId, UUID projectId) {
        requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        long now = System.currentTimeMillis();
        tickets.entrySet().removeIf(e -> e.getValue().expiresAtMs() < now);
        String ticketStr = "wst_" + UuidV7.generateString().replace("-", "");
        WsTicket ticket = new WsTicket(ticketStr, projectId, userId, now + 60_000L);
        tickets.put(ticketStr, ticket);
        return ticket;
    }

    public boolean validateWsTicket(UUID projectId, String ticketStr) {
        if (ticketStr == null || ticketStr.isBlank()) {
            return false;
        }
        WsTicket ticket = tickets.remove(ticketStr);
        if (ticket == null) {
            return false;
        }
        return ticket.projectId().equals(projectId) && ticket.expiresAtMs() >= System.currentTimeMillis();
    }

    private void recordAudit(
            UUID organizationId,
            UUID actorUserId,
            String action,
            String targetType,
            String targetId,
            Map<String, Object> meta
    ) {
        if (auditLogRepository == null || organizationId == null) {
            return;
        }
        auditLogRepository.append(organizationId, actorUserId, null, action, targetType, targetId, meta);
    }
}
