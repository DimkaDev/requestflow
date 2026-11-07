package dev.flowtrace.adapter.out.fanout;

import dev.flowtrace.application.port.out.EventFanout;
import dev.flowtrace.domain.UiEvent;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

/**
 * In-JVM EventFanout implementation (spec section 7).
 */
@ApplicationScoped
public class InMemoryEventFanout implements EventFanout {

    private final Map<UUID, Set<Consumer<UiEvent>>> subscribers = new ConcurrentHashMap<>();

    @Override
    public void publish(UUID projectId, UiEvent event) {
        Set<Consumer<UiEvent>> set = subscribers.get(projectId);
        if (set == null || set.isEmpty()) {
            return;
        }
        for (Consumer<UiEvent> consumer : set) {
            try {
                consumer.accept(event);
            } catch (Exception ignored) {
                // Slow or closed consumers must never break fanout
            }
        }
    }

    @Override
    public Subscription subscribe(UUID projectId, Consumer<UiEvent> listener) {
        Set<Consumer<UiEvent>> set = subscribers.computeIfAbsent(projectId, k -> new CopyOnWriteArraySet<>());
        set.add(listener);
        return () -> {
            Set<Consumer<UiEvent>> s = subscribers.get(projectId);
            if (s != null) {
                s.remove(listener);
            }
        };
    }
}
