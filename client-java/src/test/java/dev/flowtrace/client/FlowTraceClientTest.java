package dev.flowtrace.client;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FlowTraceClientTest {

    @Test
    void sdkGeneratesUuidV7AndFormatsCheckpointsWithContext() {
        List<ClientEvent> captured = new ArrayList<>();
        Transport memoryTransport = new Transport() {
            @Override
            public void sendBatch(List<ClientEvent> events) {
                captured.addAll(events);
            }

            @Override
            public void close() {
            }
        };

        try (FlowTrace ft = FlowTrace.builder()
                .apiKey("ft_live_test")
                .transport(memoryTransport)
                .build()) {
            String traceId = ft.newTrace();
            assertEquals(36, traceId.length());
            assertEquals('7', traceId.charAt(14));

            try (var scope = FlowTraceContext.withTrace(traceId)) {
                ft.checkpoint("website");
            }
            ft.checkpoint(traceId, "service-a", Map.of("tier", "pro"));
            ft.error(traceId, "db", "timeout");
            ft.end(traceId, "db");
            ft.flushNow();
        }

        assertEquals(4, captured.size());
        assertEquals("website", captured.get(0).node());
        assertEquals("service-a", captured.get(1).node());
        assertEquals("error", captured.get(2).type());
        assertEquals("end", captured.get(3).type());
        assertTrue(captured.get(1).toJson(true).contains("\"tier\":\"pro\""));
    }
}
