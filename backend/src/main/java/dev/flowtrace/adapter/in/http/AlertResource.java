package dev.flowtrace.adapter.in.http;

import dev.flowtrace.application.port.out.AlertRuleRepository;
import dev.flowtrace.domain.AlertRule;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Path("/api/v1/projects/{projectId}/alerts")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AlertResource {

    private final AlertRuleRepository alertRuleRepository;

    @Inject
    public AlertResource(AlertRuleRepository alertRuleRepository) {
        this.alertRuleRepository = alertRuleRepository;
    }

    public record CreateAlertRequest(
            String name,
            String severity,
            String metric,
            Double threshold,
            Integer windowSeconds,
            String targetNode,
            String channelType,
            String channelTarget
    ) {}

    public record UpdateAlertRequest(
            Boolean enabled,
            Integer muteMinutes
    ) {}

    @GET
    public List<AlertRule> listAlerts(@PathParam("projectId") UUID projectId) {
        return alertRuleRepository.findByProjectId(projectId);
    }

    @POST
    public Response createAlert(
            @PathParam("projectId") UUID projectId,
            CreateAlertRequest req
    ) {
        if (req == null || req.name() == null || req.name().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "name is required"))
                    .build();
        }
        AlertRule rule = AlertRule.create(
                projectId,
                req.name().trim(),
                req.severity(),
                req.metric(),
                req.threshold() != null ? req.threshold() : 5.0,
                req.windowSeconds() != null ? req.windowSeconds() : 300,
                req.targetNode(),
                req.channelType(),
                req.channelTarget()
        );
        alertRuleRepository.save(rule);
        return Response.status(Response.Status.CREATED).entity(rule).build();
    }

    @PATCH
    @Path("/{alertId}")
    public AlertRule updateAlert(
            @PathParam("projectId") UUID projectId,
            @PathParam("alertId") UUID alertId,
            UpdateAlertRequest req
    ) {
        AlertRule current = alertRuleRepository.findById(projectId, alertId)
                .orElseThrow(() -> new NotFoundException("Alert rule not found"));
        AlertRule updated = current;
        if (req != null && req.enabled() != null) {
            updated = updated.withEnabled(req.enabled());
        }
        if (req != null && req.muteMinutes() != null) {
            Instant until = req.muteMinutes() > 0
                    ? Instant.now().plus(req.muteMinutes(), ChronoUnit.MINUTES)
                    : null;
            updated = updated.withMutedUntil(until);
        }
        return alertRuleRepository.save(updated);
    }

    @POST
    @Path("/{alertId}/test")
    public Response testAlert(
            @PathParam("projectId") UUID projectId,
            @PathParam("alertId") UUID alertId
    ) {
        AlertRule current = alertRuleRepository.findById(projectId, alertId)
                .orElseThrow(() -> new NotFoundException("Alert rule not found"));
        AlertRule fired = alertRuleRepository.save(current.withFired(Instant.now()));
        return Response.ok(Map.of(
                "status", "dispatched",
                "rule", fired,
                "channelType", fired.channelType(),
                "channelTarget", fired.channelTarget()
        )).build();
    }

    @DELETE
    @Path("/{alertId}")
    public Response deleteAlert(
            @PathParam("projectId") UUID projectId,
            @PathParam("alertId") UUID alertId
    ) {
        alertRuleRepository.delete(projectId, alertId);
        return Response.noContent().build();
    }
}
