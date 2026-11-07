package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.UiEvent;
import java.util.UUID;
import java.util.function.Consumer;

/**
 * Outbound port for real-time event fanout to WebSocket subscribers (spec section 7).
 */
public interface EventFanout {

    void publish(UUID projectId, UiEvent event);

    Subscription subscribe(UUID projectId, Consumer<UiEvent> listener);

    interface Subscription extends AutoCloseable {
        @Override
        void close();
    }
}
