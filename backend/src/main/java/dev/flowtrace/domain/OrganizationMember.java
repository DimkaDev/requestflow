package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Membership record linking a user to an Organization with a specific RBAC {@link OrgRole}.
 */
public record OrganizationMember(
        UUID organizationId,
        UUID userId,
        String email,
        String externalId,
        OrgRole role,
        Instant createdAt
) {
}
