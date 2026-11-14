package dev.flowtrace.adapter.in.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.DemoSimulator;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.application.port.out.TraceRepository;
import dev.flowtrace.domain.ApiKey;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.DiagramVersion;
import dev.flowtrace.domain.OrgPermission;
import dev.flowtrace.domain.Project;
import dev.flowtrace.domain.TraceSummary;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * UI & Management REST API under `/api/v1/projects` (spec section 9 + Epic 1 RBAC).
 */
@Path("/api/v1/projects")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ProjectManagementResource {

    private final ProjectService projectService;
    private final TraceRepository traceRepository;
    private final DemoSimulator demoSimulator;
    private final ObjectMapper objectMapper;
    private final boolean mockAuthEnabled;

    @Inject
    public ProjectManagementResource(
            ProjectService projectService,
            TraceRepository traceRepository,
            DemoSimulator demoSimulator,
            ObjectMapper objectMapper,
            @ConfigProperty(name = "flowtrace.auth.mock-enabled", defaultValue = "true") boolean mockAuthEnabled
    ) {
        this.projectService = projectService;
        this.traceRepository = traceRepository;
        this.demoSimulator = demoSimulator;
        this.objectMapper = objectMapper;
        this.mockAuthEnabled = mockAuthEnabled;
    }

    public record CreateProjectRequest(
            String name,
            UUID organizationId,
            UUID workspaceId,
            Boolean autoDiscover,
            Integer retentionDays
    ) {
    }

    public record UpdateProjectRequest(String name, Boolean autoDiscover, Integer retentionDays) {
    }

    public record CreateKeyRequest(String name, Integer rateLimitPerS, String scopes) {
        public CreateKeyRequest(String name, Integer rateLimitPerS) {
            this(name, rateLimitPerS, "ingest");
        }
    }

    public record RotateKeyRequest(Integer gracePeriodHours) {
    }

    public record DemoRequest(Double rate, Double errorRate) {
    }

    @GET
    public List<Project> listProjects(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @QueryParam("organizationId") UUID organizationId,
            @QueryParam("workspaceId") UUID workspaceId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.listProjectsForUser(userId, organizationId, workspaceId);
    }

    @POST
    public Response createProject(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            CreateProjectRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        Project created = projectService.createProject(
                userId,
                req != null ? req.organizationId() : null,
                req != null ? req.workspaceId() : null,
                req != null ? req.name() : null,
                req != null ? req.autoDiscover() : null,
                req != null ? req.retentionDays() : null
        );
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @GET
    @Path("/{id}")
    public Project getProject(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.getOwnedProject(userId, projectId);
    }

    @PATCH
    @Path("/{id}")
    public Project updateProject(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            UpdateProjectRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.updateProject(
                userId,
                projectId,
                req != null ? req.name() : null,
                req != null ? req.autoDiscover() : null,
                req != null ? req.retentionDays() : null
        );
    }

    @DELETE
    @Path("/{id}")
    public Response deleteProject(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        demoSimulator.stopDemo(projectId);
        projectService.deleteProject(userId, projectId);
        return Response.noContent().build();
    }

    public record SaveDraftRequest(
            DiagramGraph graph,
            DiagramGraph diagram,
            Integer expectedDraftVersion,
            Boolean forceOverwrite
    ) {
        public DiagramGraph resolvedGraph() {
            return graph != null ? graph : diagram;
        }
    }

    public record PublishDiagramRequest(
            DiagramGraph graph,
            DiagramGraph diagram,
            String changeSummary
    ) {
        public DiagramGraph resolvedGraph() {
            return graph != null ? graph : diagram;
        }
    }

    public record CreateCustomBlockRequest(
            String name,
            String category,
            dev.flowtrace.domain.NodeType nodeType,
            String role,
            String icon,
            String tint,
            String keyPattern,
            Map<String, Object> defaultProps
    ) {
    }

    @GET
    @Path("/{id}/diagram")
    public DiagramVersion getDiagram(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.getLatestDiagram(userId, projectId);
    }

    @PUT
    @Path("/{id}/diagram")
    public DiagramVersion saveDiagram(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            DiagramGraph graph
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.saveDiagram(userId, projectId, graph);
    }

    @GET
    @Path("/{id}/diagram/draft")
    public Response getDiagramDraft(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        dev.flowtrace.domain.DiagramDraft draft = projectService.getOrInitDiagramDraft(userId, projectId);
        ProjectService.EditorEntitlementsView entitlements = projectService.getEditorEntitlements(userId, projectId);
        return Response.ok(Map.of(
                "draft", draft,
                "entitlements", entitlements
        )).build();
    }

    @PUT
    @Path("/{id}/diagram/draft")
    public Response saveDiagramDraft(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            SaveDraftRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        String email = resolveAuthenticatedEmail(authHeader, debugUserId);
        if (req == null || req.resolvedGraph() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "graph is required")).build();
        }
        ProjectService.DraftSaveOutcome outcome = projectService.saveDiagramDraft(
                userId,
                email,
                projectId,
                req.resolvedGraph(),
                req.expectedDraftVersion(),
                req.forceOverwrite()
        );
        if (outcome.conflict()) {
            return Response.status(Response.Status.CONFLICT).entity(Map.of(
                    "conflict", true,
                    "serverDraft", outcome.serverDraft()
            )).build();
        }
        return Response.ok(Map.of(
                "conflict", false,
                "draft", outcome.draft()
        )).build();
    }

    @POST
    @Path("/{id}/diagram/publish")
    public Response publishDiagram(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            PublishDiagramRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        String email = resolveAuthenticatedEmail(authHeader, debugUserId);
        try {
            ProjectService.PublishDiagramResult result = projectService.publishDiagram(
                    userId,
                    email,
                    projectId,
                    req != null ? req.resolvedGraph() : null,
                    req != null ? req.changeSummary() : null,
                    traceRepository
            );
            return Response.ok(result).build();
        } catch (dev.flowtrace.domain.ValidationException ve) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", ve.getMessage())).build();
        }
    }

    @POST
    @Path("/{id}/diagram/versions/{version}/restore")
    public DiagramVersion restoreDiagramVersion(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @PathParam("version") int version
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        String email = resolveAuthenticatedEmail(authHeader, debugUserId);
        return projectService.restoreDiagramVersion(userId, email, projectId, version);
    }

    @GET
    @Path("/{id}/diagram/key-usage")
    public Response getKeyUsage(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @QueryParam("key") String nodeKey
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        Instant since24h = Instant.now().minus(java.time.Duration.ofHours(24));
        long count24h = traceRepository.countNodeEventsSince(projectId, nodeKey, since24h);
        List<TraceSummary.TraceEventRecord> recentEvents = traceRepository.findRecentNodeEvents(projectId, nodeKey, 5);
        return Response.ok(Map.of(
                "key", nodeKey != null ? nodeKey : "",
                "eventsLast24h", count24h,
                "recentEvents", recentEvents
        )).build();
    }

    @GET
    @Path("/{id}/custom-blocks")
    public List<dev.flowtrace.domain.CustomBlockDefinition> listProjectCustomBlocks(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        Project project = projectService.requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        if (project.organizationId() == null) {
            return List.of();
        }
        return projectService.listCustomBlocks(userId, project.organizationId());
    }

    @POST
    @Path("/{id}/custom-blocks")
    public Response createProjectCustomBlock(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            CreateCustomBlockRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        Project project = projectService.requireProjectPermission(userId, projectId, OrgPermission.DIAGRAM_EDIT);
        if (project.organizationId() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "Project has no organization")).build();
        }
        dev.flowtrace.domain.CustomBlockDefinition created = projectService.createCustomBlock(
                userId,
                project.organizationId(),
                req != null ? req.name() : null,
                req != null ? req.category() : null,
                req != null ? req.nodeType() : null,
                req != null ? req.role() : null,
                req != null ? req.icon() : null,
                req != null ? req.tint() : null,
                req != null ? req.keyPattern() : null,
                req != null ? req.defaultProps() : null
        );
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @DELETE
    @Path("/{id}/custom-blocks/{blockId}")
    public Response deleteProjectCustomBlock(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @PathParam("blockId") UUID blockId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        Project project = projectService.requireProjectPermission(userId, projectId, OrgPermission.DIAGRAM_EDIT);
        if (project.organizationId() != null) {
            projectService.deleteCustomBlock(userId, project.organizationId(), blockId);
        }
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/diagram/versions")
    public List<DiagramVersion> listDiagramVersions(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.listDiagramVersions(userId, projectId);
    }

    @GET
    @Path("/{id}/keys")
    public List<ApiKey> listKeys(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.listApiKeys(userId, projectId);
    }

    @POST
    @Path("/{id}/keys")
    public Response createKey(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            CreateKeyRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        ProjectService.CreatedApiKeyResult result = projectService.createApiKey(
                userId,
                projectId,
                req != null ? req.name() : null,
                req != null ? req.rateLimitPerS() : null,
                req != null ? req.scopes() : "ingest"
        );
        return Response.status(Response.Status.CREATED).entity(result).build();
    }

    @POST
    @Path("/{id}/keys/{keyId}/rotate")
    public Response rotateKey(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @PathParam("keyId") UUID keyId,
            RotateKeyRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        ProjectService.RotatedApiKeyResult result = projectService.rotateApiKey(
                userId,
                projectId,
                keyId,
                req != null ? req.gracePeriodHours() : 24
        );
        return Response.ok(result).build();
    }

    @DELETE
    @Path("/{id}/keys/{keyId}")
    public Response revokeKey(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @PathParam("keyId") UUID keyId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.revokeApiKey(userId, projectId, keyId);
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/traces")
    public List<TraceSummary> searchTraces(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @QueryParam("from") Long fromMs,
            @QueryParam("to") Long toMs,
            @QueryParam("status") String status,
            @QueryParam("node") String node,
            @QueryParam("limit") Integer limit,
            @QueryParam("cursor") String cursor
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.TRACE_VIEW);
        Instant from = fromMs != null ? Instant.ofEpochMilli(fromMs) : null;
        Instant to = toMs != null ? Instant.ofEpochMilli(toMs) : null;
        return traceRepository.searchTraces(projectId, from, to, status, node, limit != null ? limit : 50, cursor);
    }

    @GET
    @Path("/{id}/traces/{traceId}")
    public TraceSummary.TraceDetail getTraceDetail(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            @PathParam("traceId") String traceId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.TRACE_VIEW);
        return traceRepository.findTraceDetail(projectId, traceId)
                .orElseThrow(() -> new NotFoundException("Trace not found: " + traceId));
    }

    @POST
    @Path("/{id}/ws-ticket")
    public ProjectService.WsTicket createWsTicket(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        return projectService.issueWsTicket(userId, projectId);
    }

    @GET
    @Path("/{id}/demo")
    public Response getDemoStatus(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.PROJECT_VIEW);
        DemoSimulator.DemoConfig cfg = demoSimulator.getStatus(projectId);
        if (cfg == null) {
            return Response.ok(Map.of("running", false)).build();
        }
        return Response.ok(Map.of(
                "running", true,
                "rate", cfg.ratePerSecond(),
                "errorRate", cfg.errorRate(),
                "startedAtMs", cfg.startedAtMs(),
                "expiresAtMs", cfg.expiresAtMs()
        )).build();
    }

    @POST
    @Path("/{id}/demo")
    public Response startDemo(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId,
            DemoRequest req
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.DIAGRAM_EDIT);
        DemoSimulator.DemoConfig cfg = demoSimulator.startDemo(
                projectId,
                req != null ? req.rate() : null,
                req != null ? req.errorRate() : null
        );
        return Response.ok(Map.of(
                "running", true,
                "rate", cfg.ratePerSecond(),
                "errorRate", cfg.errorRate(),
                "startedAtMs", cfg.startedAtMs(),
                "expiresAtMs", cfg.expiresAtMs()
        )).build();
    }

    @DELETE
    @Path("/{id}/demo")
    public Response stopDemo(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("id") UUID projectId
    ) {
        UUID userId = resolveAuthenticatedUser(authHeader, debugUserId);
        projectService.requireProjectPermission(userId, projectId, OrgPermission.DIAGRAM_EDIT);
        demoSimulator.stopDemo(projectId);
        return Response.ok(Map.of("running", false)).build();
    }

    private UUID resolveAuthenticatedUser(String authHeader, String debugUserId) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            String[] parts = token.split("\\.");
            if (parts.length == 3) {
                try {
                    String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                    JsonNode claims = objectMapper.readTree(payloadJson);
                    String sub = claims.hasNonNull("sub") ? claims.get("sub").asText() : null;
                    String email = claims.hasNonNull("email") ? claims.get("email").asText() : (sub + "@cognito.local");
                    if (sub != null && !sub.isBlank()) {
                        return projectService.ensureUser(sub, email);
                    }
                } catch (Exception ignored) {
                }
            } else if (!token.isBlank()) {
                return projectService.ensureUser(token, token + "@flowtrace.local");
            }
        }

        if (mockAuthEnabled) {
            if (debugUserId != null && !debugUserId.isBlank()) {
                String clean = debugUserId.trim();
                String email = clean.contains("@") ? clean : (clean + "@flowtrace.local");
                return projectService.ensureUser(clean, email);
            }
            return projectService.ensureUser("local-dev-user", "dev@flowtrace.local");
        }

        throw new NotAuthorizedException("Bearer token required");
    }

    private String resolveAuthenticatedEmail(String authHeader, String debugUserId) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7).trim();
            String[] parts = token.split("\\.");
            if (parts.length == 3) {
                try {
                    String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
                    JsonNode claims = objectMapper.readTree(payloadJson);
                    if (claims.hasNonNull("email")) {
                        return claims.get("email").asText();
                    }
                } catch (Exception ignored) {
                }
            } else if (!token.isBlank()) {
                return token.contains("@") ? token : (token + "@flowtrace.local");
            }
        }
        if (debugUserId != null && !debugUserId.isBlank()) {
            String clean = debugUserId.trim();
            return clean.contains("@") ? clean : (clean + "@flowtrace.local");
        }
        return "dev@flowtrace.local";
    }
}
