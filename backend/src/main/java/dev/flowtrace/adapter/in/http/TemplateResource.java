package dev.flowtrace.adapter.in.http;

import dev.flowtrace.application.DemoSimulator;
import dev.flowtrace.application.IngestEventUseCase;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.TemplateDefinition;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class TemplateResource {

    private final ProjectService projectService;
    private final DemoSimulator demoSimulator;
    private final IngestEventUseCase ingestEventUseCase;

    @Inject
    public TemplateResource(ProjectService projectService, DemoSimulator demoSimulator, IngestEventUseCase ingestEventUseCase) {
        this.projectService = projectService;
        this.demoSimulator = demoSimulator;
        this.ingestEventUseCase = ingestEventUseCase;
    }

    private final java.util.List<TemplateDefinition> customTemplates = new java.util.concurrent.CopyOnWriteArrayList<>();

    public record SaveCustomTemplateRequest(
            String name,
            String category,
            String description,
            String theme,
            DiagramGraph diagram
    ) {
    }

    @GET
    @Path("/templates")
    public List<TemplateDefinition> listTemplates() {
        java.util.List<TemplateDefinition> all = new java.util.ArrayList<>(TemplateDefinition.builtInTemplates());
        all.addAll(customTemplates);
        return all;
    }

    @POST
    @Path("/templates")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response saveCustomTemplate(SaveCustomTemplateRequest req) {
        if (req == null || req.diagram() == null) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "diagram is required")).build();
        }
        String cleanName = (req.name() == null || req.name().isBlank()) ? "Custom Architecture Template" : req.name().trim();
        String slug = "custom-" + cleanName.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "") + "-" + (customTemplates.size() + 1);
        TemplateDefinition created = new TemplateDefinition(
                slug,
                cleanName,
                (req.category() == null || req.category().isBlank()) ? "custom" : req.category().trim(),
                (req.description() == null || req.description().isBlank()) ? "Custom diagram saved from Advanced Editor." : req.description().trim(),
                (req.theme() == null || req.theme().isBlank()) ? "dark-neon" : req.theme().trim(),
                req.diagram(),
                List.of("default"),
                List.of()
        );
        customTemplates.add(created);
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @POST
    @Path("/projects/{projectId}/template/{templateId}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response applyTemplate(
            @PathParam("projectId") String projectIdStr,
            @PathParam("templateId") String templateId,
            @HeaderParam("X-User-Id") String userIdHeader,
            @HeaderParam("X-User-Email") String userEmailHeader
    ) {
        UUID projectId;
        try {
            projectId = UUID.fromString(projectIdStr);
        } catch (IllegalArgumentException e) {
            return Response.status(Response.Status.BAD_REQUEST).entity(Map.of("error", "Invalid project UUID")).build();
        }

        if ("blank".equalsIgnoreCase(templateId) || "blank-canvas".equalsIgnoreCase(templateId)) {
            DiagramGraph blankGraph = DiagramGraph.blankDiagram();
            projectService.saveDiagramVersion(projectId, blankGraph, userIdHeader, userEmailHeader);
            demoSimulator.stopDemo(projectId);
            ingestEventUseCase.invalidateDiagramCache(projectId, blankGraph);
            return Response.ok(Map.of(
                    "projectId", projectId.toString(),
                    "appliedTemplate", "blank",
                    "diagram", blankGraph
            )).build();
        }

        TemplateDefinition template = listTemplates().stream()
                .filter(t -> t.id().equalsIgnoreCase(templateId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Template not found: " + templateId));

        DiagramGraph newGraph = template.diagram();
        projectService.saveDiagramVersion(projectId, newGraph, userIdHeader, userEmailHeader);
        ingestEventUseCase.invalidateDiagramCache(projectId, newGraph);

        // If demo simulator was running, kick it to pick up new graph immediately
        DemoSimulator.DemoConfig currentConfig = demoSimulator.getStatus(projectId);
        if (currentConfig != null) {
            demoSimulator.startDemo(projectId, currentConfig.ratePerSecond(), currentConfig.errorRate());
        }

        return Response.ok(Map.of(
                "projectId", projectId.toString(),
                "appliedTemplate", template.id(),
                "diagram", newGraph
        )).build();
    }
}
