package dev.flowtrace;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.adapter.in.tcp.TcpIngestServer;
import dev.flowtrace.adapter.in.udp.UdpIngestServer;
import dev.flowtrace.application.ProjectService;
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
 * trace persistence, and multi-tenant isolation (spec section 16).
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
