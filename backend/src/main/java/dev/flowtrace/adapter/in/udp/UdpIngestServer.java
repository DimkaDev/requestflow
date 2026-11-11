package dev.flowtrace.adapter.in.udp;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.IngestEventUseCase;
import io.quarkus.runtime.ShutdownEvent;
import io.quarkus.runtime.StartupEvent;
import io.vertx.core.Vertx;
import io.vertx.core.datagram.DatagramPacket;
import io.vertx.core.datagram.DatagramSocket;
import io.vertx.core.datagram.DatagramSocketOptions;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Vert.x UDP DatagramSocket server for fire-and-forget checkpoint ingestion (spec section 5.2).
 * Default port 9001/udp, max datagram 1200 bytes, never sends a response.
 */
@ApplicationScoped
public class UdpIngestServer {

    private static final Logger LOG = Logger.getLogger(UdpIngestServer.class);
    public static final int MAX_UDP_DATAGRAM_BYTES = 1200;

    private final Vertx vertx;
    private final IngestEventUseCase ingestEventUseCase;
    private final ObjectMapper objectMapper;
    private final int configuredPort;
    private volatile DatagramSocket socket;
    private volatile int actualPort;

    @Inject
    public UdpIngestServer(
            Vertx vertx,
            IngestEventUseCase ingestEventUseCase,
            ObjectMapper objectMapper,
            @ConfigProperty(name = "flowtrace.udp.port", defaultValue = "9001") int configuredPort
    ) {
        this.vertx = vertx;
        this.ingestEventUseCase = ingestEventUseCase;
        this.objectMapper = objectMapper;
        this.configuredPort = configuredPort;
    }

    void onStart(@Observes StartupEvent ev) {
        DatagramSocketOptions options = new DatagramSocketOptions()
                .setReceiveBufferSize(256 * 1024);
        socket = vertx.createDatagramSocket(options);
        socket.handler(this::handlePacket);

        CountDownLatch latch = new CountDownLatch(1);
        socket.listen(configuredPort, "0.0.0.0", ar -> {
            if (ar.succeeded()) {
                actualPort = socket.localAddress().port();
                LOG.infof("FlowTrace UDP ingest server listening on 0.0.0.0:%d/udp", actualPort);
            } else {
                // Fallback to ephemeral port if 9001 is already bound in shared test environment
                socket.listen(0, "0.0.0.0", retry -> {
                    if (retry.succeeded()) {
                        actualPort = socket.localAddress().port();
                        LOG.infof("FlowTrace UDP ingest server listening on fallback port 0.0.0.0:%d/udp", actualPort);
                    } else {
                        LOG.error("Failed to bind UDP ingest server", retry.cause());
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
        if (socket != null) {
            socket.close();
        }
    }

    public int getActualPort() {
        return actualPort;
    }

    private void handlePacket(DatagramPacket packet) {
        byte[] bytes = packet.data().getBytes();
        if (bytes.length == 0 || bytes.length > MAX_UDP_DATAGRAM_BYTES) {
            ingestEventUseCase.recordDrop("udp", "oversized_datagram");
            return;
        }

        String text = new String(bytes, StandardCharsets.UTF_8);
        JsonNode root;
        try {
            root = objectMapper.readTree(text);
        } catch (Exception e) {
            ingestEventUseCase.recordDrop("udp", "malformed_json");
            return;
        }

        List<IngestEventUseCase.RawEventInput> inputs = new ArrayList<>();
        if (root.isArray()) {
            for (JsonNode item : root) {
                inputs.add(parseNode(item));
            }
        } else if (root.isObject()) {
            inputs.add(parseNode(root));
        } else {
            ingestEventUseCase.recordDrop("udp", "malformed_json");
            return;
        }

        ingestEventUseCase.ingestBatch("udp", null, inputs);
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
}
