package dev.flowtrace.domain;

import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;

/**
 * Role-Based Access Control (RBAC) roles within an Organization (TASK-1.2).
 *
 * <ul>
 *   <li>{@link #OWNER}: Full access, billing management, ownership transfer, organization deletion.</li>
 *   <li>{@link #ADMIN}: Member/invitation management, workspace creation, project & API key management.</li>
 *   <li>{@link #MEMBER}: Create/edit diagrams, run simulations, and inspect traces.</li>
 *   <li>{@link #VIEWER}: Read-only access to graphs and traces; cannot edit diagrams or manage API keys.</li>
 *   <li>{@link #BILLING_ADMIN}: Subscription and invoice management without access to traces, diagrams, or keys.</li>
 * </ul>
 */
public enum OrgRole {
    OWNER(EnumSet.allOf(OrgPermission.class)),
    ADMIN(EnumSet.of(
            OrgPermission.ORG_VIEW,
            OrgPermission.ORG_MANAGE,
            OrgPermission.MEMBER_MANAGE,
            OrgPermission.WORKSPACE_MANAGE,
            OrgPermission.PROJECT_VIEW,
            OrgPermission.PROJECT_MANAGE,
            OrgPermission.DIAGRAM_EDIT,
            OrgPermission.API_KEY_MANAGE,
            OrgPermission.TRACE_VIEW
    )),
    MEMBER(EnumSet.of(
            OrgPermission.ORG_VIEW,
            OrgPermission.PROJECT_VIEW,
            OrgPermission.DIAGRAM_EDIT,
            OrgPermission.TRACE_VIEW
    )),
    VIEWER(EnumSet.of(
            OrgPermission.ORG_VIEW,
            OrgPermission.PROJECT_VIEW,
            OrgPermission.TRACE_VIEW
    )),
    BILLING_ADMIN(EnumSet.of(
            OrgPermission.ORG_VIEW,
            OrgPermission.BILLING_MANAGE
    ));

    private final Set<OrgPermission> permissions;

    OrgRole(Set<OrgPermission> permissions) {
        this.permissions = Set.copyOf(permissions);
    }

    public Set<OrgPermission> permissions() {
        return permissions;
    }

    public boolean hasPermission(OrgPermission permission) {
        return permissions.contains(permission);
    }

    /**
     * Checks whether a caller with this role can assign or modify the target role.
     * Only OWNER can assign or modify another OWNER; ADMIN can assign ADMIN, MEMBER, VIEWER, BILLING_ADMIN.
     */
    public boolean canManageRole(OrgRole targetRole) {
        if (this == OWNER) {
            return true;
        }
        if (this == ADMIN) {
            return targetRole != OWNER;
        }
        return false;
    }

    public static OrgRole fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MEMBER;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        try {
            return OrgRole.valueOf(normalized);
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid organization role: " + raw);
        }
    }
}
