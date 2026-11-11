package dev.flowtrace.domain;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WebhookPayloadParserTest {

    @Test
    void testShopifyOrderWebhookParsing() {
        Map<String, Object> shopifyOrder = Map.of(
                "id", 82098291194L,
                "customer", Map.of(
                        "id", 771122,
                        "first_name", "Elena",
                        "email", "elena@example.com"
                ),
                "line_items", List.of(
                        Map.of("id", 101, "title", "Wool Sweater", "price", "89.00")
                ),
                "total_price", "89.00",
                "currency", "EUR"
        );

        WebhookMapping mapping = WebhookMapping.shopifyOrderPreset();
        CheckpointEvent event = WebhookPayloadParser.parse("ft_live_test_key", shopifyOrder, mapping, 1700000000000L);

        assertNotNull(event);
        assertEquals("paid", event.node());
        assertTrue(event.traceId().contains("82098291194"));
        assertNotNull(event.entity());
        assertEquals("Elena", event.entity().label());
        assertEquals("771122", event.entity().ref());

        assertNotNull(event.carry());
        assertEquals(1, event.carry().items().size());
        assertEquals("Wool Sweater", event.carry().items().get(0).label());
        assertEquals(89.00, event.carry().items().get(0).price());
        assertEquals("EUR", event.carry().items().get(0).currency());
    }

    @Test
    void testStripeChargeWebhookParsing() {
        Map<String, Object> stripeCharge = Map.of(
                "id", "ch_3MvL322eZvKYlo2C17eOp6Sp",
                "amount", 125.50,
                "currency", "usd",
                "billing_details", Map.of(
                        "name", "Lucas",
                        "email", "lucas@flowtrace.dev"
                )
        );

        WebhookMapping mapping = WebhookMapping.stripeChargePreset();
        CheckpointEvent event = WebhookPayloadParser.parse("ft_live_test_key", stripeCharge, mapping, 1700000000000L);

        assertNotNull(event);
        assertEquals("paid", event.node());
        assertNotNull(event.entity());
        assertEquals("Lucas", event.entity().label());
        assertEquals("lucas@flowtrace.dev", event.entity().ref());
        assertNotNull(event.carry());
        assertEquals(1, event.carry().items().size());
        assertEquals(125.50, event.carry().items().get(0).price());
        assertEquals("USD", event.carry().items().get(0).currency());
    }

    @Test
    void testFallbackWhenMissingFields() {
        Map<String, Object> emptyPayload = Map.of();
        WebhookMapping mapping = WebhookMapping.genericPreset();
        CheckpointEvent event = WebhookPayloadParser.parse("ft_live_test_key", emptyPayload, mapping, 1700000000000L);

        assertNotNull(event);
        assertEquals("browse", event.node());
        assertNotNull(event.traceId());
        assertTrue(event.traceId().startsWith("0194f1c0-0000-7000-8000-"));
    }
}
