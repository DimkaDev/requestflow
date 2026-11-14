package dev.flowtrace.application.port.out;

import dev.flowtrace.domain.BillingInterval;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Subscription;
import java.util.UUID;

/**
 * Outbound port for billing provider operations (ADR-0011 / E3-Step-3).
 */
public interface BillingProviderPort {

    record CheckoutSessionResult(
            String provider,
            String sessionId,
            String checkoutUrl,
            boolean sandboxImmediateApplied,
            int amountCents,
            int discountPercent
    ) {
    }

    record PortalSessionResult(
            String provider,
            String portalUrl
    ) {
    }

    String providerName();

    CheckoutSessionResult createCheckoutSession(
            UUID organizationId,
            String billingEmail,
            PlanTier targetTier,
            BillingInterval interval,
            String promoCode,
            String returnUrl
    );

    PortalSessionResult createCustomerPortalSession(
            UUID organizationId,
            String providerCustomerId,
            String returnUrl
    );

    boolean verifyWebhookSignature(String rawPayload, String signatureHeader);

    String computeWebhookSignature(String rawPayload, long epochSeconds);

    Subscription fetchProviderSubscriptionState(Subscription localSubscription);
}
