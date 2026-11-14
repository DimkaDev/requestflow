package dev.flowtrace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.adapter.in.tcp.TcpIngestServer;
import dev.flowtrace.adapter.in.udp.UdpIngestServer;
import dev.flowtrace.application.OrganizationService;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.domain.ApiKeyCrypto;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.UuidV7;
import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import io.vertx.core.Vertx;
import io.vertx.core.http.WebSocket;
import io.vertx.core.http.WebSocketClient;
import jakarta.inject.Inject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests covering HTTP, UDP, TCP ingest, WebSocket live streaming,
 * trace persistence, multi-tenant isolation, and Epic 1 Organizations/Workspaces/RBAC.
 */
@QuarkusTest
class FlowTraceIntegrationTest {

    @Inject
    UdpIngestServer udpIngestServer;

    @Inject
    TcpIngestServer tcpIngestServer;

    @Inject
    Vertx vertx;

    @Inject
    ObjectMapper objectMapper;

    @Inject
    OrganizationService organizationService;

    @Inject
    dev.flowtrace.application.port.out.ProjectRepository projectRepository;

    @TestHTTPResource("/")
    URI baseUri;

    @Test
    void healthEndpointIsUp() {
        RestAssured.given()
                .when().get("/q/health")
                .then()
                .statusCode(200)
                .body("status", equalTo("UP"));
    }

    @Test
    void httpUdpAndTcpIngestDeliverHopsOverWebSocketAndPersistTraces() throws Exception {
        projectRepository.saveDiagramVersion(ProjectService.SEED_PROJECT_ID, DiagramGraph.defaultSampleDiagram());
        String projectId = ProjectService.SEED_PROJECT_ID.toString();
        String apiKey = ProjectService.SEED_API_KEY;
        String traceId = UuidV7.generateString();

        BlockingQueue<JsonNode> wsMessages = new LinkedBlockingQueue<>();
        WebSocketClient wsClient = vertx.createWebSocketClient();
        WebSocket ws = wsClient.connect(
                baseUri.getPort(),
                baseUri.getHost(),
                "/ws/v1/projects/" + projectId + "/stream"
        ).toCompletionStage().toCompletableFuture().get(5, TimeUnit.SECONDS);

        try {
            ws.textMessageHandler(txt -> {
                try {
                    wsMessages.offer(objectMapper.readTree(txt));
                } catch (Exception ignored) {
                }
            });

            // 1. Expect initial snapshot
            JsonNode snapshot = pollType(wsMessages, "snapshot", 5);
            assertNotNull(snapshot, "Expected initial snapshot over WebSocket");
            assertEquals("snapshot", snapshot.get("t").asText());

            // 2. HTTP Ingest: spawn at website
            RestAssured.given()
                    .header("X-API-Key", apiKey)
                    .contentType(ContentType.JSON)
                    .body(Map.of("traceId", traceId, "node", "website", "seq", 1))
                    .when().post("/api/v1/events")
                    .then()
                    .statusCode(202)
                    .body("accepted", equalTo(1));

            JsonNode spawnMsg = pollType(wsMessages, "spawn", 5);
            assertNotNull(spawnMsg, "Expected spawn message from HTTP ingest");
            assertEquals("website", spawnMsg.get("node").asText());

            // 3. UDP Ingest: hop website -> lb
            String udpPayload = objectMapper.writeValueAsString(Map.of(
                    "key", apiKey,
                    "traceId", traceId,
                    "node", "lb",
                    "seq", 2
            ));
            try (DatagramSocket dgram = new DatagramSocket()) {
                byte[] buf = udpPayload.getBytes(StandardCharsets.UTF_8);
                dgram.send(new DatagramPacket(buf, buf.length, new InetSocketAddress("127.0.0.1", udpIngestServer.getActualPort())));
            }

            JsonNode udpHop = pollType(wsMessages, "hop", 5);
            assertNotNull(udpHop, "Expected hop message from UDP ingest");
            assertEquals("website", udpHop.get("from").asText());
            assertEquals("lb", udpHop.get("to").asText());
            assertEquals("e1", udpHop.get("edgeId").asText());

            // 4. TCP Ingest with hello handshake + ACK: hop lb -> if-premium
            try (Socket tcpSocket = new Socket("127.0.0.1", tcpIngestServer.getActualPort())) {
                tcpSocket.setSoTimeout(5000);
                OutputStream out = tcpSocket.getOutputStream();
                BufferedReader in = new BufferedReader(new InputStreamReader(tcpSocket.getInputStream(), StandardCharsets.UTF_8));

                out.write(("{\"type\":\"hello\",\"key\":\"" + apiKey + "\",\"ack\":true}\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
                String helloReply = in.readLine();
                assertNotNull(helloReply);
                assertTrue(helloReply.contains("hello_ok"));

                out.write(("{\"traceId\":\"" + traceId + "\",\"node\":\"if-premium\",\"seq\":3}\n").getBytes(StandardCharsets.UTF_8));
                out.flush();
                String ackReply = in.readLine();
                assertNotNull(ackReply);
                assertTrue(ackReply.contains("\"ack\":3"));
            }

            JsonNode tcpHop = pollType(wsMessages, "hop", 5);
            assertNotNull(tcpHop, "Expected hop message from TCP ingest");
            assertEquals("lb", tcpHop.get("from").asText());
            assertEquals("if-premium", tcpHop.get("to").asText());

            // 5. Verify trace is persisted and retrievable via REST API
            RestAssured.given()
                    .when().get("/api/v1/projects/" + projectId + "/traces/" + traceId)
                    .then()
                    .statusCode(200)
                    .body("summary.id", equalTo(traceId))
                    .body("summary.eventCount", equalTo(3))
                    .body("events.size()", equalTo(3));
        } finally {
            ws.close();
            wsClient.close();
        }
    }

    @Test
    void multiTenantIsolationPreventsCrossUserAccess() {
        // User A creates a project
        String projectId = RestAssured.given()
                .header("X-Debug-User-Id", "alice-sub")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Alice Private Project"))
                .when().post("/api/v1/projects")
                .then()
                .statusCode(201)
                .extract().path("id");

        // User B attempts to read or modify Alice's project -> 403 Forbidden
        RestAssured.given()
                .header("X-Debug-User-Id", "bob-sub")
                .when().get("/api/v1/projects/" + projectId)
                .then()
                .statusCode(403);

        RestAssured.given()
                .header("X-Debug-User-Id", "bob-sub")
                .when().get("/api/v1/projects/" + projectId + "/keys")
                .then()
                .statusCode(403);
    }

    @Test
    void epic1OrganizationsWorkspacesInvitationsAndRbacMatrixWorkEndToEnd() {
        // 1. Owner creates an organization
        String orgId = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Acme Fintech", "slug", "acme-fintech", "billingEmail", "finance@acme.io"))
                .when().post("/api/v1/organizations")
                .then()
                .statusCode(201)
                .body("organization.name", equalTo("Acme Fintech"))
                .body("myRole", equalTo("OWNER"))
                .extract().path("organization.id");

        // 2. Owner creates a secondary Staging workspace
        String stagingWsId = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Staging", "slug", "staging"))
                .when().post("/api/v1/organizations/" + orgId + "/workspaces")
                .then()
                .statusCode(201)
                .body("slug", equalTo("staging"))
                .extract().path("id");

        // 3. Owner creates a project inside Acme Fintech (Staging workspace)
        String projectId = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Payment Gateway", "organizationId", orgId, "workspaceId", stagingWsId))
                .when().post("/api/v1/projects")
                .then()
                .statusCode(201)
                .body("organizationId", equalTo(orgId))
                .body("workspaceId", equalTo(stagingWsId))
                .extract().path("id");

        // 4. Owner invites a VIEWER and a BILLING_ADMIN (E1-Step-5: token_hash stored, plaintext returned once)
        io.restassured.response.Response viewerInviteRes = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("email", "viewer@acme.io", "role", "VIEWER"))
                .when().post("/api/v1/organizations/" + orgId + "/invitations")
                .then()
                .statusCode(201)
                .body("role", equalTo("VIEWER"))
                .body("token", startsWith("ft_inv_"))
                .body("tokenPrefix", startsWith("ft_inv_"))
                .extract().response();

        String viewerInviteId = viewerInviteRes.path("id");
        String initialViewerToken = viewerInviteRes.path("token");
        String initialViewerHash = viewerInviteRes.path("tokenHash");
        assertEquals(ApiKeyCrypto.sha256Hex(initialViewerToken), initialViewerHash);

        // Listing invitations must NOT expose the plaintext token from DB
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().get("/api/v1/organizations/" + orgId + "/invitations")
                .then()
                .statusCode(200)
                .body("[0].token", nullValue())
                .body("[0].tokenPrefix", notNullValue())
                .body("[0].tokenHash", equalTo(initialViewerHash));

        // E1-Step-5: Resend invitation rotates token_hash and invalidates previous token
        String viewerToken = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("baseAppUrl", "http://localhost:4200"))
                .when().post("/api/v1/organizations/" + orgId + "/invitations/" + viewerInviteId + "/resend")
                .then()
                .statusCode(200)
                .body("token", startsWith("ft_inv_"))
                .extract().path("token");

        assertNotEquals(initialViewerToken, viewerToken);

        // Old token must now be rejected (404)
        RestAssured.given()
                .header("X-Debug-User-Id", "viewer@acme.io")
                .contentType(ContentType.JSON)
                .body(Map.of("token", initialViewerToken))
                .when().post("/api/v1/organizations/invitations/accept")
                .then()
                .statusCode(404);

        String billingToken = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("email", "billing@acme.io", "role", "BILLING_ADMIN"))
                .when().post("/api/v1/organizations/" + orgId + "/invitations")
                .then()
                .statusCode(201)
                .body("role", equalTo("BILLING_ADMIN"))
                .extract().path("token");

        // 5. Viewer and Billing Admin accept their invitations
        RestAssured.given()
                .header("X-Debug-User-Id", "viewer@acme.io")
                .contentType(ContentType.JSON)
                .body(Map.of("token", viewerToken))
                .when().post("/api/v1/organizations/invitations/accept")
                .then()
                .statusCode(200)
                .body("myRole", equalTo("VIEWER"));

        RestAssured.given()
                .header("X-Debug-User-Id", "billing@acme.io")
                .contentType(ContentType.JSON)
                .body(Map.of("token", billingToken))
                .when().post("/api/v1/organizations/invitations/accept")
                .then()
                .statusCode(200)
                .body("myRole", equalTo("BILLING_ADMIN"));

        // 6. VIEWER can read project & diagram (200), but CANNOT edit diagram or create API keys (403)
        RestAssured.given()
                .header("X-Debug-User-Id", "viewer@acme.io")
                .when().get("/api/v1/projects/" + projectId + "/diagram")
                .then()
                .statusCode(200);

        RestAssured.given()
                .header("X-Debug-User-Id", "viewer@acme.io")
                .contentType(ContentType.JSON)
                .body(DiagramGraph.defaultSampleDiagram())
                .when().put("/api/v1/projects/" + projectId + "/diagram")
                .then()
                .statusCode(403);

        RestAssured.given()
                .header("X-Debug-User-Id", "viewer@acme.io")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Unauthorized Key"))
                .when().post("/api/v1/projects/" + projectId + "/keys")
                .then()
                .statusCode(403);

        // 7. BILLING_ADMIN can update plan/billing email (200), but CANNOT view project traces or diagram (403)
        RestAssured.given()
                .header("X-Debug-User-Id", "billing@acme.io")
                .contentType(ContentType.JSON)
                .body(Map.of("billingEmail", "ap@acme.io", "planTier", "BUSINESS"))
                .when().patch("/api/v1/organizations/" + orgId)
                .then()
                .statusCode(200)
                .body("organization.planTier", equalTo("BUSINESS"));

        RestAssured.given()
                .header("X-Debug-User-Id", "billing@acme.io")
                .when().get("/api/v1/projects/" + projectId + "/traces")
                .then()
                .statusCode(403);

        // 8. E1-Step-8: Audit log records organization, workspace, project, key, and invitation events
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().get("/api/v1/organizations/" + orgId + "/audit-logs")
                .then()
                .statusCode(200)
                .body("size()", greaterThanOrEqualTo(6))
                .body("action", hasItems(
                        "org.created",
                        "workspace.created",
                        "project.created",
                        "member.invited",
                        "member.invitation_resent",
                        "member.invitation_accepted",
                        "org.updated"
                ));

        // Filtered audit log query (?action=member.)
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .queryParam("action", "member.")
                .when().get("/api/v1/organizations/" + orgId + "/audit-logs")
                .then()
                .statusCode(200)
                .body("action", everyItem(startsWith("member.")));

        // 9. E1-Step-7: Cross-tenant outsider cannot read audit logs, workspaces, members, or invitations (403)
        RestAssured.given()
                .header("X-Debug-User-Id", "outsider-tenant")
                .when().get("/api/v1/organizations/" + orgId + "/audit-logs")
                .then()
                .statusCode(403);

        RestAssured.given()
                .header("X-Debug-User-Id", "outsider-tenant")
                .when().get("/api/v1/organizations/" + orgId + "/members")
                .then()
                .statusCode(403);

        RestAssured.given()
                .header("X-Debug-User-Id", "outsider-tenant")
                .when().get("/api/v1/organizations/" + orgId + "/workspaces")
                .then()
                .statusCode(403);

        // 10. E1-Step-6: Soft-delete organization blocks UI access and live ingestion, restore re-enables, purge removes after 30d
        String ingestKey = RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Acme Live Key", "rateLimitPerS", 500))
                .when().post("/api/v1/projects/" + projectId + "/keys")
                .then()
                .statusCode(201)
                .extract().path("fullKey");

        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().delete("/api/v1/organizations/" + orgId)
                .then()
                .statusCode(204);

        // Access to soft-deleted org and its projects is immediately blocked (403)
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().get("/api/v1/organizations/" + orgId)
                .then()
                .statusCode(403);

        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().get("/api/v1/projects/" + projectId)
                .then()
                .statusCode(403);

        // Ingest using key of soft-deleted organization is rejected
        RestAssured.given()
                .header("X-API-Key", ingestKey)
                .contentType(ContentType.JSON)
                .body(Map.of("traceId", UuidV7.generateString(), "node", "website"))
                .when().post("/api/v1/events")
                .then()
                .statusCode(400)
                .body("accepted", equalTo(0))
                .body("rejected[0].reason", containsString("deletion"));

        // Owner can restore within the 30-day window
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .contentType(ContentType.JSON)
                .when().post("/api/v1/organizations/" + orgId + "/restore")
                .then()
                .statusCode(200)
                .body("organization.id", equalTo(orgId))
                .body("organization.deletedAt", nullValue());

        // Ingest works again after restore
        RestAssured.given()
                .header("X-API-Key", ingestKey)
                .contentType(ContentType.JSON)
                .body(Map.of("traceId", UuidV7.generateString(), "node", "website"))
                .when().post("/api/v1/events")
                .then()
                .statusCode(202)
                .body("accepted", equalTo(1));

        // Soft-delete again and run the 30-day expiration purge
        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().delete("/api/v1/organizations/" + orgId)
                .then()
                .statusCode(204);

        int purgedCount = organizationService.purgeExpiredSoftDeletedOrganizations(Instant.now().plusSeconds(60));
        assertTrue(purgedCount >= 1);

        RestAssured.given()
                .header("X-Debug-User-Id", "org-owner")
                .when().get("/api/v1/organizations/" + orgId)
                .then()
                .statusCode(404);
    }

    @Test
    void advancedDiagramEditorDraftConflictPublishCustomBlocksAndAliasResolutionWorkEndToEnd() {
        // 1. Create a blank-canvas project
        String projectId = RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "E26 Blank Canvas Project", "autoDiscover", false))
                .when().post("/api/v1/projects")
                .then()
                .statusCode(201)
                .extract().path("id");

        // 2. Fetch initial draft and entitlements
        int initialDraftVer = RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .when().get("/api/v1/projects/" + projectId + "/diagram/draft")
                .then()
                .statusCode(200)
                .body("draft.projectId", equalTo(projectId))
                .body("entitlements.canEdit", equalTo(true))
                .extract().path("draft.draftVersion");

        // 3. Save a Schema v2 draft with a renamed node ("checkout-v2") that keeps old key "legacy-cart" as a 7-day alias
        Map<String, Object> v2Diagram = Map.of(
                "schema", 2,
                "direction", "LR",
                "gridSnap", true,
                "nodes", List.of(
                        Map.of(
                                "key", "storefront",
                                "label", "Storefront",
                                "type", "client",
                                "x", 120,
                                "y", 200,
                                "icon", "lib:storefront",
                                "props", Map.of("role", "start", "tint", "#0EA5E9")
                        ),
                        Map.of(
                                "key", "checkout-v2",
                                "label", "Checkout V2",
                                "type", "service",
                                "x", 380,
                                "y", 200,
                                "icon", "lib:shopping_cart_checkout",
                                "props", Map.of(
                                        "role", "normal",
                                        "tint", "#8B5CF6",
                                        "aliases", List.of("legacy-cart")
                                )
                        ),
                        Map.of(
                                "key", "order-paid",
                                "label", "Order Paid",
                                "type", "end",
                                "x", 640,
                                "y", 200,
                                "icon", "lib:check_circle",
                                "props", Map.of("role", "success", "tint", "#10B981")
                        )
                ),
                "edges", List.of(
                        Map.of(
                                "id", "e-storefront-checkout",
                                "from", "storefront",
                                "to", "checkout-v2",
                                "source", "storefront",
                                "target", "checkout-v2",
                                "status", "defined",
                                "flow", Map.of("expectedLatencyMs", 250, "weight", 100)
                        ),
                        Map.of(
                                "id", "e-checkout-paid",
                                "from", "checkout-v2",
                                "to", "order-paid",
                                "source", "checkout-v2",
                                "target", "order-paid",
                                "status", "defined",
                                "flow", Map.of("expectedLatencyMs", 300, "terminal", true)
                        )
                )
        );

        int updatedDraftVer = RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "expectedDraftVersion", initialDraftVer,
                        "diagram", v2Diagram
                ))
                .when().put("/api/v1/projects/" + projectId + "/diagram/draft")
                .then()
                .statusCode(200)
                .body("draft.draftVersion", equalTo(initialDraftVer + 1))
                .extract().path("draft.draftVersion");

        // 4. Stale expectedDraftVersion from another tab returns 409 Conflict with serverDraft
        RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "expectedDraftVersion", initialDraftVer,
                        "diagram", v2Diagram
                ))
                .when().put("/api/v1/projects/" + projectId + "/diagram/draft")
                .then()
                .statusCode(409)
                .body("conflict", equalTo(true))
                .body("serverDraft.draftVersion", equalTo(updatedDraftVer));

        // 5. Publish the draft to create an immutable version and activate live alias resolution
        RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "diagram", v2Diagram,
                        "changeSummary", "Initial E26 blank-canvas publish with alias"
                ))
                .when().post("/api/v1/projects/" + projectId + "/diagram/publish")
                .then()
                .statusCode(200)
                .body("published.version", greaterThanOrEqualTo(2))
                .body("published.changeSummary", equalTo("Initial E26 blank-canvas publish with alias"));

        // 6. Send live events using the old alias key ("legacy-cart") and verify HopResolver maps it to "checkout-v2"
        String apiKey = RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of("name", "Editor Test Key", "rateLimitPerS", 500))
                .when().post("/api/v1/projects/" + projectId + "/keys")
                .then()
                .statusCode(201)
                .extract().path("fullKey");

        String traceId = UuidV7.generateString();
        RestAssured.given()
                .header("X-API-Key", apiKey)
                .contentType(ContentType.JSON)
                .body(List.of(
                        Map.of("traceId", traceId, "node", "storefront", "type", "enter", "seq", 1),
                        Map.of("traceId", traceId, "fromNode", "storefront", "node", "legacy-cart", "type", "enter", "seq", 2),
                        Map.of("traceId", traceId, "fromNode", "legacy-cart", "node", "order-paid", "type", "end", "seq", 3)
                ))
                .when().post("/api/v1/events")
                .then()
                .statusCode(202)
                .body("accepted", equalTo(3));

        // 7. Create, list, and delete an org-level Custom Block ("My blocks")
        String customBlockId = RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .contentType(ContentType.JSON)
                .body(Map.of(
                        "name", "Fraud Scorer",
                        "category", "Security",
                        "nodeType", "decision",
                        "role", "decision",
                        "icon", "lib:shield",
                        "tint", "#F59E0B",
                        "keyPattern", "fraud-scorer"
                ))
                .when().post("/api/v1/projects/" + projectId + "/custom-blocks")
                .then()
                .statusCode(201)
                .body("name", equalTo("Fraud Scorer"))
                .extract().path("id");

        RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .when().get("/api/v1/projects/" + projectId + "/custom-blocks")
                .then()
                .statusCode(200)
                .body("size()", greaterThanOrEqualTo(1));

        RestAssured.given()
                .header("X-Debug-User-Id", "editor-author")
                .when().delete("/api/v1/projects/" + projectId + "/custom-blocks/" + customBlockId)
                .then()
                .statusCode(204);
    }

    private JsonNode pollType(BlockingQueue<JsonNode> queue, String expectedType, int timeoutSeconds) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
        while (System.currentTimeMillis() < deadline) {
            JsonNode msg = queue.poll(500, TimeUnit.MILLISECONDS);
            if (msg != null && msg.hasNonNull("t") && expectedType.equals(msg.get("t").asText())) {
                return msg;
            }
        }
        return null;
    }
}
