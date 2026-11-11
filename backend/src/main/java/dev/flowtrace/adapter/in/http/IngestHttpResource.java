package dev.flowtrace.adapter.in.http;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.IngestEventUseCase;
import dev.flowtrace.domain.UuidV7;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Path("/api/v1")
@ApplicationScoped
@Produces(MediaType.APPLICATION_JSON)
public class IngestHttpResource {

    public static final int MAX_HTTP_EVENT_BYTES = 4096;

    private final IngestEventUseCase ingestEventUseCase;
    private final ObjectMapper objectMapper;

    @Inject
    public IngestHttpResource(IngestEventUseCase ingestEventUseCase, ObjectMapper objectMapper) {
        this.ingestEventUseCase = ingestEventUseCase;
        this.objectMapper = objectMapper;
    }

    @POST
    @Path("/events")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response postEvents(
            @HeaderParam("X-API-Key") String apiKey,
            String rawBody
    ) {
        if (rawBody == null || rawBody.isBlank()) {
            ingestEventUseCase.recordDrop("http", "empty_body");
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "empty request body"))))
                    .build();
        }

        byte[] bodyBytes = rawBody.getBytes(StandardCharsets.UTF_8);
        if (bodyBytes.length > MAX_HTTP_EVENT_BYTES * 100) {
            ingestEventUseCase.recordDrop("http", "payload_too_large");
            return Response.status(413)
                    .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "payload exceeds max size"))))
                    .build();
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(rawBody);
        } catch (Exception e) {
            ingestEventUseCase.recordDrop("http", "malformed_json");
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "malformed JSON"))))
                    .build();
        }

        List<IngestEventUseCase.RawEventInput> inputs = new ArrayList<>();
        List<IngestEventUseCase.RejectedItem> preRejected = new ArrayList<>();

        if (root.isArray()) {
            if (root.size() > 100) {
                ingestEventUseCase.recordDrop("http", "batch_too_large");
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "max 100 events per request"))))
                        .build();
            }
            for (int i = 0; i < root.size(); i++) {
                JsonNode item = root.get(i);
                String serialized = item.toString();
                if (serialized.getBytes(StandardCharsets.UTF_8).length > MAX_HTTP_EVENT_BYTES) {
                    preRejected.add(new IngestEventUseCase.RejectedItem(i, "event exceeds 4KB limit"));
                    ingestEventUseCase.recordDrop("http", "event_too_large");
                    inputs.add(null);
                } else {
                    inputs.add(parseSingleNode(item));
                }
            }
        } else if (root.isObject()) {
            if (bodyBytes.length > MAX_HTTP_EVENT_BYTES) {
                ingestEventUseCase.recordDrop("http", "event_too_large");
                return Response.status(413)
                        .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "event exceeds 4KB limit"))))
                        .build();
            }
            inputs.add(parseSingleNode(root));
        } else {
            ingestEventUseCase.recordDrop("http", "malformed_json");
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("accepted", 0, "rejected", List.of(Map.of("index", 0, "reason", "expected JSON object or array"))))
                    .build();
        }

        IngestEventUseCase.BatchIngestResult result = ingestEventUseCase.ingestBatch("http", apiKey, inputs);

        // Merge pre-rejected size errors if any
        List<IngestEventUseCase.RejectedItem> finalRejected = new ArrayList<>();
        for (IngestEventUseCase.RejectedItem item : result.rejected()) {
            var override = preRejected.stream().filter(p -> p.index() == item.index()).findFirst();
            finalRejected.add(override.orElse(item));
        }

        if (result.accepted() == 0 && finalRejected.stream().anyMatch(r -> r.reason().contains("API key"))) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("accepted", 0, "rejected", finalRejected))
                    .build();
        }

        if (result.accepted() == 0 && !finalRejected.isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("accepted", 0, "rejected", finalRejected))
                    .build();
        }

        return Response.status(Response.Status.ACCEPTED)
                .entity(Map.of("accepted", result.accepted(), "rejected", finalRejected))
                .build();
    }

    @POST
    @Path("/traces")
    public Response createTrace(@HeaderParam("X-API-Key") String apiKey) {
        if (apiKey != null && !apiKey.isBlank() && ingestEventUseCase.authenticateKey(apiKey).isEmpty()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "invalid API key"))
                    .build();
        }
        return Response.status(Response.Status.CREATED)
                .entity(Map.of("traceId", UuidV7.generateString()))
                .build();
    }

    private IngestEventUseCase.RawEventInput parseSingleNode(JsonNode node) {
        try {
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
        } catch (Exception e) {
            return null;
        }
    }
}
