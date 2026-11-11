package dev.flowtrace.application;

import dev.flowtrace.application.port.out.AuditLogRepository;
import dev.flowtrace.application.port.out.InvitationNotifier;
import dev.flowtrace.application.port.out.OrganizationRepository;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.AuditLogEntry;
import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.OrgPermission;
import dev.flowtrace.domain.OrgRole;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.OrganizationMember;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.ValidationException;
import dev.flowtrace.domain.Workspace;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class OrganizationService {

    public record OrganizationView(
            Organization organization,
            OrgRole myRole,
            Set<OrgPermission> permissions,
            List<Workspace> workspaces
    ) {
    }

    private final OrganizationRepository organizationRepository;
    private final InvitationNotifier invitationNotifier;
    private final AuditLogRepository auditLogRepository;
    private final IngestEventUseCase ingestEventUseCase;

    @Inject
    public OrganizationService(
            OrganizationRepository organizationRepository,
            InvitationNotifier invitationNotifier,
            AuditLogRepository auditLogRepository,
            IngestEventUseCase ingestEventUseCase
    ) {
        this.organizationRepository = organizationRepository;
        this.invitationNotifier = invitationNotifier;
        this.auditLogRepository = auditLogRepository;
        this.ingestEventUseCase = ingestEventUseCase;
    }

    public Organization ensurePersonalOrganization(UUID userId, String email) {
        return organizationRepository.ensurePersonalOrganization(userId, email);
    }

    public List<OrganizationView> listOrganizationsForUser(UUID userId, String fallbackEmail) {
        List<Organization> orgs = organizationRepository.listForUser(userId);
        if (orgs.isEmpty()) {
            organizationRepository.ensurePersonalOrganization(userId, fallbackEmail);
            orgs = organizationRepository.listForUser(userId);
        }
        return orgs.stream()
                .map(org -> {
                    OrgRole role = organizationRepository.findMemberRole(org.id(), userId).orElse(OrgRole.VIEWER);
                    List<Workspace> workspaces = organizationRepository.listWorkspaces(org.id());
                    return new OrganizationView(org, role, role.permissions(), workspaces);
                })
                .toList();
    }

    public OrganizationView getOrganizationView(UUID userId, UUID organizationId) {
        Organization org = requireActiveOrganization(organizationId);
        OrgRole role = requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        List<Workspace> workspaces = organizationRepository.listWorkspaces(organizationId);
        return new OrganizationView(org, role, role.permissions(), workspaces);
    }

    public OrganizationView createOrganization(UUID userId, String name, String slug, String billingEmail) {
        String cleanName = (name == null || name.isBlank()) ? "New Organization" : name.trim();
        String cleanSlug = (slug == null || slug.isBlank()) ? Organization.slugify(cleanName) : Organization.slugify(slug);
        String cleanBilling = (billingEmail == null || billingEmail.isBlank()) ? "billing@flowtrace.local" : billingEmail.trim();
        Organization created = organizationRepository.createOrganization(userId, cleanName, cleanSlug, cleanBilling, PlanTier.FREE);
        recordAudit(
                created.id(),
                userId,
                "org.created",
                "organization",
                created.id().toString(),
                Map.of("name", created.name(), "slug", created.slug(), "planTier", created.planTier().name())
        );
        List<Workspace> workspaces = organizationRepository.listWorkspaces(created.id());
        return new OrganizationView(created, OrgRole.OWNER, OrgRole.OWNER.permissions(), workspaces);
    }

    public OrganizationView updateOrganization(
            UUID userId,
            UUID organizationId,
            String name,
            String slug,
            String billingEmail,
            String planTierStr
    ) {
        Organization existing = requireActiveOrganization(organizationId);
        OrgRole callerRole = organizationRepository.findMemberRole(organizationId, userId)
                .orElseThrow(() -> new ForbiddenException("Not a member of organization " + organizationId));

        boolean changingMetadata = (name != null && !name.isBlank()) || (slug != null && !slug.isBlank());
        boolean changingBilling = (billingEmail != null && !billingEmail.isBlank()) || (planTierStr != null && !planTierStr.isBlank());

        if (changingMetadata && !callerRole.hasPermission(OrgPermission.ORG_MANAGE)) {
            throw new ForbiddenException("Role " + callerRole + " lacks ORG_MANAGE permission");
        }
        if (changingBilling && !callerRole.hasPermission(OrgPermission.BILLING_MANAGE) && !callerRole.hasPermission(OrgPermission.ORG_MANAGE)) {
            throw new ForbiddenException("Role " + callerRole + " lacks BILLING_MANAGE permission");
        }

        PlanTier tier = (planTierStr != null && !planTierStr.isBlank())
                ? PlanTier.fromString(planTierStr)
                : existing.planTier();
        Organization updated = organizationRepository.updateOrganization(organizationId, name, slug, billingEmail, tier);
        recordAudit(
                organizationId,
                userId,
                "org.updated",
                "organization",
                organizationId.toString(),
                Map.of(
                        "name", updated.name(),
                        "billingEmail", updated.billingEmail(),
                        "planTier", updated.planTier().name()
                )
        );
        List<Workspace> workspaces = organizationRepository.listWorkspaces(organizationId);
        return new OrganizationView(updated, callerRole, callerRole.permissions(), workspaces);
    }

    /**
     * Marks an organization as soft-deleted for 30 days (E1-Step-6).
     * Immediately blocks UI access and live ingestion; permanently purged after 30 days.
     */
    public void deleteOrganization(UUID userId, UUID organizationId) {
        Organization org = requireActiveOrganization(organizationId);
        requirePermission(organizationId, userId, OrgPermission.ORG_DELETE);
        Instant deletedAt = Instant.now();
        organizationRepository.softDeleteOrganization(organizationId, deletedAt);
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                organizationId,
                userId,
                "org.soft_deleted",
                "organization",
                organizationId.toString(),
                Map.of(
                        "name", org.name(),
                        "deletedAt", deletedAt.toString(),
                        "retentionDays", Organization.SOFT_DELETE_RETENTION_DAYS
                )
        );
    }

    public OrganizationView restoreOrganization(UUID userId, UUID organizationId) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new NotFoundException("Organization not found: " + organizationId));
        OrgRole role = organizationRepository.findMemberRole(organizationId, userId)
                .orElseThrow(() -> new ForbiddenException("Access denied to organization " + organizationId));
        if (!role.hasPermission(OrgPermission.ORG_DELETE)) {
            throw new ForbiddenException("Role " + role + " does not have required permission ORG_DELETE");
        }
        Organization restored = organizationRepository.restoreOrganization(organizationId);
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                organizationId,
                userId,
                "org.restored",
                "organization",
                organizationId.toString(),
                Map.of("name", org.name())
        );
        List<Workspace> workspaces = organizationRepository.listWorkspaces(organizationId);
        return new OrganizationView(restored, role, role.permissions(), workspaces);
    }

    @Scheduled(every = "12h", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledPurgeSoftDeletedOrganizations() {
        purgeExpiredSoftDeletedOrganizations(Instant.now().minus(Organization.SOFT_DELETE_RETENTION_DAYS, ChronoUnit.DAYS));
    }

    public int purgeExpiredSoftDeletedOrganizations(Instant cutoff) {
        int purged = organizationRepository.purgeOrganizationsDeletedBefore(cutoff);
        if (purged > 0) {
            ingestEventUseCase.evictKeyCache();
        }
        return purged;
    }

    public void transferOwnership(UUID currentOwnerId, UUID organizationId, UUID newOwnerUserId) {
        requirePermission(organizationId, currentOwnerId, OrgPermission.ORG_TRANSFER);
        if (currentOwnerId.equals(newOwnerUserId) || newOwnerUserId == null) {
            return;
        }
        organizationRepository.findMemberRole(organizationId, newOwnerUserId)
                .orElseThrow(() -> new BadRequestException("Target user must already be a member of the organization"));
        organizationRepository.upsertMember(organizationId, newOwnerUserId, OrgRole.OWNER);
        organizationRepository.upsertMember(organizationId, currentOwnerId, OrgRole.ADMIN);
        recordAudit(
                organizationId,
                currentOwnerId,
                "org.ownership_transferred",
                "member",
                newOwnerUserId.toString(),
                Map.of("previousOwnerId", currentOwnerId.toString(), "newOwnerId", newOwnerUserId.toString())
        );
    }

    public List<Workspace> listWorkspaces(UUID userId, UUID organizationId) {
        requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        return organizationRepository.listWorkspaces(organizationId);
    }

    public Workspace createWorkspace(UUID userId, UUID organizationId, String name, String slug) {
        requirePermission(organizationId, userId, OrgPermission.WORKSPACE_MANAGE);
        String cleanName = (name == null || name.isBlank()) ? "New Workspace" : name.trim();
        Workspace created = organizationRepository.createWorkspace(organizationId, cleanName, slug);
        recordAudit(
                organizationId,
                userId,
                "workspace.created",
                "workspace",
                created.id().toString(),
                Map.of("name", created.name(), "slug", created.slug())
        );
        return created;
    }

    public Workspace updateWorkspace(UUID userId, UUID organizationId, UUID workspaceId, String name, String slug) {
        requirePermission(organizationId, userId, OrgPermission.WORKSPACE_MANAGE);
        Workspace ws = organizationRepository.findWorkspaceById(workspaceId)
                .orElseThrow(() -> new NotFoundException("Workspace not found: " + workspaceId));
        if (!ws.organizationId().equals(organizationId)) {
            throw new NotFoundException("Workspace does not belong to organization");
        }
        Workspace updated = organizationRepository.updateWorkspace(workspaceId, name, slug);
        recordAudit(
                organizationId,
                userId,
                "workspace.updated",
                "workspace",
                workspaceId.toString(),
                Map.of("name", updated.name(), "slug", updated.slug())
        );
        return updated;
    }

    public void deleteWorkspace(UUID userId, UUID organizationId, UUID workspaceId) {
        requirePermission(organizationId, userId, OrgPermission.WORKSPACE_MANAGE);
        List<Workspace> all = organizationRepository.listWorkspaces(organizationId);
        if (all.size() <= 1) {
            throw new BadRequestException("Cannot delete the last remaining workspace in an organization");
        }
        Workspace target = all.stream()
                .filter(w -> w.id().equals(workspaceId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Workspace not found: " + workspaceId));
        boolean deleted = organizationRepository.deleteWorkspace(organizationId, workspaceId);
        if (!deleted) {
            throw new NotFoundException("Workspace not found: " + workspaceId);
        }
        recordAudit(
                organizationId,
                userId,
                "workspace.deleted",
                "workspace",
                workspaceId.toString(),
                Map.of("name", target.name(), "slug", target.slug())
        );
    }

    public List<OrganizationMember> listMembers(UUID userId, UUID organizationId) {
        requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        return organizationRepository.listMembers(organizationId);
    }

    public List<OrganizationMember> updateMemberRole(UUID actorUserId, UUID organizationId, UUID targetUserId, String roleStr) {
        OrgRole actorRole = requirePermission(organizationId, actorUserId, OrgPermission.MEMBER_MANAGE);
        OrgRole newRole;
        try {
            newRole = OrgRole.fromString(roleStr);
        } catch (ValidationException e) {
            throw new BadRequestException(e.getMessage());
        }
        OrgRole currentTargetRole = organizationRepository.findMemberRole(organizationId, targetUserId)
                .orElseThrow(() -> new NotFoundException("Member not found in organization"));

        if (!actorRole.canManageRole(currentTargetRole) || !actorRole.canManageRole(newRole)) {
            throw new ForbiddenException("Role " + actorRole + " cannot assign or modify role " + newRole);
        }

        if (currentTargetRole == OrgRole.OWNER && newRole != OrgRole.OWNER) {
            long ownerCount = organizationRepository.listMembers(organizationId).stream()
                    .filter(m -> m.role() == OrgRole.OWNER)
                    .count();
            if (ownerCount <= 1) {
                throw new BadRequestException("Cannot demote the last Owner of the organization");
            }
        }

        organizationRepository.upsertMember(organizationId, targetUserId, newRole);
        recordAudit(
                organizationId,
                actorUserId,
                "member.role_updated",
                "member",
                targetUserId.toString(),
                Map.of("previousRole", currentTargetRole.name(), "newRole", newRole.name())
        );
        return organizationRepository.listMembers(organizationId);
    }

    public void removeMember(UUID actorUserId, UUID organizationId, UUID targetUserId) {
        requireActiveOrganization(organizationId);
        OrgRole targetRole = organizationRepository.findMemberRole(organizationId, targetUserId)
                .orElseThrow(() -> new NotFoundException("Member not found in organization"));

        if (!actorUserId.equals(targetUserId)) {
            OrgRole actorRole = requirePermission(organizationId, actorUserId, OrgPermission.MEMBER_MANAGE);
            if (!actorRole.canManageRole(targetRole)) {
                throw new ForbiddenException("Role " + actorRole + " cannot remove member with role " + targetRole);
            }
        }

        if (targetRole == OrgRole.OWNER) {
            long ownerCount = organizationRepository.listMembers(organizationId).stream()
                    .filter(m -> m.role() == OrgRole.OWNER)
                    .count();
            if (ownerCount <= 1) {
                throw new BadRequestException("Cannot remove the last Owner of the organization");
            }
        }

        organizationRepository.removeMember(organizationId, targetUserId);
        recordAudit(
                organizationId,
                actorUserId,
                "member.removed",
                "member",
                targetUserId.toString(),
                Map.of("removedRole", targetRole.name())
        );
    }

    public List<Invitation> listInvitations(UUID userId, UUID organizationId) {
        requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        return organizationRepository.listInvitations(organizationId);
    }

    public Invitation createInvitation(UUID actorUserId, UUID organizationId, String email, String roleStr, String baseAppUrl) {
        OrgRole actorRole = requirePermission(organizationId, actorUserId, OrgPermission.MEMBER_MANAGE);
        if (email == null || email.isBlank() || !email.contains("@")) {
            throw new BadRequestException("Valid email address is required");
        }
        OrgRole targetRole;
        try {
            targetRole = OrgRole.fromString(roleStr);
        } catch (ValidationException e) {
            throw new BadRequestException(e.getMessage());
        }
        if (!actorRole.canManageRole(targetRole)) {
            throw new ForbiddenException("Role " + actorRole + " cannot invite with role " + targetRole);
        }

        Organization org = requireActiveOrganization(organizationId);
        ApiKeyCrypto.GeneratedKey generated = ApiKeyCrypto.generateInvitationToken();
        Instant expiresAt = Instant.now().plusSeconds(Invitation.DEFAULT_TTL_SECONDS);
        Invitation created = organizationRepository.createInvitation(
                organizationId,
                email.trim(),
                targetRole,
                generated.keyPrefix(),
                generated.keyHash(),
                actorUserId,
                expiresAt
        ).withOneTimeToken(generated.fullKey());

        String acceptUrl = (baseAppUrl != null && !baseAppUrl.isBlank() ? baseAppUrl : "http://localhost:8080")
                + "/?inviteToken=" + generated.fullKey();
        invitationNotifier.sendInvitationEmail(org, created, acceptUrl);

        recordAudit(
                organizationId,
                actorUserId,
                "member.invited",
                "invitation",
                created.id().toString(),
                Map.of(
                        "email", created.email(),
                        "role", created.role().name(),
                        "tokenPrefix", generated.keyPrefix()
                )
        );
        return created;
    }

    public Invitation resendInvitation(UUID actorUserId, UUID organizationId, UUID invitationId, String baseAppUrl) {
        OrgRole actorRole = requirePermission(organizationId, actorUserId, OrgPermission.MEMBER_MANAGE);
        Organization org = requireActiveOrganization(organizationId);
        Invitation existing = organizationRepository.findInvitationById(organizationId, invitationId)
                .orElseThrow(() -> new NotFoundException("Invitation not found: " + invitationId));

        if ("ACCEPTED".equalsIgnoreCase(existing.status())) {
            throw new BadRequestException("Invitation has already been accepted");
        }
        if (!actorRole.canManageRole(existing.role())) {
            throw new ForbiddenException("Role " + actorRole + " cannot resend invitation for role " + existing.role());
        }

        ApiKeyCrypto.GeneratedKey generated = ApiKeyCrypto.generateInvitationToken();
        Instant newExpiresAt = Instant.now().plusSeconds(Invitation.DEFAULT_TTL_SECONDS);
        Invitation refreshed = organizationRepository.refreshInvitationToken(
                organizationId,
                invitationId,
                generated.keyPrefix(),
                generated.keyHash(),
                newExpiresAt
        ).withOneTimeToken(generated.fullKey());

        String acceptUrl = (baseAppUrl != null && !baseAppUrl.isBlank() ? baseAppUrl : "http://localhost:8080")
                + "/?inviteToken=" + generated.fullKey();
        invitationNotifier.sendInvitationEmail(org, refreshed, acceptUrl);

        recordAudit(
                organizationId,
                actorUserId,
                "member.invitation_resent",
                "invitation",
                invitationId.toString(),
                Map.of(
                        "email", refreshed.email(),
                        "role", refreshed.role().name(),
                        "tokenPrefix", generated.keyPrefix()
                )
        );
        return refreshed;
    }

    public void revokeInvitation(UUID actorUserId, UUID organizationId, UUID invitationId) {
        requirePermission(organizationId, actorUserId, OrgPermission.MEMBER_MANAGE);
        Invitation existing = organizationRepository.findInvitationById(organizationId, invitationId)
                .orElseThrow(() -> new NotFoundException("Invitation not found: " + invitationId));
        boolean revoked = organizationRepository.revokeInvitation(organizationId, invitationId);
        if (!revoked) {
            throw new NotFoundException("Invitation not found: " + invitationId);
        }
        recordAudit(
                organizationId,
                actorUserId,
                "member.invitation_revoked",
                "invitation",
                invitationId.toString(),
                Map.of("email", existing.email(), "role", existing.role().name())
        );
    }

    public OrganizationView acceptInvitation(UUID acceptingUserId, String token) {
        if (token == null || token.isBlank()) {
            throw new BadRequestException("Invitation token is required");
        }
        String tokenHash = ApiKeyCrypto.sha256Hex(token.trim());
        Invitation invitation = organizationRepository.findInvitationByTokenHash(tokenHash)
                .orElseThrow(() -> new NotFoundException("Invitation token not found"));
        requireActiveOrganization(invitation.organizationId());
        if (!invitation.isPending(Instant.now())) {
            throw new BadRequestException("Invitation is expired or already accepted");
        }
        organizationRepository.upsertMember(invitation.organizationId(), acceptingUserId, invitation.role());
        organizationRepository.markInvitationAccepted(invitation.id());
        recordAudit(
                invitation.organizationId(),
                acceptingUserId,
                "member.invitation_accepted",
                "invitation",
                invitation.id().toString(),
                Map.of("email", invitation.email(), "role", invitation.role().name())
        );
        return getOrganizationView(acceptingUserId, invitation.organizationId());
    }

    public List<AuditLogEntry> listAuditLogs(UUID userId, UUID organizationId, String actionFilter, Integer limit) {
        requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        int safeLimit = limit != null ? limit : 50;
        return auditLogRepository.listByOrganization(organizationId, actionFilter, safeLimit);
    }

    public Organization requireActiveOrganization(UUID organizationId) {
        Organization org = organizationRepository.findById(organizationId)
                .orElseThrow(() -> new NotFoundException("Organization not found: " + organizationId));
        if (org.isDeleted()) {
            throw new ForbiddenException("Organization is scheduled for deletion: " + organizationId);
        }
        return org;
    }

    public OrgRole requirePermission(UUID organizationId, UUID userId, OrgPermission permission) {
        requireActiveOrganization(organizationId);
        OrgRole role = organizationRepository.findMemberRole(organizationId, userId)
                .orElseThrow(() -> new ForbiddenException("Access denied to organization " + organizationId));
        if (!role.hasPermission(permission)) {
            throw new ForbiddenException("Role " + role + " does not have required permission " + permission);
        }
        return role;
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
