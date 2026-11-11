package dev.flowtrace.domain;

/**
 * Type of external storefront or webhook connector (Gate G1-E / E20).
 * Framework-free pure Java domain enum.
 */
public enum ConnectorType {
    STOREFRONT_JS,
    GENERIC_WEBHOOK,
    SHOPIFY_WEBHOOK,
    WOOCOMMERCE_WEBHOOK,
    STRIPE_WEBHOOK
}
