package dev.flowtrace.adapter.in.ws;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.IngestEventUseCase;
import dev.flowtrace.application.ProjectService;
import dev.flowtrace.application.port.out.EventFanout;
import dev.flowtrace.domain.UiEvent;
import io.micrometer.core.instrument.MeterRegistry;
import io.quarkus.websockets.next.OnClose;
import io.quarkus.websockets.next.OnOpen;
import io.quarkus.websockets.next.PathParam;
import io.quarkus.websockets.next.WebSocket;
import io.quarkus.websockets.next.WebSocketConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Real-time WebSocket stream endpoint `/ws/v1/projects/{projectId}/stream` (spec section 7).
 * Sends initial `snapshot` on connect, streams real-time hop/spawn/end/diagram_patch/stats events,
 * and protects against slow clients using a bounded non-blocking send queue.
 */
@WebSocket(path = "/ws/v1/projects/{projectId}/stream")
@ApplicationScoped
public class ProjectStreamWebSocket {

    private static final int MAX_SESSION_BUFFER = 256;

    private final IngestEventUseCase ingestEventUseCase;
    private final ProjectService projectService;
    private final EventFanout eventFanout;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final boolean mockAuthEnabled;
    private final AtomicInteger activeSessions = new AtomicInteger(0);
    private final Map<String, EventFanout.Subscription> subscriptions = new ConcurrentHashMap<>();

    @Inject
    public ProjectStreamWebSocket(
            IngestEventUseCase ingestEventUseCase,
            ProjectService projectService,
            EventFanout eventFanout,
            ObjectMapper objectMapper,
            MeterRegistry meterRegistry,
            @ConfigProperty(name = "flowtrace.auth.mock-enabled", defaultValue = "true") boolean mockAuthEnabled
    ) {
        this.ingestEventUseCase = ingestEventUseCase;
        this.projectService = projectService;
        this.eventFanout = eventFanout;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.mockAuthEnabled = mockAuthEnabled;
        meterRegistry.gauge("ws_sessions", activeSessions);
    }

    @OnOpen
    public void onOpen(WebSocketConnection connection, @PathParam("projectId") String projectIdStr) {
        UUID projectId;
        try {
            projectId = UUID.fromString(projectIdStr);
        } catch (IllegalArgumentException e) {
            connection.closeAndAwait();
            return;
        }

        // Check WS ticket if provided or required
        String query = connection.handshakeRequest().query();
        String ticket = extractQueryParam(query, "ticket");
        if (!mockAuthEnabled && !projectService.validateWsTicket(projectId, ticket)) {
            connection.closeAndAwait();
            return;
        } else if (ticket != null && !ticket.isBlank()) {
            projectService.validateWsTicket(projectId, ticket);
        }

        activeSessions.incrementAndGet();

        // Send initial snapshot
        UiEvent.SnapshotEvent snapshot = ingestEventUseCase.buildSnapshot(projectId);
        sendJson(connection, snapshot);

        // Bounded per-session queue to handle slow clients without blocking other sessions
        ArrayBlockingQueue<UiEvent> outboundQueue = new ArrayBlockingQueue<>(MAX_SESSION_BUFFER);
        AtomicLong droppedCount = new AtomicLong(0);
        AtomicBoolean draining = new AtomicBoolean(false);

        EventFanout.Subscription sub = eventFanout.subscribe(projectId, event -> {
            if (!connection.isOpen()) {
                return;
            }
            if (!outboundQueue.offer(event)) {
                // Drop oldest event to make room
                outboundQueue.poll();
                outboundQueue.offer(event);
                droppedCount.incrementAndGet();
                meterRegistry.counter("ws_dropped_total").increment();
            }
            drainQueue(connection, outboundQueue, droppedCount, draining);
        });

        subscriptions.put(connection.id(), sub);
    }

    @OnClose
    public void onClose(WebSocketConnection connection) {
        EventFanout.Subscription sub = subscriptions.remove(connection.id());
        if (sub != null) {
            sub.close();
            activeSessions.decrementAndGet();
        }
    }

    private void drainQueue(
            WebSocketConnection connection,
            ArrayBlockingQueue<UiEvent> queue,
            AtomicLong droppedCount,
            AtomicBoolean draining
    ) {
        if (!draining.compareAndSet(false, true)) {
            return;
        }
        try {
            long dropped = droppedCount.getAndSet(0);
            if (dropped > 0 && connection.isOpen()) {
                sendJson(connection, new UiEvent.DroppedEvent(dropped));
            }
            UiEvent next;
            while ((next = queue.poll()) != null && connection.isOpen()) {
                sendJson(connection, next);
            }
        } finally {
            draining.set(false);
        }
    }

    private void sendJson(WebSocketConnection connection, UiEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            connection.sendText(json).subscribe().with(v -> {
            }, err -> {
            });
        } catch (Exception ignored) {
        }
    }

    private static String extractQueryParam(String query, String key) {
        if (query == null || query.isBlank()) {
            return null;
        }
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(key)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }
}
