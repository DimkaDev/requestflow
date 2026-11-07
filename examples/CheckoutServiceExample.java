package dev.flowtrace.example;

import dev.flowtrace.client.FlowTrace;
import dev.flowtrace.client.FlowTraceContext;
import java.util.Map;

/**
 * Sample Java integration demonstrating 5 checkpoints through the FlowTrace SDK (spec section 17 M6).
 */
public final class CheckoutServiceExample {

    public static void main(String[] args) throws Exception {
        String endpoint = System.getenv().getOrDefault("FLOWTRACE_ENDPOINT", "http://localhost:8080/api/v1");
        String apiKey = System.getenv().getOrDefault("FLOWTRACE_KEY", "ft_live_demo0000000000000000000000000000");

        try (FlowTrace ft = FlowTrace.builder()
                .endpoint(endpoint)
                .apiKey(apiKey)
                .build()) {

            String traceId = ft.newTrace();
            System.out.println("Emitting live traceId: " + traceId);

            try (var scope = FlowTraceContext.withTrace(traceId)) {
                ft.checkpoint("website");
                Thread.sleep(200);

                ft.checkpoint("lb");
                Thread.sleep(200);

                ft.checkpoint(traceId, "if-premium", Map.of("tier", "pro", "cartTotal", 149.99));
                Thread.sleep(200);

                ft.checkpoint("service-a");
                Thread.sleep(200);

                ft.checkpoint("db");
                ft.end(traceId, "db");
            }

            ft.flushNow();
            System.out.println("Finished sending 5 checkpoints.");
        }
    }
}
