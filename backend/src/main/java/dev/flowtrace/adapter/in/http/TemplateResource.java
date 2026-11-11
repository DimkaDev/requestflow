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

    @GET
    @Path("/templates")
    public List<TemplateDefinition> listTemplates() {
        return TemplateDefinition.builtInTemplates();
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

        TemplateDefinition template = TemplateDefinition.builtInTemplates().stream()
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
