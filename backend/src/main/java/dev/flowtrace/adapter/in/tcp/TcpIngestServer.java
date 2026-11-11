package dev.flowtrace.adapter.in.tcp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.IngestEventUseCase;
import dev.flowtrace.domain.ApiKey;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.vertx.core.Vertx;
import io.vertx.core.buffer.Buffer;
import io.vertx.core.net.NetServer;
import io.vertx.core.net.NetServerOptions;
import io.vertx.core.net.NetSocket;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Vert.x NetServer for TCP newline-delimited JSON checkpoint ingestion (spec section 5.3).
 * Supports optional `{"type":"hello","key":"...","ack":true}` handshake, per-seq ACK/NACK,
 * 60s idle timeout, max line 8 KB, max 100 connections per API key, default port 9000/tcp.
 */
@ApplicationScoped
public class TcpIngestServer {

    private static final Logger LOG = Logger.getLogger(TcpIngestServer.class);
    public static final int MAX_LINE_BYTES = 8192;
    public static final int MAX_EVENT_BYTES = 4096;
    public static final int MAX_CONNS_PER_KEY = 100;

    private final Vertx vertx;
    private final IngestEventUseCase ingestEventUseCase;
    private final ObjectMapper objectMapper;
    private final int configuredPort;
    private final int idleTimeoutSeconds;
    private final Map<String, AtomicInteger> connectionsPerKey = new ConcurrentHashMap<>();
    private volatile NetServer server;
    private volatile int actualPort;

    @Inject
    public TcpIngestServer(
            Vertx vertx,
            IngestEventUseCase ingestEventUseCase,
            ObjectMapper objectMapper,
            @ConfigProperty(name = "flowtrace.tcp.port", defaultValue = "9000") int configuredPort,
            @ConfigProperty(name = "flowtrace.tcp.idle-timeout-seconds", defaultValue = "60") int idleTimeoutSeconds
    ) {
        this.vertx = vertx;
        this.ingestEventUseCase = ingestEventUseCase;
        this.objectMapper = objectMapper;
        this.configuredPort = configuredPort;
        this.idleTimeoutSeconds = idleTimeoutSeconds;
    }

    void onStart(@Observes StartupEvent ev) {
        NetServerOptions options = new NetServerOptions()
                .setIdleTimeout(idleTimeoutSeconds)
                .setIdleTimeoutUnit(TimeUnit.SECONDS)
                .setTcpNoDelay(true);

        server = vertx.createNetServer(options);
        server.connectHandler(this::handleConnection);

        CountDownLatch latch = new CountDownLatch(1);
        server.listen(configuredPort, "0.0.0.0", ar -> {
            if (ar.succeeded()) {
                actualPort = server.actualPort();
                LOG.infof("FlowTrace TCP ingest server listening on 0.0.0.0:%d/tcp", actualPort);
            } else {
                server.listen(0, "0.0.0.0", retry -> {
                    if (retry.succeeded()) {
                        actualPort = server.actualPort();
                        LOG.infof("FlowTrace TCP ingest server listening on fallback port 0.0.0.0:%d/tcp", actualPort);
                    } else {
                        LOG.error("Failed to bind TCP ingest server", retry.cause());
                    }
                    latch.countDown();
                });
                return;
            }
            latch.countDown();
        });
        try {
            latch.await(5, TimeUnit.SECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    void onStop(@Observes ShutdownEvent ev) {
        if (server != null) {
            server.close();
        }
    }

    public int getActualPort() {
        return actualPort;
    }

    private void handleConnection(NetSocket socket) {
        final class ConnState {
            String authenticatedKeyRaw;
            String authenticatedKeyId;
            boolean ackEnabled;
            Buffer lineBuffer = Buffer.buffer();
            boolean firstMessage = true;
        }
        ConnState state = new ConnState();

        socket.closeHandler(v -> {
            if (state.authenticatedKeyId != null) {
                AtomicInteger count = connectionsPerKey.get(state.authenticatedKeyId);
                if (count != null) {
                    count.decrementAndGet();
                }
            }
        });

        socket.handler(chunk -> {
            state.lineBuffer.appendBuffer(chunk);
            while (true) {
                int newlineIdx = indexOfNewline(state.lineBuffer);
                if (newlineIdx < 0) {
                    if (state.lineBuffer.length() > MAX_LINE_BYTES) {
                        ingestEventUseCase.recordDrop("tcp", "line_too_long");
                        if (state.ackEnabled) {
                            writeJsonLine(socket, Map.of("nack", -1, "reason", "line exceeds 8KB limit"));
                        }
                        socket.close();
                    }
                    break;
                }

                byte[] lineBytes = state.lineBuffer.getBytes(0, newlineIdx);
                state.lineBuffer = state.lineBuffer.getBuffer(newlineIdx + 1, state.lineBuffer.length());

                if (lineBytes.length > MAX_LINE_BYTES) {
                    ingestEventUseCase.recordDrop("tcp", "line_too_long");
                    if (state.ackEnabled) {
                        writeJsonLine(socket, Map.of("nack", -1, "reason", "line exceeds 8KB limit"));
                    }
                    continue;
                }

                String line = new String(lineBytes, StandardCharsets.UTF_8).trim();
                if (line.isEmpty()) {
                    continue;
                }

                processLine(socket, state.firstMessage, line, state);
                state.firstMessage = false;
            }
        });
    }

    private <S> void processLine(NetSocket socket, boolean isFirst, String line, S rawState) {
        // Use reflection-free helper method by extracting inner fields
        try {
            var stateClass = rawState.getClass();
            var keyRawField = stateClass.getDeclaredField("authenticatedKeyRaw");
            var keyIdField = stateClass.getDeclaredField("authenticatedKeyId");
            var ackField = stateClass.getDeclaredField("ackEnabled");
            keyRawField.setAccessible(true);
            keyIdField.setAccessible(true);
            ackField.setAccessible(true);

            boolean ackEnabled = (boolean) ackField.get(rawState);
            String authenticatedKeyRaw = (String) keyRawField.get(rawState);

            JsonNode root;
            try {
                root = objectMapper.readTree(line);
            } catch (Exception e) {
                ingestEventUseCase.recordDrop("tcp", "malformed_json");
                if (ackEnabled) {
                    writeJsonLine(socket, Map.of("nack", -1, "reason", "malformed JSON"));
                }
                return;
            }

            // Check for hello handshake on first message
            if (isFirst && root.isObject() && root.hasNonNull("type")
                    && "hello".equalsIgnoreCase(root.get("type").asText())
                    && !root.has("traceId")) {
                String helloKey = root.hasNonNull("key") ? root.get("key").asText() : null;
                boolean reqAck = root.hasNonNull("ack") && root.get("ack").asBoolean(false);
                Optional<ApiKey> verified = ingestEventUseCase.authenticateKey(helloKey);
                if (verified.isEmpty()) {
                    ingestEventUseCase.recordDrop("tcp", "unauthorized");
                    writeJsonLine(socket, Map.of("type", "error", "reason", "invalid API key"));
                    socket.close();
                    return;
                }
                String keyId = verified.get().id().toString();
                AtomicInteger activeConns = connectionsPerKey.computeIfAbsent(keyId, k -> new AtomicInteger(0));
                if (activeConns.incrementAndGet() > MAX_CONNS_PER_KEY) {
                    activeConns.decrementAndGet();
                    ingestEventUseCase.recordDrop("tcp", "max_connections");
                    writeJsonLine(socket, Map.of("type", "error", "reason", "max connections per key exceeded"));
                    socket.close();
                    return;
                }
                keyRawField.set(rawState, helloKey);
                keyIdField.set(rawState, keyId);
                ackField.set(rawState, reqAck);
                writeJsonLine(socket, Map.of("type", "hello_ok"));
                return;
            }

            List<IngestEventUseCase.RawEventInput> inputs = new ArrayList<>();
            List<Long> inputSeqs = new ArrayList<>();

            if (root.isArray()) {
                for (JsonNode item : root) {
                    if (item.toString().getBytes(StandardCharsets.UTF_8).length > MAX_EVENT_BYTES) {
                        ingestEventUseCase.recordDrop("tcp", "event_too_large");
                        Long seq = item.hasNonNull("seq") && item.get("seq").isNumber() ? item.get("seq").asLong() : null;
                        if (ackEnabled && seq != null) {
                            writeJsonLine(socket, Map.of("nack", seq, "reason", "event exceeds 4KB limit"));
                        }
                        continue;
                    }
                    IngestEventUseCase.RawEventInput parsed = parseNode(item);
                    inputs.add(parsed);
                    inputSeqs.add(parsed.seq());
                }
            } else if (root.isObject()) {
                if (line.getBytes(StandardCharsets.UTF_8).length > MAX_EVENT_BYTES) {
                    ingestEventUseCase.recordDrop("tcp", "event_too_large");
                    Long seq = root.hasNonNull("seq") && root.get("seq").isNumber() ? root.get("seq").asLong() : -1L;
                    if (ackEnabled) {
                        writeJsonLine(socket, Map.of("nack", seq, "reason", "event exceeds 4KB limit"));
                    }
                    return;
                }
                IngestEventUseCase.RawEventInput parsed = parseNode(root);
                inputs.add(parsed);
                inputSeqs.add(parsed.seq());
            } else {
                ingestEventUseCase.recordDrop("tcp", "malformed_json");
                return;
            }

            if (inputs.isEmpty()) {
                return;
            }

            IngestEventUseCase.BatchIngestResult result = ingestEventUseCase.ingestBatch("tcp", authenticatedKeyRaw, inputs);
            if (ackEnabled) {
                for (Long ackSeq : result.ackSeqs()) {
                    writeJsonLine(socket, Map.of("ack", ackSeq));
                }
                for (IngestEventUseCase.RejectedItem rej : result.rejected()) {
                    Long seq = (rej.index() >= 0 && rej.index() < inputSeqs.size()) ? inputSeqs.get(rej.index()) : null;
                    writeJsonLine(socket, Map.of("nack", seq != null ? seq : -1L, "reason", rej.reason()));
                }
            }
        } catch (Exception ignored) {
        }
    }

    private IngestEventUseCase.RawEventInput parseNode(JsonNode node) {
        Integer v = node.hasNonNull("v") && node.get("v").isNumber() ? node.get("v").asInt() : null;
        String key = node.hasNonNull("key") ? node.get("key").asText() : null;
        String traceId = node.hasNonNull("traceId") ? node.get("traceId").asText() : null;
        String targetNode = node.hasNonNull("node") ? node.get("node").asText() : null;
        String from = node.hasNonNull("from") ? node.get("from").asText() : null;
        String type = node.hasNonNull("type") ? node.get("type").asText() : null;
        String branch = node.hasNonNull("branch") ? node.get("branch").asText() : null;
        Long ts = node.hasNonNull("ts") && node.get("ts").isNumber() ? node.get("ts").asLong() : null;
        String label = node.hasNonNull("label") ? node.get("label").asText() : null;
        Long seq = node.hasNonNull("seq") && node.get("seq").isNumber() ? node.get("seq").asLong() : null;
        Map<String, Object> attrs = null;
        if (node.hasNonNull("attrs") && node.get("attrs").isObject()) {
            attrs = objectMapper.convertValue(node.get("attrs"), new TypeReference<>() {
            });
        }

        dev.flowtrace.domain.EntityInfo entity = null;
        if (node.hasNonNull("entity") && node.get("entity").isObject()) {
            JsonNode en = node.get("entity");
            String kind = en.hasNonNull("kind") ? en.get("kind").asText() : null;
            String ref = en.hasNonNull("ref") ? en.get("ref").asText() : null;
            String elabel = en.hasNonNull("label") ? en.get("label").asText() : null;
            String avatar = en.hasNonNull("avatar") ? en.get("avatar").asText() : null;
            entity = new dev.flowtrace.domain.EntityInfo(kind, ref, elabel, avatar);
        }

        dev.flowtrace.domain.CarryPayload carry = null;
        if (node.hasNonNull("carry") && node.get("carry").isObject()) {
            JsonNode cn = node.get("carry");
            dev.flowtrace.domain.CarryOp op = cn.hasNonNull("op")
                    ? dev.flowtrace.domain.CarryOp.fromString(cn.get("op").asText())
                    : null;
            List<dev.flowtrace.domain.CarryItem> items = new ArrayList<>();
            if (cn.hasNonNull("items") && cn.get("items").isArray()) {
                for (JsonNode in : cn.get("items")) {
                    String sku = in.hasNonNull("sku") ? in.get("sku").asText() : null;
                    String ilabel = in.hasNonNull("label") ? in.get("label").asText() : null;
                    String icon = in.hasNonNull("icon") ? in.get("icon").asText() : null;
                    String image = in.hasNonNull("image") ? in.get("image").asText() : null;
                    int qty = in.hasNonNull("qty") && in.get("qty").isNumber() ? in.get("qty").asInt() : 1;
                    double price = in.hasNonNull("price") && in.get("price").isNumber() ? in.get("price").asDouble() : 0.0;
                    String currency = in.hasNonNull("currency") ? in.get("currency").asText() : "EUR";
                    items.add(new dev.flowtrace.domain.CarryItem(sku, ilabel, icon, image, qty, price, currency));
                }
            }
            carry = new dev.flowtrace.domain.CarryPayload(op, items);
        }

        return new IngestEventUseCase.RawEventInput(v, key, traceId, targetNode, from, type, branch, ts, label, attrs, seq, entity, carry);
    }

    private void writeJsonLine(NetSocket socket, Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload) + "\n";
            socket.write(Buffer.buffer(json, "UTF-8"));
        } catch (Exception ignored) {
        }
    }

    private static int indexOfNewline(Buffer buffer) {
        int len = buffer.length();
        for (int i = 0; i < len; i++) {
            if (buffer.getByte(i) == (byte) '\n') {
                return i;
            }
        }
        return -1;
    }
}
