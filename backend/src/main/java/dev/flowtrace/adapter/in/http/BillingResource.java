package dev.flowtrace.adapter.in.http;

import dev.flowtrace.application.BillingService;
import dev.flowtrace.domain.PlanCatalogEntry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Map;

/**
 * Commercial Billing Catalog (`/api/v1/billing/plans`) and Stripe Webhook Receiver (`/api/v1/webhooks/billing`)
 * implementing Epic E3 / ADR-0011. Organization-scoped billing endpoints live on `OrganizationResource`.
 */
@Path("/api/v1")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class BillingResource {

    public record CreateCheckoutRequest(
            String planTier,
            String billingInterval,
            String promoCode,
            String returnUrl
    ) {
    }

    public record CreatePortalRequest(String returnUrl) {
    }

    public record UpdateBillingProfileRequest(
            String companyName,
            String billingEmail,
            String billingCountry,
            String vatId
    ) {
    }

    public record SimulateWebhookRequest(
            String eventType,
            String planTier,
            String billingInterval
    ) {
    }

    private final BillingService billingService;

    @Inject
    public BillingResource(BillingService billingService) {
        this.billingService = billingService;
    }

    @GET
    @Path("/billing/plans")
    public List<PlanCatalogEntry> listPlans() {
        return billingService.listPlans();
    }

    @POST
    @Path("/webhooks/billing")
    @Consumes(MediaType.WILDCARD)
    public Response handleBillingWebhook(
            @HeaderParam("Stripe-Signature") String stripeSignature,
            String rawPayload
    ) {
        try {
            BillingService.WebhookProcessOutcome outcome = billingService.handleWebhook(rawPayload, stripeSignature);
            return Response.ok(Map.of(
                    "processed", outcome.processed(),
                    "duplicate", outcome.duplicate(),
                    "eventId", outcome.eventId(),
                    "eventType", outcome.eventType(),
                    "status", outcome.subscription().status().name(),
                    "planTier", outcome.subscription().planTier().name()
            )).build();
        } catch (NotAuthorizedException e) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "invalid_signature", "message", e.getMessage()))
                    .build();
        }
    }
}
