package dev.flowtrace.domain;

/**
 * Configurable field mapping rules for incoming JSON webhooks (E20-Step-2 / Gate G1-E).
 * Framework-free pure Java domain record.
 */
public record WebhookMapping(
        String traceIdPath,
        String nodePath,
        String defaultNode,
        String entityRefPath,
        String entityNamePath,
        String avatarPath,
        String itemsPath,
        String amountPath,
        String currencyPath
) {
    public static WebhookMapping genericPreset() {
        return new WebhookMapping(
                "traceId",
                "node",
                "browse",
                "customer.id",
                "customer.name",
                "customer.avatar",
                "items",
                "amount",
                "currency"
        );
    }

    public static WebhookMapping shopifyOrderPreset() {
        return new WebhookMapping(
                "id",
                null,
                "paid",
                "customer.id",
                "customer.first_name",
                null,
                "line_items",
                "total_price",
                "currency"
        );
    }

    public static WebhookMapping woocommerceOrderPreset() {
        return new WebhookMapping(
                "id",
                null,
                "paid",
                "billing.email",
                "billing.first_name",
                null,
                "line_items",
                "total",
                "currency"
        );
    }

    public static WebhookMapping stripeChargePreset() {
        return new WebhookMapping(
                "id",
                null,
                "paid",
                "billing_details.email",
                "billing_details.name",
                null,
                null,
                "amount",
                "currency"
        );
    }
}
