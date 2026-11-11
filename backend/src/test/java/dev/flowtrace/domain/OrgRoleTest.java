package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for Epic 1 RBAC Role & Permission matrix (TASK-1.2) and Invitation TTL (TASK-1.3).
 */
class OrgRoleTest {

    @Test
    void ownerHasAllPermissionsAndCanManageEveryRole() {
        for (OrgPermission perm : OrgPermission.values()) {
            assertTrue(OrgRole.OWNER.hasPermission(perm), "OWNER must have " + perm);
        }
        for (OrgRole target : OrgRole.values()) {
            assertTrue(OrgRole.OWNER.canManageRole(target));
        }
    }

    @Test
    void adminCanManageMembersWorkspacesAndKeys_butCannotDeleteOrgOrTransferOwnership() {
        assertTrue(OrgRole.ADMIN.hasPermission(OrgPermission.MEMBER_MANAGE));
        assertTrue(OrgRole.ADMIN.hasPermission(OrgPermission.WORKSPACE_MANAGE));
        assertTrue(OrgRole.ADMIN.hasPermission(OrgPermission.API_KEY_MANAGE));
        assertTrue(OrgRole.ADMIN.hasPermission(OrgPermission.DIAGRAM_EDIT));

        assertFalse(OrgRole.ADMIN.hasPermission(OrgPermission.ORG_DELETE));
        assertFalse(OrgRole.ADMIN.hasPermission(OrgPermission.ORG_TRANSFER));
        assertFalse(OrgRole.ADMIN.canManageRole(OrgRole.OWNER));
        assertTrue(OrgRole.ADMIN.canManageRole(OrgRole.MEMBER));
        assertTrue(OrgRole.ADMIN.canManageRole(OrgRole.VIEWER));
    }

    @Test
    void memberCanEditDiagramsAndViewTraces_butCannotManageKeysOrMembers() {
        assertTrue(OrgRole.MEMBER.hasPermission(OrgPermission.PROJECT_VIEW));
        assertTrue(OrgRole.MEMBER.hasPermission(OrgPermission.DIAGRAM_EDIT));
        assertTrue(OrgRole.MEMBER.hasPermission(OrgPermission.TRACE_VIEW));

        assertFalse(OrgRole.MEMBER.hasPermission(OrgPermission.API_KEY_MANAGE));
        assertFalse(OrgRole.MEMBER.hasPermission(OrgPermission.MEMBER_MANAGE));
        assertFalse(OrgRole.MEMBER.hasPermission(OrgPermission.PROJECT_MANAGE));
    }

    @Test
    void viewerIsStrictlyReadOnly() {
        assertTrue(OrgRole.VIEWER.hasPermission(OrgPermission.ORG_VIEW));
        assertTrue(OrgRole.VIEWER.hasPermission(OrgPermission.PROJECT_VIEW));
        assertTrue(OrgRole.VIEWER.hasPermission(OrgPermission.TRACE_VIEW));

        assertFalse(OrgRole.VIEWER.hasPermission(OrgPermission.DIAGRAM_EDIT));
        assertFalse(OrgRole.VIEWER.hasPermission(OrgPermission.API_KEY_MANAGE));
        assertFalse(OrgRole.VIEWER.hasPermission(OrgPermission.PROJECT_MANAGE));
    }

    @Test
    void billingAdminCanManageBilling_butHasZeroAccessToProjectsTracesOrKeys() {
        assertTrue(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.ORG_VIEW));
        assertTrue(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.BILLING_MANAGE));

        assertFalse(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.PROJECT_VIEW));
        assertFalse(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.TRACE_VIEW));
        assertFalse(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.DIAGRAM_EDIT));
        assertFalse(OrgRole.BILLING_ADMIN.hasPermission(OrgPermission.API_KEY_MANAGE));
    }

    @Test
    void invitationExpirationAndSlugifyWorkDeterministic() {
        Instant now = Instant.parse("2026-11-09T12:00:00Z");
        Invitation validInv = new Invitation(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "sre@acme.io",
                OrgRole.MEMBER,
                "ft_inv_123",
                "PENDING",
                UUID.randomUUID(),
                now.plusSeconds(Invitation.DEFAULT_TTL_SECONDS),
                now
        );
        assertTrue(validInv.isPending(now));
        assertFalse(validInv.isPending(now.plusSeconds(Invitation.DEFAULT_TTL_SECONDS + 1)));

        assertEquals("acme-cloud-ops", Organization.slugify("  Acme Cloud & Ops! "));
        assertEquals(PlanTier.BUSINESS, PlanTier.fromString("business"));
    }
}
