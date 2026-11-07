package dev.flowtrace.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

public record DiagramGraph(
        int schema,
        String direction,
        List<DiagramNode> nodes,
        List<DiagramEdge> edges
) {
    public record DiagramNode(
            String key,
            String label,
            NodeType type,
            double x,
            double y,
            String icon,
            Boolean discovered
    ) {
        public DiagramNode(String key, String label, NodeType type, double x, double y, String icon) {
            this(key, label, type, x, y, icon, null);
        }
    }

    public record DiagramEdge(
            String id,
            String from,
            String to,
            String label,
            Boolean discovered
    ) {
        public DiagramEdge(String id, String from, String to, String label) {
            this(id, from, to, label, null);
        }
    }

    public Optional<DiagramNode> findNode(String key) {
        if (nodes == null) return Optional.empty();
        return nodes.stream().filter(n -> n.key().equals(key)).findFirst();
    }

    public Optional<DiagramEdge> findEdge(String from, String to) {
        if (edges == null) return Optional.empty();
        return edges.stream().filter(e -> e.from().equals(from) && e.to().equals(to)).findFirst();
    }

    public DiagramGraph withAddedNode(DiagramNode newNode) {
        List<DiagramNode> updated = new ArrayList<>(nodes != null ? nodes : List.of());
        if (updated.stream().noneMatch(n -> n.key().equals(newNode.key()))) {
            updated.add(newNode);
        }
        return new DiagramGraph(schema, direction, Collections.unmodifiableList(updated), edges);
    }

    public DiagramGraph withAddedEdge(DiagramEdge newEdge) {
        List<DiagramEdge> updated = new ArrayList<>(edges != null ? edges : List.of());
        if (updated.stream().noneMatch(e -> e.from().equals(newEdge.from()) && e.to().equals(newEdge.to()))) {
            updated.add(newEdge);
        }
        return new DiagramGraph(schema, direction, nodes, Collections.unmodifiableList(updated));
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
        return new DiagramGraph(1, "TB", nodes, edges);
    }
}
