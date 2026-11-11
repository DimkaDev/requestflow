package dev.flowtrace.domain;

import java.util.List;

/**
 * Business flow template definition (spec v1.1 / TASKS_v2 E18).
 * Pure Java domain representation of ready-made business diagrams and scenarios.
 */
public record TemplateDefinition(
        String id,
        String name,
        String category,
        String description,
        String theme,
        DiagramGraph diagram,
        List<String> defaultPersonas,
        List<String> terminalNodes
) {
    public static List<TemplateDefinition> builtInTemplates() {
        return List.of(
                new TemplateDefinition(
                        "online-shop",
                        "Online Shop (B2C Live Commerce)",
                        "commerce",
                        "Storefront funnel: Visit -> Browse -> Product -> Cart -> Checkout -> Payment -> Paid / Abandoned",
                        "cozy-light",
                        DiagramGraph.onlineShopDiagram(),
                        List.of("browser", "buyer", "hesitant", "abandoner"),
                        List.of("paid", "payment-failed", "abandoned")
                ),
                new TemplateDefinition(
                        "microservices",
                        "Cloud & Microservices (Technical)",
                        "engineering",
                        "Technical architecture: Website -> Load Balancer -> Decision -> Services -> DB",
                        "dark-neon",
                        DiagramGraph.defaultSampleDiagram(),
                        List.of("standard-request", "pro-request", "batch-job"),
                        List.of("db")
                ),
                new TemplateDefinition(
                        "queue-worker",
                        "Async Queue & Event Bus",
                        "backend",
                        "Asynchronous pipeline: Webhooks -> Ingest API -> Kafka Queue -> Worker Pool -> Postgres / DLQ",
                        "dark-neon",
                        DiagramGraph.queueWorkerDiagram(),
                        List.of("webhook-event", "batch-task", "retry-task"),
                        List.of("db", "dlq")
                ),
                new TemplateDefinition(
                        "ai-rag",
                        "AI Agent & RAG Pipeline",
                        "ai",
                        "LLM pipeline: User Prompt -> Embedding -> Vector Search -> LLM Orchestrator -> Tools -> Response",
                        "dark-neon",
                        DiagramGraph.aiRagDiagram(),
                        List.of("search-prompt", "agent-task", "tool-call"),
                        List.of("response")
                )
        );
    }
}
