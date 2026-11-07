package dev.flowtrace.application;

import dev.flowtrace.application.port.out.ProjectRepository;
import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.UuidV7;
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

    public record WsTicket(String ticket, UUID projectId, UUID userId, long expiresAtMs) {
    }

    private final ProjectRepository projectRepository;
    private final IngestEventUseCase ingestEventUseCase;
    private final Map<String, WsTicket> tickets = new ConcurrentHashMap<>();

    @Inject
    public ProjectService(ProjectRepository projectRepository, IngestEventUseCase ingestEventUseCase) {
        this.projectRepository = projectRepository;
        this.ingestEventUseCase = ingestEventUseCase;
    }

    public UUID ensureUser(String externalId, String email) {
        return projectRepository.ensureUser(externalId, email);
    }

    public List<Project> listProjectsForUser(UUID userId) {
        return projectRepository.findByOwner(userId);
    }

    public Project getOwnedProject(UUID userId, UUID projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new NotFoundException("Project not found: " + projectId));
        if (!project.ownerId().equals(userId)) {
            throw new ForbiddenException("Access denied to project " + projectId);
        }
        return project;
    }

    public Project createProject(UUID userId, String name, Boolean autoDiscover, Integer retentionDays) {
        String cleanName = (name == null || name.isBlank()) ? "New Service Flow" : name.trim();
        boolean discover = autoDiscover == null || autoDiscover;
        int retention = (retentionDays == null || retentionDays < 1) ? 7 : Math.min(retentionDays, 90);
        Project created = projectRepository.createProject(
                userId,
                cleanName,
                discover,
                retention,
                DiagramGraph.defaultSampleDiagram()
        );
        // Create a default API key for convenience
        createApiKey(userId, created.id(), "Default Ingest Key", 1000);
        return created;
    }

    public Project updateProject(UUID userId, UUID projectId, String name, Boolean autoDiscover, Integer retentionDays) {
        getOwnedProject(userId, projectId);
        Project updated = projectRepository.updateProject(projectId, name, autoDiscover, retentionDays);
        ingestEventUseCase.invalidateDiagramCache(projectId, null);
        return updated;
    }

    public void deleteProject(UUID userId, UUID projectId) {
        getOwnedProject(userId, projectId);
        projectRepository.deleteProject(projectId);
        ingestEventUseCase.invalidateDiagramCache(projectId, null);
        ingestEventUseCase.evictKeyCache();
    }

    public DiagramVersion getLatestDiagram(UUID userId, UUID projectId) {
        getOwnedProject(userId, projectId);
        return projectRepository.getLatestDiagram(projectId)
                .orElseThrow(() -> new NotFoundException("Diagram not found for project " + projectId));
    }

    public DiagramVersion saveDiagram(UUID userId, UUID projectId, DiagramGraph graph) {
        getOwnedProject(userId, projectId);
        DiagramVersion saved = projectRepository.saveDiagramVersion(projectId, graph);
        ingestEventUseCase.invalidateDiagramCache(projectId, graph);
        return saved;
    }

    public List<DiagramVersion> listDiagramVersions(UUID userId, UUID projectId) {
        getOwnedProject(userId, projectId);
        return projectRepository.listDiagramVersions(projectId);
    }

    public List<ApiKey> listApiKeys(UUID userId, UUID projectId) {
        getOwnedProject(userId, projectId);
        return projectRepository.listApiKeys(projectId);
    }

    public CreatedApiKeyResult createApiKey(UUID userId, UUID projectId, String name, Integer rateLimitPerS) {
        getOwnedProject(userId, projectId);
        String keyName = (name == null || name.isBlank()) ? "Ingest Key" : name.trim();
        int limit = (rateLimitPerS == null || rateLimitPerS < 1) ? 1000 : rateLimitPerS;
        ApiKeyCrypto.GeneratedKey gen = ApiKeyCrypto.generateNewKey();
        ApiKey saved = projectRepository.createApiKey(projectId, keyName, gen.keyPrefix(), gen.keyHash(), limit);
        return new CreatedApiKeyResult(saved, gen.fullKey());
    }

    public void revokeApiKey(UUID userId, UUID projectId, UUID keyId) {
        getOwnedProject(userId, projectId);
        boolean revoked = projectRepository.revokeApiKey(projectId, keyId);
        if (!revoked) {
            throw new NotFoundException("API key not found: " + keyId);
        }
        ingestEventUseCase.evictKeyCache();
    }

    public WsTicket issueWsTicket(UUID userId, UUID projectId) {
        getOwnedProject(userId, projectId);
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
}
