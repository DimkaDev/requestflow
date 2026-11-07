package dev.flowtrace.simulator;

import dev.flowtrace.client.FlowTrace;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Standalone CLI load simulator (`java -jar simulator.jar --url ... --key ... --rate 50 --protocol udp`)
 * per spec section 13.
 */
public final class SimulatorCli {

    public static void main(String[] args) throws Exception {
        String url = "http://localhost:8080/api/v1";
        String key = "ft_live_demo0000000000000000000000000000";
        int rate = 10;
        String protocol = "http";
        int durationSeconds = 10;

        for (int i = 0; i < args.length; i++) {
            switch (args[i]) {
                case "--url" -> {
                    if (i + 1 < args.length) url = args[++i];
                }
                case "--key" -> {
                    if (i + 1 < args.length) key = args[++i];
                }
                case "--rate" -> {
                    if (i + 1 < args.length) rate = Integer.parseInt(args[++i]);
                }
                case "--protocol" -> {
                    if (i + 1 < args.length) protocol = args[++i].toLowerCase();
                }
                case "--duration" -> {
                    if (i + 1 < args.length) durationSeconds = Integer.parseInt(args[++i]);
                }
            }
        }

        String endpoint = url;
        if ("udp".equals(protocol) && !endpoint.startsWith("udp://")) {
            endpoint = "udp://localhost:9001";
        } else if ("tcp".equals(protocol) && !endpoint.startsWith("tcp://")) {
            endpoint = "tcp://localhost:9000";
        }

        System.out.printf("Starting FlowTrace CLI Simulator -> endpoint=%s, rate=%d traces/s, duration=%ds%n",
                endpoint, rate, durationSeconds);

        long sleepMs = Math.max(1L, 1000L / Math.max(1, rate));
        long endAt = System.currentTimeMillis() + (durationSeconds * 1000L);
        long sentTraces = 0;

        try (FlowTrace ft = FlowTrace.builder().endpoint(endpoint).apiKey(key).build()) {
            while (System.currentTimeMillis() < endAt) {
                String traceId = ft.newTrace();
                boolean premium = ThreadLocalRandom.current().nextBoolean();
                ft.checkpoint(traceId, "website");
                ft.checkpoint(traceId, "lb");
                ft.checkpoint(traceId, "if-premium", Map.of("tier", premium ? "pro" : "free"));
                ft.checkpoint(traceId, premium ? "service-a" : "service-b");
                ft.checkpoint(traceId, "db");
                ft.end(traceId, "db");
                sentTraces++;
                Thread.sleep(sleepMs);
            }
            ft.flushNow();
            System.out.printf("Completed simulation: sent=%d traces, dropped=%d%n", sentTraces, ft.droppedEventsCount());
        }
    }
}
