package dev.flowtrace.domain;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Architectural & SQL Tenant-Isolation Guard (E1-Step-5, E1-Step-7).
 * Verifies:
 * 1. Domain layer remains 100% framework-free (Hexagonal Golden Rule 4).
 * 2. All JDBC repository SELECT/UPDATE/DELETE statements include explicit WHERE scoping.
 * 3. Invitation token hashing (SHA-256) never persists plaintext tokens when stored.
 */
class TenantIsolationGuardTest {

    private static final Pattern SQL_DML_PATTERN = Pattern.compile(
            "(?is)\\b(SELECT|UPDATE|DELETE)\\b[^;\"]*?\\bFROM\\b[^;\"]+|\\bUPDATE\\s+[a-z_]+\\s+SET\\b[^;\"]+");

    @Test
    void domainLayerHasZeroFrameworkImports() throws IOException {
        Path domainDir = Path.of("src/main/java/dev/flowtrace/domain");
        assertTrue(Files.isDirectory(domainDir), "Expected domain directory at " + domainDir.toAbsolutePath());

        try (Stream<Path> files = Files.walk(domainDir)) {
            List<Path> javaFiles = files.filter(p -> p.toString().endsWith(".java")).toList();
            assertFalse(javaFiles.isEmpty());

            for (Path file : javaFiles) {
                String content = Files.readString(file);
                assertFalse(content.contains("import io.quarkus."), "Forbidden Quarkus import in " + file.getFileName());
                assertFalse(content.contains("import jakarta."), "Forbidden Jakarta import in " + file.getFileName());
                assertFalse(content.contains("import io.vertx."), "Forbidden Vert.x import in " + file.getFileName());
                assertFalse(content.contains("import com.fasterxml.jackson."), "Forbidden Jackson import in " + file.getFileName());
            }
        }
    }

    @Test
    void allRepositoryQueriesContainExplicitWhereClauseOrApprovedRetentionScan() throws IOException {
        Path pgDir = Path.of("src/main/java/dev/flowtrace/adapter/out/pg");
        assertTrue(Files.isDirectory(pgDir), "Expected pg adapter directory at " + pgDir.toAbsolutePath());

        try (Stream<Path> files = Files.walk(pgDir)) {
            List<Path> repoFiles = files.filter(p -> p.toString().endsWith("Repository.java")).toList();
            assertEquals(7, repoFiles.size(), "Expected 7 JDBC repositories");

            for (Path repoFile : repoFiles) {
                String source = Files.readString(repoFile);
                Matcher matcher = SQL_DML_PATTERN.matcher(source);
                int checkedCount = 0;
                while (matcher.find()) {
                    String snippet = matcher.group();
                    String normalized = snippet.replaceAll("\\s+", " ").trim().toUpperCase();
                    if (normalized.equals("SELECT ID, RETENTION_DAYS FROM PROJECTS")) {
                        // Background retention job iterating per-project retention window
                        checkedCount++;
                        continue;
                    }
                    assertTrue(
                            normalized.contains("WHERE"),
                            "Unscoped SQL statement without WHERE clause in " + repoFile.getFileName() + ": " + normalized
                    );
                    checkedCount++;
                }
                assertTrue(checkedCount > 0, "Expected SQL statements to be inspected in " + repoFile.getFileName());
            }
        }
    }

    @Test
    void invitationTokenCryptoStoresOnlySha256HashAndPrefix() {
        ApiKeyCrypto.GeneratedKey gen = ApiKeyCrypto.generateInvitationToken();
        assertTrue(gen.fullKey().startsWith("ft_inv_"));
        assertEquals(39, gen.fullKey().length());
        assertEquals(14, gen.keyPrefix().length());
        assertEquals(ApiKeyCrypto.sha256Hex(gen.fullKey()), gen.keyHash());
        assertNotEquals(gen.fullKey(), gen.keyHash());
    }
}
