package dev.flowtrace.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public record DiagramGraph(
        int schema,
        String direction,
        List<DiagramNode> nodes,
        List<DiagramEdge> edges,
        List<DiagramGroup> groups
) {
    public DiagramGraph(int schema, String direction, List<DiagramNode> nodes, List<DiagramEdge> edges) {
        this(schema, direction, nodes, edges, null);
    }

    public record NodeProps(
            String role,
            String description,
            String tint,
            String size,
            String shape,
            String labelPosition,
            Boolean showCounter,
            Integer idleAbandonMinutes,
            Integer maxIn,
            Integer maxOut,
            Integer holdTimeMs,
            String groupId,
            Boolean locked,
            Integer zIndex,
            List<String> aliases,
            String packId,
            String blockDefId,
            String vendorLabel
    ) {
        public static NodeProps empty() {
            return new NodeProps("normal", null, null, "M", "card", "inside", true, null, null, null, 400, null, false, 1, List.of(), null, null, null);
        }
    }

    public record EdgeStyle(
            String lineType,
            String color,
            String thickness,
            Boolean dashed,
            Boolean arrowhead,
            String direction
    ) {
        public static EdgeStyle defaults() {
            return new EdgeStyle("curved", "auto", "normal", false, true, "one-way");
        }
    }

    public record EdgeFlow(
            Double weight,
            String condition,
            Integer expectedLatencyMs,
            Double speedMultiplier,
            String tokenStyle,
            Boolean terminalPath
    ) {
        public static EdgeFlow defaults() {
            return new EdgeFlow(null, null, 400, 1.0, "auto", false);
        }
    }

    public record DiagramGroup(
            String id,
            String name,
            String color,
            double x,
            double y,
            double width,
            double height,
            Boolean collapsed,
            Boolean locked
    ) {
    }

    public record DiagramNode(
            String key,
            String label,
            NodeType type,
            double x,
            double y,
            String icon,
            Boolean discovered,
            NodeProps props
    ) {
        public DiagramNode(String key, String label, NodeType type, double x, double y, String icon, Boolean discovered) {
            this(key, label, type, x, y, icon, discovered, null);
        }

        public DiagramNode(String key, String label, NodeType type, double x, double y, String icon) {
            this(key, label, type, x, y, icon, null, null);
        }
    }

    public record DiagramEdge(
            String id,
            String from,
            String to,
            String label,
            Boolean discovered,
            EdgeStyle style,
            EdgeFlow flow
    ) {
        public DiagramEdge(String id, String from, String to, String label, Boolean discovered) {
            this(id, from, to, label, discovered, null, null);
        }

        public DiagramEdge(String id, String from, String to, String label) {
            this(id, from, to, label, null, null, null);
        }
    }

    public Optional<DiagramNode> findNode(String key) {
        if (nodes == null || key == null) return Optional.empty();
        Optional<DiagramNode> direct = nodes.stream().filter(n -> key.equals(n.key())).findFirst();
        if (direct.isPresent()) {
            return direct;
        }
        return nodes.stream()
                .filter(n -> n.props() != null && n.props().aliases() != null && n.props().aliases().contains(key))
                .findFirst();
    }

    public String resolveCanonicalNodeKey(String key) {
        if (key == null) return null;
        return findNode(key).map(DiagramNode::key).orElse(key);
    }

    public Optional<DiagramEdge> findEdge(String from, String to) {
        if (edges == null || from == null || to == null) return Optional.empty();
        String canonicalFrom = resolveCanonicalNodeKey(from);
        String canonicalTo = resolveCanonicalNodeKey(to);
        return edges.stream()
                .filter(e -> e.from().equals(canonicalFrom) && e.to().equals(canonicalTo))
                .findFirst();
    }

    public DiagramGraph withAddedNode(DiagramNode newNode) {
        List<DiagramNode> updated = new ArrayList<>(nodes != null ? nodes : List.of());
        if (updated.stream().noneMatch(n -> n.key().equals(newNode.key()))) {
            updated.add(newNode);
        }
        return new DiagramGraph(schema, direction, Collections.unmodifiableList(updated), edges, groups);
    }

    public DiagramGraph withAddedEdge(DiagramEdge newEdge) {
        List<DiagramEdge> updated = new ArrayList<>(edges != null ? edges : List.of());
        if (updated.stream().noneMatch(e -> e.from().equals(newEdge.from()) && e.to().equals(newEdge.to()))) {
            updated.add(newEdge);
        }
        return new DiagramGraph(schema, direction, nodes, Collections.unmodifiableList(updated), groups);
    }

    public static DiagramGraph blankDiagram() {
        return new DiagramGraph(2, "LR", List.of(), List.of(), List.of());
    }

    public static DiagramGraph defaultSampleDiagram() {
        List<DiagramNode> nodes = List.of(
                new DiagramNode("website", "Website", NodeType.source, 0, 0, "globe", false),
                new DiagramNode("lb", "Load Balancer", NodeType.service, 0, 160, "server", false),
                new DiagramNode("if-premium", "Premium?", NodeType.decision, 0, 320, "git-branch", false),
                new DiagramNode("service-a", "Service A", NodeType.service, -200, 480, "cpu", false),
                new DiagramNode("service-b", "Service B", NodeType.service, 200, 480, "cpu", false),
                new DiagramNode("db", "Database", NodeType.datastore, 0, 640, "database", false)
        );
        List<DiagramEdge> edges = List.of(
                new DiagramEdge("e1", "website", "lb", null, false),
                new DiagramEdge("e2", "lb", "if-premium", null, false),
                new DiagramEdge("e3", "if-premium", "service-a", "yes", false),
                new DiagramEdge("e4", "if-premium", "service-b", "no", false),
                new DiagramEdge("e5", "service-a", "db", null, false),
                new DiagramEdge("e6", "service-b", "db", null, false)
        );
        return new DiagramGraph(1, "TB", nodes, edges, List.of());
    }

    public static DiagramGraph onlineShopDiagram() {
        List<DiagramNode> nodes = List.of(
                new DiagramNode("visit", "Storefront", NodeType.source, -340, 0, "store", false),
                new DiagramNode("browse", "Browse Catalog", NodeType.service, -120, 0, "compass", false),
                new DiagramNode("product", "Product Detail", NodeType.service, 120, 0, "tag", false),
                new DiagramNode("cart", "Cart & Bag", NodeType.service, 340, 0, "shopping-cart", false),
                new DiagramNode("checkout", "Checkout", NodeType.service, 340, 180, "user-check", false),
                new DiagramNode("payment", "Payment Gateway", NodeType.decision, 120, 180, "credit-card", false),
                new DiagramNode("paid", "Order Paid", NodeType.end, -120, 180, "check-circle", false),
                new DiagramNode("payment-failed", "Payment Failed", NodeType.end, 120, 320, "alert-circle", false),
                new DiagramNode("abandoned", "Abandoned", NodeType.end, -120, -140, "x-circle", false)
        );
        List<DiagramEdge> edges = List.of(
                new DiagramEdge("e_shop_1", "visit", "browse", "visit", false),
                new DiagramEdge("e_shop_2", "browse", "product", "view", false),
                new DiagramEdge("e_shop_3", "browse", "abandoned", "bounce", false),
                new DiagramEdge("e_shop_4", "product", "cart", "add to cart", false),
                new DiagramEdge("e_shop_5", "product", "browse", "more", false),
                new DiagramEdge("e_shop_6", "cart", "checkout", "proceed", false),
                new DiagramEdge("e_shop_7", "cart", "abandoned", "abandon", false),
                new DiagramEdge("e_shop_8", "checkout", "payment", "pay", false),
                new DiagramEdge("e_shop_9", "checkout", "abandoned", "abandon", false),
                new DiagramEdge("e_shop_10", "payment", "paid", "success", false),
                new DiagramEdge("e_shop_11", "payment", "payment-failed", "declined", false)
        );
        return new DiagramGraph(1, "LR", nodes, edges, List.of());
    }

    public static DiagramGraph queueWorkerDiagram() {
        List<DiagramNode> nodes = List.of(
                new DiagramNode("client", "Webhooks / Clients", NodeType.source, -320, 0, "globe", false),
                new DiagramNode("ingest-api", "Ingest API", NodeType.service, -100, 0, "server", false),
                new DiagramNode("queue", "Kafka / SQS Buffer", NodeType.queue, 120, 0, "layers", false),
                new DiagramNode("worker", "Worker Pool", NodeType.service, 340, 0, "cpu", false),
                new DiagramNode("db", "Postgres Primary", NodeType.datastore, 340, 180, "database", false),
                new DiagramNode("dlq", "Dead Letter Queue", NodeType.end, 120, 180, "alert-triangle", false)
        );
        List<DiagramEdge> edges = List.of(
                new DiagramEdge("e_qw_1", "client", "ingest-api", "submit", false),
                new DiagramEdge("e_qw_2", "ingest-api", "queue", "publish", false),
                new DiagramEdge("e_qw_3", "queue", "worker", "poll", false),
                new DiagramEdge("e_qw_4", "worker", "db", "commit", false),
                new DiagramEdge("e_qw_5", "worker", "dlq", "exhausted", false)
        );
        return new DiagramGraph(1, "LR", nodes, edges, List.of());
    }

    public static DiagramGraph aiRagDiagram() {
        List<DiagramNode> nodes = List.of(
                new DiagramNode("user-prompt", "User Prompt", NodeType.source, -340, 0, "terminal", false),
                new DiagramNode("embedding", "Embedding Gen", NodeType.service, -120, 0, "sparkles", false),
                new DiagramNode("vector-db", "Vector Database", NodeType.datastore, -120, 180, "database", false),
                new DiagramNode("llm-agent", "LLM Orchestrator", NodeType.service, 120, 0, "cpu", false),
                new DiagramNode("tool-exec", "Tool Execution", NodeType.service, 120, 180, "tool", false),
                new DiagramNode("response", "Final Response", NodeType.end, 340, 0, "check-circle", false)
        );
        List<DiagramEdge> edges = List.of(
                new DiagramEdge("e_ai_1", "user-prompt", "embedding", "query", false),
                new DiagramEdge("e_ai_2", "embedding", "vector-db", "similarity", false),
                new DiagramEdge("e_ai_3", "vector-db", "llm-agent", "context", false),
                new DiagramEdge("e_ai_4", "llm-agent", "tool-exec", "tool_call", false),
                new DiagramEdge("e_ai_5", "tool-exec", "llm-agent", "tool_result", false),
                new DiagramEdge("e_ai_6", "llm-agent", "response", "stream", false)
        );
        return new DiagramGraph(1, "LR", nodes, edges, List.of());
    }
}
