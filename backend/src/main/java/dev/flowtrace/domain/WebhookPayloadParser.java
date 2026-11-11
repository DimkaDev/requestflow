package dev.flowtrace.domain;

import java.util.*;

/**
 * Pure Java JSON field extractor for webhook payloads (E20-Step-2 / Gate G1-E).
 * Zero framework dependencies.
 */
public final class WebhookPayloadParser {

    private WebhookPayloadParser() {}

    @SuppressWarnings("unchecked")
    public static CheckpointEvent parse(
            String apiKey,
            Map<String, Object> rawJson,
            WebhookMapping mapping,
            long serverTs
    ) {
        String defaultNode = (mapping != null && mapping.defaultNode() != null && !mapping.defaultNode().isBlank())
                ? mapping.defaultNode()
                : "paid";

        String node = defaultNode;
        if (mapping != null && mapping.nodePath() != null) {
            Object nodeVal = extractPath(rawJson, mapping.nodePath());
            if (nodeVal != null && !nodeVal.toString().isBlank()) {
                node = nodeVal.toString().toLowerCase().trim();
            }
        }

        String traceId = null;
        if (mapping != null && mapping.traceIdPath() != null) {
            Object traceVal = extractPath(rawJson, mapping.traceIdPath());
            if (traceVal != null && !traceVal.toString().isBlank()) {
                String raw = traceVal.toString().trim();
                traceId = sanitizeTraceId(raw);
            }
        }
        if (traceId == null || traceId.isBlank()) {
            traceId = "0194f1c0-0000-7000-8000-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        }

        EntityInfo entity = null;
        if (mapping != null && (mapping.entityRefPath() != null || mapping.entityNamePath() != null)) {
            Object refVal = mapping.entityRefPath() != null ? extractPath(rawJson, mapping.entityRefPath()) : null;
            Object nameVal = mapping.entityNamePath() != null ? extractPath(rawJson, mapping.entityNamePath()) : null;
            Object avatarVal = mapping.avatarPath() != null ? extractPath(rawJson, mapping.avatarPath()) : null;

            String ref = refVal != null ? refVal.toString() : "anon_" + traceId.substring(traceId.length() - 6);
            String name = nameVal != null ? nameVal.toString() : "Customer";
            String avatar = avatarVal != null ? avatarVal.toString() : "shopper";
            entity = new EntityInfo("customer", ref, name, avatar);
        }

        CarryPayload carry = null;
        if (mapping != null && (mapping.amountPath() != null || mapping.itemsPath() != null)) {
            Double amount = null;
            if (mapping.amountPath() != null) {
                Object amtVal = extractPath(rawJson, mapping.amountPath());
                if (amtVal instanceof Number n) {
                    amount = n.doubleValue();
                } else if (amtVal != null) {
                    try {
                        amount = Double.parseDouble(amtVal.toString());
                    } catch (NumberFormatException ignored) {}
                }
            }

            String currency = "EUR";
            if (mapping.currencyPath() != null) {
                Object curVal = extractPath(rawJson, mapping.currencyPath());
                if (curVal != null && !curVal.toString().isBlank()) {
                    currency = curVal.toString().toUpperCase().trim();
                }
            }

            List<CarryItem> items = new ArrayList<>();
            if (mapping.itemsPath() != null) {
                Object itemsVal = extractPath(rawJson, mapping.itemsPath());
                if (itemsVal instanceof List<?> list) {
                    for (Object itemObj : list) {
                        if (itemObj instanceof Map<?, ?> itemMap) {
                            Object itemId = itemMap.get("id");
                            Object itemTitle = itemMap.get("title");
                            if (itemTitle == null) itemTitle = itemMap.get("name");
                            Object itemPrice = itemMap.get("price");

                            String id = itemId != null ? itemId.toString() : UUID.randomUUID().toString().substring(0, 8);
                            String name = itemTitle != null ? itemTitle.toString() : "Item";
                            double price = 0.0;
                            if (itemPrice instanceof Number pn) {
                                price = pn.doubleValue();
                            } else if (itemPrice != null) {
                                try {
                                    price = Double.parseDouble(itemPrice.toString());
                                } catch (NumberFormatException ignored) {}
                            }
                            items.add(new CarryItem(id, name, "shopping-bag", null, 1, price, currency));
                        }
                    }
                }
            }

            if (items.isEmpty() && amount != null && amount > 0) {
                items.add(new CarryItem(traceId, "Order #" + traceId.substring(traceId.length() - 6), "shopping-bag", null, 1, amount, currency));
            }

            carry = new CarryPayload(CarryOp.add, items);
        }

        Map<String, Object> attrs = new LinkedHashMap<>();
        attrs.put("source", "connector_webhook");

        EventType type = "paid".equals(node) ? EventType.complete : EventType.enter;

        return new CheckpointEvent(
                1,
                apiKey,
                traceId,
                node,
                null,
                type,
                "main",
                null,
                serverTs,
                "Webhook Ingest",
                attrs,
                null,
                entity,
                carry
        );
    }

    private static String sanitizeTraceId(String raw) {
        if (raw.matches("^[0-9a-fA-F-]{36}$")) {
            return raw.toLowerCase();
        }
        String clean = raw.replaceAll("[^a-zA-Z0-9]", "");
        if (clean.length() < 12) {
            clean = (clean + "000000000000").substring(0, 12);
        } else if (clean.length() > 12) {
            clean = clean.substring(clean.length() - 12);
        }
        return "0194f1c0-0000-7000-8000-" + clean.toLowerCase();
    }

    public static Object extractPath(Map<String, Object> map, String path) {
        if (map == null || path == null || path.isBlank()) return null;
        String[] parts = path.split("\\.");
        Object current = map;
        for (String part : parts) {
            if (current instanceof Map<?, ?> m) {
                current = m.get(part);
            } else {
                return null;
            }
        }
        return current;
    }
}
