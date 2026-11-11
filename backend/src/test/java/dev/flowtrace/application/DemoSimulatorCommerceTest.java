package dev.flowtrace.application;

import dev.flowtrace.domain.CarryItem;
import dev.flowtrace.domain.DiagramGraph;
import dev.flowtrace.domain.EntityInfo;
import dev.flowtrace.domain.EventType;
import dev.flowtrace.domain.TemplateDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.*;

public class DemoSimulatorCommerceTest {

    @Test
    @DisplayName("TemplateDefinition includes all built-in archetype templates")
    public void builtInTemplates() {
        List<TemplateDefinition> templates = TemplateDefinition.builtInTemplates();
        assertEquals(4, templates.size());

        TemplateDefinition shop = templates.stream()
                .filter(t -> t.id().equals("online-shop"))
                .findFirst()
                .orElseThrow();
        assertEquals("commerce", shop.category());
        assertEquals("cozy-light", shop.theme());
        assertEquals(9, shop.diagram().nodes().size());
        assertEquals(11, shop.diagram().edges().size());
        assertTrue(shop.terminalNodes().contains("paid"));
        assertTrue(shop.terminalNodes().contains("abandoned"));

        TemplateDefinition micro = templates.stream()
                .filter(t -> t.id().equals("microservices"))
                .findFirst()
                .orElseThrow();
        assertEquals("engineering", micro.category());
        assertEquals("dark-neon", micro.theme());
        assertEquals(6, micro.diagram().nodes().size());

        assertTrue(templates.stream().anyMatch(t -> t.id().equals("queue-worker")));
        assertTrue(templates.stream().anyMatch(t -> t.id().equals("ai-rag")));
    }

    @Test
    @DisplayName("DemoSimulator detects commerce vs technical diagrams accurately")
    public void isCommerceGraphDetection() {
        DemoSimulator simulator = new DemoSimulator(null, null);
        assertTrue(simulator.isCommerceGraph(DiagramGraph.onlineShopDiagram()));
        assertFalse(simulator.isCommerceGraph(DiagramGraph.defaultSampleDiagram()));
        assertFalse(simulator.isCommerceGraph(new DiagramGraph(1, "TB", List.of(), List.of())));
    }

    @Test
    @DisplayName("planCommerceScenario generates complete shopper journeys with items and entities")
    public void planCommerceScenarioGeneratesRealisticSteps() {
        DemoSimulator simulator = new DemoSimulator(null, null);
        DiagramGraph shopGraph = DiagramGraph.onlineShopDiagram();
        ThreadLocalRandom rng = ThreadLocalRandom.current();

        for (int i = 0; i < 20; i++) {
            var steps = simulator.planCommerceScenario(shopGraph, rng, 0.05);
            assertFalse(steps.isEmpty());

            // First step must be visit spawn with an entity
            var first = steps.get(0);
            assertEquals("visit", first.nodeKey());
            assertNull(first.fromKey());
            assertNotNull(first.entity());
            assertTrue(first.entity().avatar() != null && !first.entity().avatar().isBlank());
            assertTrue(first.entity().label() != null && !first.entity().label().isBlank());

            // Last step must be a terminal event
            var last = steps.get(steps.size() - 1);
            assertTrue(last.eventType().isTerminal(), "Last event should be terminal, got: " + last.eventType());
            assertTrue(List.of("paid", "abandoned", "payment-failed").contains(last.nodeKey()));

            // If path goes through cart, carry payload must be present
            boolean hasCart = steps.stream().anyMatch(s -> "cart".equals(s.nodeKey()));
            if (hasCart) {
                var cartStep = steps.stream().filter(s -> "cart".equals(s.nodeKey())).findFirst().get();
                assertNotNull(cartStep.carry());
                assertFalse(cartStep.carry().items().isEmpty());
                for (CarryItem item : cartStep.carry().items()) {
                    assertTrue(item.price() > 0.0);
                    assertEquals("EUR", item.currency());
                    assertNotNull(item.icon());
                }
            }
        }
    }
}
