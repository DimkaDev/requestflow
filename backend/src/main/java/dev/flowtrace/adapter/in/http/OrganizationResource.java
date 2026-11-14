package dev.flowtrace.adapter.in.http;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.OrganizationService;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.application.UsageMeterService;
import dev.flowtrace.domain.AuditLogEntry;
import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.OrganizationMember;
import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.Workspace;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Multi-Tenant Organization, Workspace, RBAC & Invitation REST API (`/api/v1/organizations`)
 * implementing Epic 1 (TASK-1.1, TASK-1.2, TASK-1.3).
 */
@Path("/api/v1/organizations")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class OrganizationResource {

    private final OrganizationService organizationService;
    private final ProjectService projectService;
    private final UsageMeterService usageMeterService;
    private final dev.flowtrace.application.BillingService billingService;
    private final ObjectMapper objectMapper;
    private final boolean mockAuthEnabled;

    @Inject
    public OrganizationResource(
            OrganizationService organizationService,
            ProjectService projectService,
            UsageMeterService usageMeterService,
            dev.flowtrace.application.BillingService billingService,
            ObjectMapper objectMapper,
            @ConfigProperty(name = "flowtrace.auth.mock-enabled", defaultValue = "true") boolean mockAuthEnabled
    ) {
        this.organizationService = organizationService;
        this.projectService = projectService;
        this.usageMeterService = usageMeterService;
        this.billingService = billingService;
        this.objectMapper = objectMapper;
        this.mockAuthEnabled = mockAuthEnabled;
    }

    public record CreateOrganizationRequest(String name, String slug, String billingEmail) {
    }

    public record UpdateOrganizationRequest(String name, String slug, String billingEmail, String planTier) {
    }

    public record TransferOwnershipRequest(UUID newOwnerUserId) {
    }

    public record CreateWorkspaceRequest(String name, String slug) {
    }

    public record UpdateWorkspaceRequest(String name, String slug) {
    }

    public record UpdateMemberRoleRequest(String role) {
    }

    public record CreateInvitationRequest(String email, String role, String baseAppUrl) {
    }

    public record ResendInvitationRequest(String baseAppUrl) {
    }

    public record AcceptInvitationRequest(String token) {
    }

    @GET
    public List<OrganizationService.OrganizationView> listOrganizations(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.listOrganizationsForUser(user.userId(), user.email());
    }

    @POST
    public Response createOrganization(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            CreateOrganizationRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        OrganizationService.OrganizationView created = organizationService.createOrganization(
                user.userId(),
                req != null ? req.name() : null,
                req != null ? req.slug() : null,
                req != null && req.billingEmail() != null ? req.billingEmail() : user.email()
        );
        return Response.status(Response.Status.CREATED).entity(created).build();
    }

    @GET
    @Path("/{orgId}")
    public OrganizationService.OrganizationView getOrganization(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.getOrganizationView(user.userId(), orgId);
    }

    @PATCH
    @Path("/{orgId}")
    public OrganizationService.OrganizationView updateOrganization(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            UpdateOrganizationRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.updateOrganization(
                user.userId(),
                orgId,
                req != null ? req.name() : null,
                req != null ? req.slug() : null,
                req != null ? req.billingEmail() : null,
                req != null ? req.planTier() : null
        );
    }

    @DELETE
    @Path("/{orgId}")
    public Response deleteOrganization(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        organizationService.deleteOrganization(user.userId(), orgId);
        return Response.noContent().build();
    }

    @POST
    @Path("/{orgId}/restore")
    public OrganizationService.OrganizationView restoreOrganization(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.restoreOrganization(user.userId(), orgId);
    }

    @POST
    @Path("/{orgId}/transfer-ownership")
    public OrganizationService.OrganizationView transferOwnership(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            TransferOwnershipRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        organizationService.transferOwnership(user.userId(), orgId, req != null ? req.newOwnerUserId() : null);
        return organizationService.getOrganizationView(user.userId(), orgId);
    }

    @GET
    @Path("/{orgId}/workspaces")
    public List<Workspace> listWorkspaces(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.listWorkspaces(user.userId(), orgId);
    }

    @POST
    @Path("/{orgId}/workspaces")
    public Response createWorkspace(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            CreateWorkspaceRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        Workspace ws = organizationService.createWorkspace(
                user.userId(),
                orgId,
                req != null ? req.name() : null,
                req != null ? req.slug() : null
        );
        return Response.status(Response.Status.CREATED).entity(ws).build();
    }

    @PATCH
    @Path("/{orgId}/workspaces/{wsId}")
    public Workspace updateWorkspace(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("wsId") UUID wsId,
            UpdateWorkspaceRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.updateWorkspace(
                user.userId(),
                orgId,
                wsId,
                req != null ? req.name() : null,
                req != null ? req.slug() : null
        );
    }

    @DELETE
    @Path("/{orgId}/workspaces/{wsId}")
    public Response deleteWorkspace(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("wsId") UUID wsId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        organizationService.deleteWorkspace(user.userId(), orgId, wsId);
        return Response.noContent().build();
    }

    @GET
    @Path("/{orgId}/members")
    public List<OrganizationMember> listMembers(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.listMembers(user.userId(), orgId);
    }

    @PATCH
    @Path("/{orgId}/members/{memberUserId}")
    public List<OrganizationMember> updateMemberRole(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("memberUserId") UUID memberUserId,
            UpdateMemberRoleRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.updateMemberRole(
                user.userId(),
                orgId,
                memberUserId,
                req != null ? req.role() : null
        );
    }

    @DELETE
    @Path("/{orgId}/members/{memberUserId}")
    public Response removeMember(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("memberUserId") UUID memberUserId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        organizationService.removeMember(user.userId(), orgId, memberUserId);
        return Response.noContent().build();
    }

    @GET
    @Path("/{orgId}/invitations")
    public List<Invitation> listInvitations(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.listInvitations(user.userId(), orgId);
    }

    @POST
    @Path("/{orgId}/invitations")
    public Response createInvitation(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            CreateInvitationRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        Invitation invitation = organizationService.createInvitation(
                user.userId(),
                orgId,
                req != null ? req.email() : null,
                req != null ? req.role() : null,
                req != null ? req.baseAppUrl() : null
        );
        return Response.status(Response.Status.CREATED).entity(invitation).build();
    }

    @POST
    @Path("/{orgId}/invitations/{invitationId}/resend")
    public Invitation resendInvitation(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("invitationId") UUID invitationId,
            ResendInvitationRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.resendInvitation(
                user.userId(),
                orgId,
                invitationId,
                req != null ? req.baseAppUrl() : null
        );
    }

    @DELETE
    @Path("/{orgId}/invitations/{invitationId}")
    public Response revokeInvitation(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @PathParam("invitationId") UUID invitationId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        organizationService.revokeInvitation(user.userId(), orgId, invitationId);
        return Response.noContent().build();
    }

    @POST
    @Path("/invitations/accept")
    public OrganizationService.OrganizationView acceptInvitation(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            AcceptInvitationRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.acceptInvitation(user.userId(), req != null ? req.token() : null);
    }

    @GET
    @Path("/{orgId}/audit-logs")
    public List<AuditLogEntry> listAuditLogs(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @QueryParam("action") String action,
            @QueryParam("limit") Integer limit
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return organizationService.listAuditLogs(user.userId(), orgId, action, limit);
    }

    @GET
    @Path("/{orgId}/usage")
    public OrganizationUsage getUsage(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            @QueryParam("month") String monthStr
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        var orgView = organizationService.getOrganizationView(user.userId(), orgId);
        YearMonth month = YearMonth.now();
        if (monthStr != null && !monthStr.isBlank()) {
            try {
                month = YearMonth.parse(monthStr.trim());
            } catch (Exception ignored) {
            }
        }
        return usageMeterService.getOrganizationUsage(orgId, month, orgView.organization().planTier());
    }

    @GET
    @Path("/{orgId}/billing")
    public dev.flowtrace.application.BillingService.OrganizationBillingOverview getBillingOverview(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.getBillingOverview(user.userId(), orgId);
    }

    @POST
    @Path("/{orgId}/billing/checkout")
    public dev.flowtrace.application.BillingService.CheckoutOutcome createCheckoutSession(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            BillingResource.CreateCheckoutRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.createCheckoutSession(
                user.userId(),
                orgId,
                req != null ? req.planTier() : null,
                req != null ? req.billingInterval() : null,
                req != null ? req.promoCode() : null,
                req != null ? req.returnUrl() : null
        );
    }

    @POST
    @Path("/{orgId}/billing/portal")
    public dev.flowtrace.application.port.out.BillingProviderPort.PortalSessionResult createCustomerPortalSession(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            BillingResource.CreatePortalRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.createCustomerPortalSession(
                user.userId(),
                orgId,
                req != null ? req.returnUrl() : null
        );
    }

    @jakarta.ws.rs.PUT
    @Path("/{orgId}/billing/profile")
    public dev.flowtrace.application.BillingService.OrganizationBillingOverview updateBillingProfile(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            BillingResource.UpdateBillingProfileRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.updateBillingProfile(
                user.userId(),
                orgId,
                req != null ? req.companyName() : null,
                req != null ? req.billingEmail() : null,
                req != null ? req.billingCountry() : null,
                req != null ? req.vatId() : null
        );
    }

    @POST
    @Path("/{orgId}/billing/resync")
    public dev.flowtrace.application.BillingService.OrganizationBillingOverview resyncSubscription(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.resyncSubscription(user.userId(), orgId);
    }

    @POST
    @Path("/{orgId}/billing/sandbox-webhook")
    public dev.flowtrace.application.BillingService.OrganizationBillingOverview simulateSandboxWebhook(
            @HeaderParam("Authorization") String authHeader,
            @HeaderParam("X-Debug-User-Id") String debugUserId,
            @PathParam("orgId") UUID orgId,
            BillingResource.SimulateWebhookRequest req
    ) {
        AuthenticatedUser user = resolveUser(authHeader, debugUserId);
        return billingService.simulateSandboxWebhook(
                user.userId(),
                orgId,
                req != null ? req.eventType() : null,
                req != null ? req.planTier() : null,
                req != null ? req.billingInterval() : null
        );
    }

    private record AuthenticatedUser(UUID userId, String email) {
    }

    private AuthenticatedUser resolveUser(String authHeader, String debugUserId) {
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
                        return new AuthenticatedUser(projectService.ensureUser(sub, email), email);
                    }
                } catch (Exception ignored) {
                }
            } else if (!token.isBlank()) {
                String email = token + "@flowtrace.local";
                return new AuthenticatedUser(projectService.ensureUser(token, email), email);
            }
        }

        if (mockAuthEnabled) {
            if (debugUserId != null && !debugUserId.isBlank()) {
                String clean = debugUserId.trim();
                String email = clean.contains("@") ? clean : (clean + "@flowtrace.local");
                return new AuthenticatedUser(projectService.ensureUser(clean, email), email);
            }
            String email = "dev@flowtrace.local";
            return new AuthenticatedUser(projectService.ensureUser("local-dev-user", email), email);
        }

        throw new NotAuthorizedException("Bearer token required");
    }
}
