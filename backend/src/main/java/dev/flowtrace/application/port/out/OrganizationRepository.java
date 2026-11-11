package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.OrgRole;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.OrganizationMember;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Workspace;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrganizationRepository {

    Organization ensurePersonalOrganization(UUID userId, String email);

    List<Organization> listForUser(UUID userId);

    Optional<Organization> findById(UUID organizationId);

    Optional<Organization> findBySlug(String slug);

    Organization createOrganization(UUID creatorUserId, String name, String slug, String billingEmail, PlanTier planTier);

    Organization updateOrganization(UUID organizationId, String name, String slug, String billingEmail, PlanTier planTier);

    void softDeleteOrganization(UUID organizationId, Instant deletedAt);

    Organization restoreOrganization(UUID organizationId);

    void deleteOrganization(UUID organizationId);

    int purgeOrganizationsDeletedBefore(Instant cutoff);

    Optional<OrgRole> findMemberRole(UUID organizationId, UUID userId);

    List<OrganizationMember> listMembers(UUID organizationId);

    void upsertMember(UUID organizationId, UUID userId, OrgRole role);

    boolean removeMember(UUID organizationId, UUID userId);

    List<Workspace> listWorkspaces(UUID organizationId);

    Optional<Workspace> findWorkspaceById(UUID workspaceId);

    Workspace createWorkspace(UUID organizationId, String name, String slug);

    Workspace updateWorkspace(UUID workspaceId, String name, String slug);

    boolean deleteWorkspace(UUID organizationId, UUID workspaceId);

    List<Invitation> listInvitations(UUID organizationId);

    Optional<Invitation> findInvitationById(UUID organizationId, UUID invitationId);

    Invitation createInvitation(
            UUID organizationId,
            String email,
            OrgRole role,
            String tokenPrefix,
            String tokenHash,
            UUID invitedBy,
            Instant expiresAt
    );

    default Invitation createInvitation(
            UUID organizationId,
            String email,
            OrgRole role,
            String rawToken,
            UUID invitedBy,
            Instant expiresAt
    ) {
        ApiKeyCrypto.GeneratedKey gen = ApiKeyCrypto.fromRawKey(rawToken);
        return createInvitation(organizationId, email, role, gen.keyPrefix(), gen.keyHash(), invitedBy, expiresAt)
                .withOneTimeToken(rawToken);
    }

    Invitation refreshInvitationToken(
            UUID organizationId,
            UUID invitationId,
            String tokenPrefix,
            String tokenHash,
            Instant newExpiresAt
    );

    Optional<Invitation> findInvitationByTokenHash(String tokenHash);

    default Optional<Invitation> findInvitationByToken(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Optional.empty();
        }
        return findInvitationByTokenHash(ApiKeyCrypto.sha256Hex(rawToken.trim()));
    }

    void markInvitationAccepted(UUID invitationId);

    boolean revokeInvitation(UUID organizationId, UUID invitationId);
}
