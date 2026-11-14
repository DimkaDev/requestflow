package dev.flowtrace.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Immutable billing invoice record for an organization subscription.
 */
public record BillingInvoice(
        UUID id,
        UUID organizationId,
        String providerInvoiceId,
        PlanTier planTier,
        BillingInterval billingInterval,
        int amountCents,
        String currency,
        String status,
        String invoicePdfUrl,
        Instant createdAt
) {
}
