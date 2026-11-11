package dev.flowtrace.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

public class CarryStateTest {

    @Test
    @DisplayName("EntityInfo validates field lengths")
    public void entityInfoValidation() {
        assertDoesNotThrow(() -> new EntityInfo("customer", "c-1042", "Alice", "fox"));
        assertThrows(ValidationException.class, () -> new EntityInfo("a".repeat(33), "ref", "label", "avatar"));
        assertThrows(ValidationException.class, () -> new EntityInfo("kind", "r".repeat(129), "label", "avatar"));
        assertThrows(ValidationException.class, () -> new EntityInfo("kind", "ref", "l".repeat(41), "avatar"));
        assertThrows(ValidationException.class, () -> new EntityInfo("kind", "ref", "label", "v".repeat(33)));
    }

    @Test
    @DisplayName("CarryItem validates required sku and non-negative values")
    public void carryItemValidation() {
        assertDoesNotThrow(() -> new CarryItem("candle-1", "Lavender Candle", "emoji:🕯️", null, 2, 12.50, "EUR"));
        assertThrows(ValidationException.class, () -> new CarryItem("", "Label", null, null, 1, 10.0, "EUR"));
        assertThrows(ValidationException.class, () -> new CarryItem(null, "Label", null, null, 1, 10.0, "EUR"));
        assertThrows(ValidationException.class, () -> new CarryItem("sku", "Label", null, null, -1, 10.0, "EUR"));
        assertThrows(ValidationException.class, () -> new CarryItem("sku", "Label", null, null, 1, -5.0, "EUR"));
    }

    @Test
    @DisplayName("CarryPayload enforces max 20 items per event")
    public void carryPayloadMaxItems() {
        assertThrows(ValidationException.class, () -> new CarryPayload(null, List.of()));
        List<CarryItem> twentyOneItems = java.util.stream.IntStream.rangeClosed(1, 21)
                .mapToObj(i -> new CarryItem("sku-" + i, "Item " + i, null, null, 1, 1.0, "EUR"))
                .toList();
        assertThrows(ValidationException.class, () -> new CarryPayload(CarryOp.add, twentyOneItems));
    }

    @Test
    @DisplayName("EventType correctly identifies terminal and business outcomes")
    public void eventTypeSemantics() {
        assertTrue(EventType.end.isTerminal());
        assertTrue(EventType.complete.isTerminal());
        assertTrue(EventType.fail.isTerminal());
        assertTrue(EventType.abandon.isTerminal());
        assertFalse(EventType.enter.isTerminal());
        assertFalse(EventType.error.isTerminal());

        assertEquals(EventType.complete, EventType.fromString("complete"));
        assertEquals(EventType.fail, EventType.fromString("fail"));
        assertEquals(EventType.abandon, EventType.fromString("abandon"));
    }

    @Test
    @DisplayName("HopResolver manages carry state through set, add, remove, and clear operations")
    public void hopResolverCarryLifecycle() {
        HopResolver resolver = new HopResolver();
        UUID projectId = UUID.randomUUID();
        String traceId = UUID.randomUUID().toString();
        EntityInfo shopper = new EntityInfo("customer", "c-100", "Visitor 100", "cat");

        // 1. Visit (spawn at 'visit')
        CheckpointEvent e1 = new CheckpointEvent(
                1, "ft_live_test", traceId, "visit", null, EventType.enter, "main",
                1000L, 1000L, null, Map.of(), null, shopper, null
        );
        HopResolver.ResolutionResult r1 = resolver.resolve(projectId, false, null, e1);
        assertEquals(1, r1.uiEvents().size());
        assertInstanceOf(UiEvent.SpawnEvent.class, r1.uiEvents().get(0));
        UiEvent.SpawnEvent spawn = (UiEvent.SpawnEvent) r1.uiEvents().get(0);
        assertEquals("cat", spawn.entity().avatar());
        assertEquals(0, spawn.carry().count());

        // 2. Add candle to cart (hop 'visit' -> 'cart' with carry.add)
        CarryItem candle = new CarryItem("candle", "Lavender Candle", "emoji:🕯️", null, 2, 15.0, "EUR");
        CheckpointEvent e2 = new CheckpointEvent(
                1, "ft_live_test", traceId, "cart", null, EventType.enter, "main",
                1100L, 1100L, null, Map.of(), null, null, new CarryPayload(CarryOp.add, List.of(candle))
        );
        HopResolver.ResolutionResult r2 = resolver.resolve(projectId, false, null, e2);
        assertEquals(1, r2.uiEvents().size());
        assertInstanceOf(UiEvent.HopEvent.class, r2.uiEvents().get(0));
        UiEvent.HopEvent hop1 = (UiEvent.HopEvent) r2.uiEvents().get(0);
        // Entity should be preserved from trace state
        assertNotNull(hop1.entity());
        assertEquals("cat", hop1.entity().avatar());
        assertEquals(2, hop1.carry().count());
        assertEquals(30.0, hop1.carry().total());
        assertEquals("EUR", hop1.carry().currency());
        assertEquals(List.of("emoji:🕯️"), hop1.carry().topIcons());

        // 3. Add coffee to cart (in-place carry update at 'cart')
        CarryItem coffee = new CarryItem("coffee", "Arabica Coffee", "emoji:☕", null, 1, 8.50, "EUR");
        CheckpointEvent e3 = new CheckpointEvent(
                1, "ft_live_test", traceId, "cart", "cart", EventType.enter, "main",
                1200L, 1200L, null, Map.of(), null, null, new CarryPayload(CarryOp.add, List.of(coffee))
        );
        HopResolver.ResolutionResult r3 = resolver.resolve(projectId, false, null, e3);
        assertEquals(1, r3.uiEvents().size());
        assertInstanceOf(UiEvent.CarryEvent.class, r3.uiEvents().get(0));
        UiEvent.CarryEvent carryEv = (UiEvent.CarryEvent) r3.uiEvents().get(0);
        assertEquals(3, carryEv.carry().count());
        assertEquals(38.50, carryEv.carry().total());
        assertEquals(2, carryEv.carry().topIcons().size());

        // 4. Remove 1 candle (hop 'cart' -> 'checkout')
        CarryItem candleRemove = new CarryItem("candle", "Lavender Candle", null, null, 1, 15.0, "EUR");
        CheckpointEvent e4 = new CheckpointEvent(
                1, "ft_live_test", traceId, "checkout", null, EventType.enter, "main",
                1300L, 1300L, null, Map.of(), null, null, new CarryPayload(CarryOp.remove, List.of(candleRemove))
        );
        HopResolver.ResolutionResult r4 = resolver.resolve(projectId, false, null, e4);
        UiEvent.HopEvent hop2 = (UiEvent.HopEvent) r4.uiEvents().get(0);
        assertEquals(2, hop2.carry().count()); // 1 candle + 1 coffee
        assertEquals(23.50, hop2.carry().total());

        // 5. Complete purchase (EventType.complete)
        CheckpointEvent e5 = new CheckpointEvent(
                1, "ft_live_test", traceId, "paid", null, EventType.complete, "main",
                1400L, 1400L, null, Map.of(), null, null, null
        );
        HopResolver.ResolutionResult r5 = resolver.resolve(projectId, false, null, e5);
        // Produces HopEvent (checkout -> paid) followed by CompleteEvent at paid node
        assertEquals(2, r5.uiEvents().size());
        assertInstanceOf(UiEvent.HopEvent.class, r5.uiEvents().get(0));
        assertInstanceOf(UiEvent.CompleteEvent.class, r5.uiEvents().get(1));
        UiEvent.CompleteEvent complete = (UiEvent.CompleteEvent) r5.uiEvents().get(1);
        assertEquals(2, complete.carry().count());
        assertEquals(23.50, complete.carry().total());
        assertEquals("cat", complete.entity().avatar());

        // Trace state should be cleared on complete
        assertTrue(resolver.getActiveTraces(projectId, 1500L).isEmpty());
    }

    @Test
    @DisplayName("HopResolver caps carried items at 50 per trace")
    public void hopResolverMaxItemsCap() {
        HopResolver resolver = new HopResolver();
        UUID projectId = UUID.randomUUID();
        String traceId = UUID.randomUUID().toString();

        List<CarryItem> batch1 = java.util.stream.IntStream.rangeClosed(1, 20)
                .mapToObj(i -> new CarryItem("sku-" + i, "Item " + i, null, null, 1, 10.0, "EUR"))
                .toList();
        List<CarryItem> batch2 = java.util.stream.IntStream.rangeClosed(21, 40)
                .mapToObj(i -> new CarryItem("sku-" + i, "Item " + i, null, null, 1, 10.0, "EUR"))
                .toList();
        List<CarryItem> batch3 = java.util.stream.IntStream.rangeClosed(41, 60)
                .mapToObj(i -> new CarryItem("sku-" + i, "Item " + i, null, null, 1, 10.0, "EUR"))
                .toList();

        resolver.resolve(projectId, true, null, new CheckpointEvent(1, "k", traceId, "cart", null, EventType.enter, "main", 1L, 1L, null, Map.of(), null, null, new CarryPayload(CarryOp.add, batch1)));
        resolver.resolve(projectId, true, null, new CheckpointEvent(1, "k", traceId, "cart", "cart", EventType.enter, "main", 2L, 2L, null, Map.of(), null, null, new CarryPayload(CarryOp.add, batch2)));
        HopResolver.ResolutionResult r3 = resolver.resolve(projectId, true, null, new CheckpointEvent(1, "k", traceId, "cart", "cart", EventType.enter, "main", 3L, 3L, null, Map.of(), null, null, new CarryPayload(CarryOp.add, batch3)));

        UiEvent.CarryEvent carryEv = (UiEvent.CarryEvent) r3.uiEvents().get(0);
        // Only 50 unique items allowed
        assertEquals(50, carryEv.carry().count());
        assertEquals(500.0, carryEv.carry().total());
    }
}
