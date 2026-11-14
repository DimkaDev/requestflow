package dev.flowtrace.adapter.out.pg;

import dev.flowtrace.application.port.out.OrganizationRepository;
import dev.flowtrace.domain.Invitation;
import dev.flowtrace.domain.OrgRole;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.OrganizationMember;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.UuidV7;
import dev.flowtrace.domain.Workspace;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.sql.DataSource;

@ApplicationScoped
public class JdbcOrganizationRepository implements OrganizationRepository {

    private final DataSource dataSource;

    @Inject
    public JdbcOrganizationRepository(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public synchronized Organization ensurePersonalOrganization(UUID userId, String email) {
        List<Organization> existing = listForUser(userId);
        if (!existing.isEmpty()) {
            Organization org = existing.getFirst();
            List<Workspace> workspaces = listWorkspaces(org.id());
            Workspace defaultWs = workspaces.isEmpty()
                    ? createWorkspace(org.id(), "Production", "production")
                    : workspaces.getFirst();
            bindUnlinkedProjects(userId, org.id(), defaultWs.id());
            return org;
        }

        String prefix = (email != null && email.contains("@"))
                ? email.substring(0, email.indexOf('@'))
                : "Personal";
        String orgName = prefix.substring(0, 1).toUpperCase() + prefix.substring(1) + " Organization";
        String baseSlug = Organization.slugify(prefix) + "-" + userId.toString().substring(0, 6);
        String billingEmail = (email != null && !email.isBlank()) ? email : "billing@flowtrace.local";

        Organization created = createOrganization(userId, orgName, baseSlug, billingEmail, PlanTier.FREE);
        List<Workspace> workspaces = listWorkspaces(created.id());
        if (!workspaces.isEmpty()) {
            bindUnlinkedProjects(userId, created.id(), workspaces.getFirst().id());
        }
        return created;
    }

    private void bindUnlinkedProjects(UUID ownerId, UUID organizationId, UUID workspaceId) {
        String sql = "UPDATE projects SET organization_id = ?, workspace_id = ? WHERE owner_id = ? AND organization_id IS NULL";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.setObject(2, workspaceId);
            ps.setObject(3, ownerId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to bind unlinked projects for user " + ownerId, e);
        }
    }

    @Override
    public List<Organization> listForUser(UUID userId) {
        String sql = """
                SELECT o.id, o.name, o.slug, o.billing_email, o.plan_tier, o.created_at, o.deleted_at
                FROM organizations o
                JOIN organization_members m ON m.organization_id = o.id
                WHERE m.user_id = ? AND o.deleted_at IS NULL
                ORDER BY o.created_at ASC
                """;
        List<Organization> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, userId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapOrganization(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list organizations for user " + userId, e);
        }
    }

    @Override
    public Optional<Organization> findById(UUID organizationId) {
        String sql = "SELECT id, name, slug, billing_email, plan_tier, created_at, deleted_at FROM organizations WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapOrganization(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find organization " + organizationId, e);
        }
    }

    @Override
    public Optional<Organization> findBySlug(String slug) {
        String sql = "SELECT id, name, slug, billing_email, plan_tier, created_at, deleted_at FROM organizations WHERE slug = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, slug);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapOrganization(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find organization by slug " + slug, e);
        }
    }

    @Override
    public Organization createOrganization(UUID creatorUserId, String name, String slug, String billingEmail, PlanTier planTier) {
        UUID orgId = UuidV7.generate();
        Instant now = Instant.now();
        String uniqueSlug = ensureUniqueOrgSlug(slug);
        PlanTier tier = planTier != null ? planTier : PlanTier.FREE;

        String insertOrg = "INSERT INTO organizations (id, name, slug, billing_email, plan_tier, created_at) VALUES (?, ?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(insertOrg)) {
            ps.setObject(1, orgId);
            ps.setString(2, name);
            ps.setString(3, uniqueSlug);
            ps.setString(4, billingEmail);
            ps.setString(5, tier.name());
            ps.setTimestamp(6, Timestamp.from(now));
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create organization", e);
        }

        upsertMember(orgId, creatorUserId, OrgRole.OWNER);
        createWorkspace(orgId, "Production", "production");
        return new Organization(orgId, name, uniqueSlug, billingEmail, tier, now, null);
    }

    private String ensureUniqueOrgSlug(String desiredSlug) {
        String base = Organization.slugify(desiredSlug);
        if (findBySlug(base).isEmpty()) {
            return base;
        }
        return base + "-" + UuidV7.generateString().substring(0, 6);
    }

    @Override
    public Organization updateOrganization(UUID organizationId, String name, String slug, String billingEmail, PlanTier planTier) {
        Organization current = findById(organizationId).orElseThrow();
        String newName = (name != null && !name.isBlank()) ? name.trim() : current.name();
        String newSlug = (slug != null && !slug.isBlank()) ? Organization.slugify(slug) : current.slug();
        String newEmail = (billingEmail != null && !billingEmail.isBlank()) ? billingEmail.trim() : current.billingEmail();
        PlanTier newTier = planTier != null ? planTier : current.planTier();

        String sql = "UPDATE organizations SET name = ?, slug = ?, billing_email = ?, plan_tier = ? WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newName);
            ps.setString(2, newSlug);
            ps.setString(3, newEmail);
            ps.setString(4, newTier.name());
            ps.setObject(5, organizationId);
            ps.executeUpdate();
            return new Organization(organizationId, newName, newSlug, newEmail, newTier, current.createdAt(), current.deletedAt());
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to update organization " + organizationId, e);
        }
    }

    @Override
    public void softDeleteOrganization(UUID organizationId, Instant deletedAt) {
        Instant mark = deletedAt != null ? deletedAt : Instant.now();
        String sql = "UPDATE organizations SET deleted_at = ? WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(mark));
            ps.setObject(2, organizationId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to soft-delete organization " + organizationId, e);
        }
    }

    @Override
    public Organization restoreOrganization(UUID organizationId) {
        String sql = "UPDATE organizations SET deleted_at = NULL WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.executeUpdate();
            return findById(organizationId).orElseThrow();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to restore organization " + organizationId, e);
        }
    }

    @Override
    public void deleteOrganization(UUID organizationId) {
        String sql = "DELETE FROM organizations WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to delete organization " + organizationId, e);
        }
    }

    @Override
    public int purgeOrganizationsDeletedBefore(Instant cutoff) {
        String sql = "DELETE FROM organizations WHERE deleted_at IS NOT NULL AND deleted_at < ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(cutoff));
            return ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to purge expired soft-deleted organizations", e);
        }
    }

    @Override
    public Optional<OrgRole> findMemberRole(UUID organizationId, UUID userId) {
        String sql = "SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.setObject(2, userId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(OrgRole.fromString(rs.getString("role")));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find member role", e);
        }
    }

    @Override
    public List<OrganizationMember> listMembers(UUID organizationId) {
        String sql = """
                SELECT m.organization_id, m.user_id, u.email, u.external_id, m.role, m.created_at
                FROM organization_members m
                JOIN users u ON u.id = m.user_id
                WHERE m.organization_id = ?
                ORDER BY m.created_at ASC
                """;
        List<OrganizationMember> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(new OrganizationMember(
                            UUID.fromString(rs.getString("organization_id")),
                            UUID.fromString(rs.getString("user_id")),
                            rs.getString("email"),
                            rs.getString("external_id"),
                            OrgRole.fromString(rs.getString("role")),
                            rs.getTimestamp("created_at").toInstant()
                    ));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list members for organization " + organizationId, e);
        }
    }

    @Override
    public void upsertMember(UUID organizationId, UUID userId, OrgRole role) {
        String updateSql = "UPDATE organization_members SET role = ? WHERE organization_id = ? AND user_id = ?";
        String insertSql = "INSERT INTO organization_members (organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection()) {
            try (PreparedStatement upd = conn.prepareStatement(updateSql)) {
                upd.setString(1, role.name());
                upd.setObject(2, organizationId);
                upd.setObject(3, userId);
                int updated = upd.executeUpdate();
                if (updated > 0) {
                    return;
                }
            }
            try (PreparedStatement ins = conn.prepareStatement(insertSql)) {
                ins.setObject(1, organizationId);
                ins.setObject(2, userId);
                ins.setString(3, role.name());
                ins.setTimestamp(4, Timestamp.from(Instant.now()));
                ins.executeUpdate();
            }
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to upsert organization member", e);
        }
    }

    @Override
    public boolean removeMember(UUID organizationId, UUID userId) {
        String sql = "DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            ps.setObject(2, userId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to remove organization member", e);
        }
    }

    @Override
    public List<Workspace> listWorkspaces(UUID organizationId) {
        String sql = "SELECT id, organization_id, name, slug, created_at FROM workspaces WHERE organization_id = ? ORDER BY created_at ASC";
        List<Workspace> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapWorkspace(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list workspaces", e);
        }
    }

    @Override
    public Optional<Workspace> findWorkspaceById(UUID workspaceId) {
        String sql = "SELECT id, organization_id, name, slug, created_at FROM workspaces WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, workspaceId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapWorkspace(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find workspace " + workspaceId, e);
        }
    }

    @Override
    public Workspace createWorkspace(UUID organizationId, String name, String slug) {
        UUID id = UuidV7.generate();
        Instant now = Instant.now();
        String cleanSlug = Workspace.slugify(slug != null && !slug.isBlank() ? slug : name);
        String sql = "INSERT INTO workspaces (id, organization_id, name, slug, created_at) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, organizationId);
            ps.setString(3, name);
            ps.setString(4, cleanSlug);
            ps.setTimestamp(5, Timestamp.from(now));
            ps.executeUpdate();
            return new Workspace(id, organizationId, name, cleanSlug, now);
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create workspace", e);
        }
    }

    @Override
    public Workspace updateWorkspace(UUID workspaceId, String name, String slug) {
        Workspace current = findWorkspaceById(workspaceId).orElseThrow();
        String newName = (name != null && !name.isBlank()) ? name.trim() : current.name();
        String newSlug = (slug != null && !slug.isBlank()) ? Workspace.slugify(slug) : current.slug();
        String sql = "UPDATE workspaces SET name = ?, slug = ? WHERE id = ? AND organization_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, newName);
            ps.setString(2, newSlug);
            ps.setObject(3, workspaceId);
            ps.setObject(4, current.organizationId());
            ps.executeUpdate();
            return new Workspace(workspaceId, current.organizationId(), newName, newSlug, current.createdAt());
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to update workspace", e);
        }
    }

    @Override
    public boolean deleteWorkspace(UUID organizationId, UUID workspaceId) {
        String sql = "DELETE FROM workspaces WHERE id = ? AND organization_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, workspaceId);
            ps.setObject(2, organizationId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to delete workspace", e);
        }
    }

    @Override
    public List<Invitation> listInvitations(UUID organizationId) {
        String sql = """
                SELECT id, organization_id, email, role, token, token_prefix, token_hash, status, invited_by, expires_at, created_at
                FROM invitations
                WHERE organization_id = ?
                ORDER BY created_at DESC
                """;
        List<Invitation> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapInvitation(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list invitations", e);
        }
    }

    @Override
    public Optional<Invitation> findInvitationById(UUID organizationId, UUID invitationId) {
        String sql = """
                SELECT id, organization_id, email, role, token, token_prefix, token_hash, status, invited_by, expires_at, created_at
                FROM invitations
                WHERE id = ? AND organization_id = ?
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, invitationId);
            ps.setObject(2, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapInvitation(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find invitation " + invitationId, e);
        }
    }

    @Override
    public Invitation createInvitation(
            UUID organizationId,
            String email,
            OrgRole role,
            String tokenPrefix,
            String tokenHash,
            UUID invitedBy,
            Instant expiresAt
    ) {
        UUID id = UuidV7.generate();
        Instant now = Instant.now();
        String sql = """
                INSERT INTO invitations
                (id, organization_id, email, role, token, token_prefix, token_hash, status, invited_by, expires_at, created_at)
                VALUES (?, ?, ?, ?, NULL, ?, ?, 'PENDING', ?, ?, ?)
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, id);
            ps.setObject(2, organizationId);
            ps.setString(3, email);
            ps.setString(4, role.name());
            ps.setString(5, tokenPrefix);
            ps.setString(6, tokenHash);
            if (invitedBy != null) {
                ps.setObject(7, invitedBy);
            } else {
                ps.setNull(7, Types.OTHER);
            }
            ps.setTimestamp(8, Timestamp.from(expiresAt));
            ps.setTimestamp(9, Timestamp.from(now));
            ps.executeUpdate();
            return new Invitation(
                    id,
                    organizationId,
                    email,
                    role,
                    null,
                    tokenPrefix,
                    tokenHash,
                    "PENDING",
                    invitedBy,
                    expiresAt,
                    now
            );
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create invitation", e);
        }
    }

    @Override
    public Invitation refreshInvitationToken(
            UUID organizationId,
            UUID invitationId,
            String tokenPrefix,
            String tokenHash,
            Instant newExpiresAt
    ) {
        String sql = """
                UPDATE invitations
                SET token = NULL, token_prefix = ?, token_hash = ?, expires_at = ?, status = 'PENDING'
                WHERE id = ? AND organization_id = ?
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, tokenPrefix);
            ps.setString(2, tokenHash);
            ps.setTimestamp(3, Timestamp.from(newExpiresAt));
            ps.setObject(4, invitationId);
            ps.setObject(5, organizationId);
            ps.executeUpdate();
            return findInvitationById(organizationId, invitationId).orElseThrow();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to refresh invitation token " + invitationId, e);
        }
    }

    @Override
    public Optional<Invitation> findInvitationByTokenHash(String tokenHash) {
        String sql = """
                SELECT id, organization_id, email, role, token, token_prefix, token_hash, status, invited_by, expires_at, created_at
                FROM invitations
                WHERE token_hash = ?
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, tokenHash);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapInvitation(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find invitation by token hash", e);
        }
    }

    @Override
    public void markInvitationAccepted(UUID invitationId) {
        String sql = "UPDATE invitations SET status = 'ACCEPTED' WHERE id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, invitationId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to mark invitation accepted", e);
        }
    }

    @Override
    public boolean revokeInvitation(UUID organizationId, UUID invitationId) {
        String sql = "DELETE FROM invitations WHERE id = ? AND organization_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, invitationId);
            ps.setObject(2, organizationId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to revoke invitation", e);
        }
    }

    @Override
    public Optional<dev.flowtrace.domain.Subscription> findSubscription(UUID organizationId) {
        String sql = """
                SELECT organization_id, provider, provider_customer_id, provider_subscription_id,
                       plan_tier, billing_interval, status, current_period_start, current_period_end,
                       cancel_at_period_end, grace_period_ends_at, company_name, billing_country,
                       vat_id, promo_code, discount_percent, updated_at
                FROM organization_subscriptions
                WHERE organization_id = ?
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapSubscription(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to find subscription for organization " + organizationId, e);
        }
    }

    @Override
    public synchronized dev.flowtrace.domain.Subscription upsertSubscription(dev.flowtrace.domain.Subscription sub) {
        Optional<dev.flowtrace.domain.Subscription> existing = findSubscription(sub.organizationId());
        if (existing.isPresent()) {
            String updateSql = """
                    UPDATE organization_subscriptions
                    SET provider = ?, provider_customer_id = ?, provider_subscription_id = ?,
                        plan_tier = ?, billing_interval = ?, status = ?, current_period_start = ?,
                        current_period_end = ?, cancel_at_period_end = ?, grace_period_ends_at = ?,
                        company_name = ?, billing_country = ?, vat_id = ?, promo_code = ?,
                        discount_percent = ?, updated_at = ?
                    WHERE organization_id = ?
                    """;
            try (Connection conn = dataSource.getConnection();
                 PreparedStatement ps = conn.prepareStatement(updateSql)) {
                ps.setString(1, sub.provider());
                ps.setString(2, sub.providerCustomerId());
                ps.setString(3, sub.providerSubscriptionId());
                ps.setString(4, sub.planTier().name());
                ps.setString(5, sub.billingInterval().name());
                ps.setString(6, sub.status().name());
                ps.setTimestamp(7, Timestamp.from(sub.currentPeriodStart()));
                ps.setTimestamp(8, Timestamp.from(sub.currentPeriodEnd()));
                ps.setBoolean(9, sub.cancelAtPeriodEnd());
                if (sub.gracePeriodEndsAt() != null) {
                    ps.setTimestamp(10, Timestamp.from(sub.gracePeriodEndsAt()));
                } else {
                    ps.setNull(10, Types.TIMESTAMP);
                }
                ps.setString(11, sub.companyName());
                ps.setString(12, sub.billingCountry());
                ps.setString(13, sub.vatId());
                ps.setString(14, sub.promoCode());
                ps.setInt(15, sub.discountPercent());
                ps.setTimestamp(16, Timestamp.from(sub.updatedAt()));
                ps.setObject(17, sub.organizationId());
                ps.executeUpdate();
                return sub;
            } catch (SQLException e) {
                throw new IllegalStateException("Failed to update subscription for organization " + sub.organizationId(), e);
            }
        }

        String insertSql = """
                INSERT INTO organization_subscriptions (
                    organization_id, provider, provider_customer_id, provider_subscription_id,
                    plan_tier, billing_interval, status, current_period_start, current_period_end,
                    cancel_at_period_end, grace_period_ends_at, company_name, billing_country,
                    vat_id, promo_code, discount_percent, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(insertSql)) {
            ps.setObject(1, sub.organizationId());
            ps.setString(2, sub.provider());
            ps.setString(3, sub.providerCustomerId());
            ps.setString(4, sub.providerSubscriptionId());
            ps.setString(5, sub.planTier().name());
            ps.setString(6, sub.billingInterval().name());
            ps.setString(7, sub.status().name());
            ps.setTimestamp(8, Timestamp.from(sub.currentPeriodStart()));
            ps.setTimestamp(9, Timestamp.from(sub.currentPeriodEnd()));
            ps.setBoolean(10, sub.cancelAtPeriodEnd());
            if (sub.gracePeriodEndsAt() != null) {
                ps.setTimestamp(11, Timestamp.from(sub.gracePeriodEndsAt()));
            } else {
                ps.setNull(11, Types.TIMESTAMP);
            }
            ps.setString(12, sub.companyName());
            ps.setString(13, sub.billingCountry());
            ps.setString(14, sub.vatId());
            ps.setString(15, sub.promoCode());
            ps.setInt(16, sub.discountPercent());
            ps.setTimestamp(17, Timestamp.from(sub.updatedAt()));
            ps.executeUpdate();
            return sub;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to insert subscription for organization " + sub.organizationId(), e);
        }
    }

    @Override
    public List<dev.flowtrace.domain.Subscription> findPastDueSubscriptionsExpiredBefore(Instant cutoff) {
        String sql = """
                SELECT organization_id, provider, provider_customer_id, provider_subscription_id,
                       plan_tier, billing_interval, status, current_period_start, current_period_end,
                       cancel_at_period_end, grace_period_ends_at, company_name, billing_country,
                       vat_id, promo_code, discount_percent, updated_at
                FROM organization_subscriptions
                WHERE status = 'PAST_DUE' AND grace_period_ends_at IS NOT NULL AND grace_period_ends_at <= ?
                """;
        List<dev.flowtrace.domain.Subscription> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setTimestamp(1, Timestamp.from(cutoff));
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapSubscription(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to query expired past-due subscriptions", e);
        }
    }

    @Override
    public List<dev.flowtrace.domain.BillingInvoice> listInvoices(UUID organizationId) {
        String sql = """
                SELECT id, organization_id, provider_invoice_id, plan_tier, billing_interval,
                       amount_cents, currency, status, invoice_pdf_url, created_at
                FROM billing_invoices
                WHERE organization_id = ?
                ORDER BY created_at DESC
                """;
        List<dev.flowtrace.domain.BillingInvoice> list = new ArrayList<>();
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, organizationId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapInvoice(rs));
                }
            }
            return list;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to list invoices for organization " + organizationId, e);
        }
    }

    @Override
    public dev.flowtrace.domain.BillingInvoice createInvoice(dev.flowtrace.domain.BillingInvoice inv) {
        String sql = """
                INSERT INTO billing_invoices (
                    id, organization_id, provider_invoice_id, plan_tier, billing_interval,
                    amount_cents, currency, status, invoice_pdf_url, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setObject(1, inv.id());
            ps.setObject(2, inv.organizationId());
            ps.setString(3, inv.providerInvoiceId());
            ps.setString(4, inv.planTier().name());
            ps.setString(5, inv.billingInterval().name());
            ps.setInt(6, inv.amountCents());
            ps.setString(7, inv.currency());
            ps.setString(8, inv.status());
            ps.setString(9, inv.invoicePdfUrl());
            ps.setTimestamp(10, Timestamp.from(inv.createdAt()));
            ps.executeUpdate();
            return inv;
        } catch (SQLException e) {
            throw new IllegalStateException("Failed to create billing invoice for organization " + inv.organizationId(), e);
        }
    }

    @Override
    public synchronized boolean tryRecordWebhookEvent(String eventId, UUID organizationId, String eventType, Instant processedAt) {
        String checkSql = "SELECT event_id FROM billing_webhook_events WHERE event_id = ?";
        try (Connection conn = dataSource.getConnection();
             PreparedStatement checkPs = conn.prepareStatement(checkSql)) {
            checkPs.setString(1, eventId);
            try (ResultSet rs = checkPs.executeQuery()) {
                if (rs.next()) {
                    return false;
                }
            }
            String insertSql = "INSERT INTO billing_webhook_events (event_id, organization_id, event_type, processed_at) VALUES (?, ?, ?, ?)";
            try (PreparedStatement insertPs = conn.prepareStatement(insertSql)) {
                insertPs.setString(1, eventId);
                insertPs.setObject(2, organizationId);
                insertPs.setString(3, eventType);
                insertPs.setTimestamp(4, Timestamp.from(processedAt != null ? processedAt : Instant.now()));
                insertPs.executeUpdate();
                return true;
            }
        } catch (SQLException e) {
            return false;
        }
    }

    private dev.flowtrace.domain.Subscription mapSubscription(ResultSet rs) throws SQLException {
        Timestamp graceTs = rs.getTimestamp("grace_period_ends_at");
        return new dev.flowtrace.domain.Subscription(
                UUID.fromString(rs.getString("organization_id")),
                rs.getString("provider"),
                rs.getString("provider_customer_id"),
                rs.getString("provider_subscription_id"),
                PlanTier.fromString(rs.getString("plan_tier")),
                dev.flowtrace.domain.BillingInterval.fromString(rs.getString("billing_interval")),
                dev.flowtrace.domain.SubscriptionStatus.fromString(rs.getString("status")),
                rs.getTimestamp("current_period_start").toInstant(),
                rs.getTimestamp("current_period_end").toInstant(),
                rs.getBoolean("cancel_at_period_end"),
                graceTs != null ? graceTs.toInstant() : null,
                rs.getString("company_name"),
                rs.getString("billing_country"),
                rs.getString("vat_id"),
                rs.getString("promo_code"),
                rs.getInt("discount_percent"),
                rs.getTimestamp("updated_at").toInstant()
        );
    }

    private dev.flowtrace.domain.BillingInvoice mapInvoice(ResultSet rs) throws SQLException {
        return new dev.flowtrace.domain.BillingInvoice(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("organization_id")),
                rs.getString("provider_invoice_id"),
                PlanTier.fromString(rs.getString("plan_tier")),
                dev.flowtrace.domain.BillingInterval.fromString(rs.getString("billing_interval")),
                rs.getInt("amount_cents"),
                rs.getString("currency"),
                rs.getString("status"),
                rs.getString("invoice_pdf_url"),
                rs.getTimestamp("created_at").toInstant()
        );
    }

    private Organization mapOrganization(ResultSet rs) throws SQLException {
        Timestamp deletedTs = rs.getTimestamp("deleted_at");
        return new Organization(
                UUID.fromString(rs.getString("id")),
                rs.getString("name"),
                rs.getString("slug"),
                rs.getString("billing_email"),
                PlanTier.fromString(rs.getString("plan_tier")),
                rs.getTimestamp("created_at").toInstant(),
                deletedTs != null ? deletedTs.toInstant() : null
        );
    }

    private Workspace mapWorkspace(ResultSet rs) throws SQLException {
        return new Workspace(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("organization_id")),
                rs.getString("name"),
                rs.getString("slug"),
                rs.getTimestamp("created_at").toInstant()
        );
    }

    private Invitation mapInvitation(ResultSet rs) throws SQLException {
        String inviterStr = rs.getString("invited_by");
        return new Invitation(
                UUID.fromString(rs.getString("id")),
                UUID.fromString(rs.getString("organization_id")),
                rs.getString("email"),
                OrgRole.fromString(rs.getString("role")),
                rs.getString("token"),
                rs.getString("token_prefix"),
                rs.getString("token_hash"),
                rs.getString("status"),
                inviterStr != null ? UUID.fromString(inviterStr) : null,
                rs.getTimestamp("expires_at").toInstant(),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
