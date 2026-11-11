package dev.flowtrace.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

public class ApiKeyTest {

    @Test
    @DisplayName("ApiKey correctly validates scopes")
    public void testApiKeyScopes() {
        UUID projectId = UUID.randomUUID();
        ApiKey keyIngest = new ApiKey(
                UUID.randomUUID(), projectId, "Ingest Only", "ft_live_1", "hash1",
                1000, "ingest", null, Instant.now(), null, null, null
        );
        assertTrue(keyIngest.hasScope("ingest"));
        assertFalse(keyIngest.hasScope("read"));
        assertFalse(keyIngest.hasScope("admin"));

        ApiKey keyMulti = new ApiKey(
                UUID.randomUUID(), projectId, "Multi Scope", "ft_live_2", "hash2",
                1000, "ingest, read", null, Instant.now(), null, null, null
        );
        assertTrue(keyMulti.hasScope("ingest"));
        assertTrue(keyMulti.hasScope("read"));
        assertFalse(keyMulti.hasScope("admin"));

        ApiKey keyAdmin = new ApiKey(
                UUID.randomUUID(), projectId, "Admin Scope", "ft_live_3", "hash3",
                1000, "admin", null, Instant.now(), null, null, null
        );
        assertTrue(keyAdmin.hasScope("ingest"));
        assertTrue(keyAdmin.hasScope("read"));
        assertTrue(keyAdmin.hasScope("admin"));

        ApiKey keyWildcard = new ApiKey(
                UUID.randomUUID(), projectId, "Wildcard Scope", "ft_live_4", "hash4",
                1000, "*", null, Instant.now(), null, null, null
        );
        assertTrue(keyWildcard.hasScope("ingest"));
        assertTrue(keyWildcard.hasScope("read"));
    }

    @Test
    @DisplayName("ApiKey correctly evaluates active vs revoked vs expired status")
    public void testApiKeyActiveStatus() {
        UUID projectId = UUID.randomUUID();
        Instant now = Instant.now();

        ApiKey active = new ApiKey(
                UUID.randomUUID(), projectId, "Active", "ft_live_a", "hasha",
                1000, "ingest", null, now, null, null, null
        );
        assertTrue(active.isActive());

        ApiKey revoked = new ApiKey(
                UUID.randomUUID(), projectId, "Revoked", "ft_live_r", "hashr",
                1000, "ingest", null, now, null, now, null
        );
        assertFalse(revoked.isActive());

        ApiKey expiringFuture = new ApiKey(
                UUID.randomUUID(), projectId, "Rotating Grace", "ft_live_g", "hashg",
                1000, "ingest", null, now, null, null, now.plus(24, ChronoUnit.HOURS)
        );
        assertTrue(expiringFuture.isActive());

        ApiKey expiredPast = new ApiKey(
                UUID.randomUUID(), projectId, "Expired", "ft_live_e", "hashe",
                1000, "ingest", null, now, null, null, now.minus(1, ChronoUnit.MINUTES)
        );
        assertFalse(expiredPast.isActive());
    }
}
