package dev.flowtrace.domain;

/**
 * Granular permissions enforced by the FlowTrace RBAC engine (TASK-1.2).
 */
public enum OrgPermission {
    ORG_VIEW,
    ORG_MANAGE,
    ORG_DELETE,
    ORG_TRANSFER,
    BILLING_MANAGE,
    MEMBER_MANAGE,
    WORKSPACE_MANAGE,
    PROJECT_VIEW,
    PROJECT_MANAGE,
    DIAGRAM_EDIT,
    API_KEY_MANAGE,
    TRACE_VIEW
}
