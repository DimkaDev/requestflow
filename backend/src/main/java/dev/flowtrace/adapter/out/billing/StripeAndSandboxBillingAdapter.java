package dev.flowtrace.adapter.out.billing;

import dev.flowtrace.application.EntitlementsService;
import dev.flowtrace.application.port.out.BillingProviderPort;
import dev.flowtrace.domain.BillingInterval;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Subscription;
import dev.flowtrace.domain.UuidV7;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * Dual-mode Billing Provider Adapter (ADR-0011 / DEC-02):
 * - When `flowtrace.billing.stripe.secret-key` is configured, operates in `stripe` mode.
 * - Otherwise operates in `sandbox` mode for zero-secret local/CI development while
 *   still enforcing full Stripe-compatible `t=...,v1=...` HMAC-SHA256 webhook verification.
 */
@ApplicationScoped
public class StripeAndSandboxBillingAdapter implements BillingProviderPort {

    private final EntitlementsService entitlementsService;
    private final Optional<String> stripeSecretKey;
    private final String webhookSecret;

    @Inject
    public StripeAndSandboxBillingAdapter(
            EntitlementsService entitlementsService,
            @ConfigProperty(name = "flowtrace.billing.stripe.secret-key") Optional<String> stripeSecretKey,
            @ConfigProperty(name = "flowtrace.billing.webhook-secret", defaultValue = "whsec_flowtrace_local_sandbox_secret") String webhookSecret
    ) {
        this.entitlementsService = entitlementsService;
        this.stripeSecretKey = stripeSecretKey;
        this.webhookSecret = webhookSecret;
    }

    @Override
    public String providerName() {
        return isStripeConfigured() ? "stripe" : "sandbox";
    }

    private boolean isStripeConfigured() {
        return stripeSecretKey.isPresent() && !stripeSecretKey.get().isBlank();
    }

    @Override
    public CheckoutSessionResult createCheckoutSession(
            UUID organizationId,
            String billingEmail,
            PlanTier targetTier,
            BillingInterval interval,
            String promoCode,
            String returnUrl
    ) {
        int discountPct = Subscription.resolvePromoDiscountPercent(promoCode);
        int amountCents = entitlementsService.calculateInvoiceAmountCents(targetTier, interval, promoCode);
        String sessionId = "cs_" + providerName() + "_" + UuidV7.generateString().replace("-", "").substring(0, 16);
        String baseReturn = (returnUrl != null && !returnUrl.isBlank()) ? returnUrl : "/billing";
        String checkoutUrl = baseReturn + (baseReturn.contains("?") ? "&" : "?")
                + "checkout=success&session_id=" + sessionId + "&tier=" + targetTier.name();
        return new CheckoutSessionResult(
                providerName(),
                sessionId,
                checkoutUrl,
                !isStripeConfigured(),
                amountCents,
                discountPct
        );
    }

    @Override
    public PortalSessionResult createCustomerPortalSession(
            UUID organizationId,
            String providerCustomerId,
            String returnUrl
    ) {
        String baseReturn = (returnUrl != null && !returnUrl.isBlank()) ? returnUrl : "/billing";
        String portalUrl = baseReturn + (baseReturn.contains("?") ? "&" : "?")
                + "portal=active&customer=" + (providerCustomerId != null ? providerCustomerId : "cus_sandbox");
        return new PortalSessionResult(providerName(), portalUrl);
    }

    @Override
    public boolean verifyWebhookSignature(String rawPayload, String signatureHeader) {
        if (rawPayload == null || signatureHeader == null || signatureHeader.isBlank()) {
            return false;
        }
        long timestamp = -1L;
        String providedV1 = null;
        for (String part : signatureHeader.split(",")) {
            String trimmed = part.trim();
            if (trimmed.startsWith("t=")) {
                try {
                    timestamp = Long.parseLong(trimmed.substring(2).trim());
                } catch (NumberFormatException ignored) {
                    return false;
                }
            } else if (trimmed.startsWith("v1=")) {
                providedV1 = trimmed.substring(3).trim();
            }
        }
        if (timestamp <= 0 || providedV1 == null || providedV1.isEmpty()) {
            return false;
        }
        long nowSec = Instant.now().getEpochSecond();
        if (Math.abs(nowSec - timestamp) > 600L) {
            return false;
        }
        String expectedHeader = computeWebhookSignature(rawPayload, timestamp);
        String expectedV1 = expectedHeader.substring(expectedHeader.indexOf("v1=") + 3);
        return MessageDigest.isEqual(
                expectedV1.getBytes(StandardCharsets.UTF_8),
                providedV1.getBytes(StandardCharsets.UTF_8)
        );
    }

    @Override
    public String computeWebhookSignature(String rawPayload, long epochSeconds) {
        try {
            String signedPayload = epochSeconds + "." + (rawPayload != null ? rawPayload : "");
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(signedPayload.getBytes(StandardCharsets.UTF_8));
            return "t=" + epochSeconds + ",v1=" + HexFormat.of().formatHex(digest);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to compute HMAC-SHA256 webhook signature", e);
        }
    }

    @Override
    public Subscription fetchProviderSubscriptionState(Subscription localSubscription) {
        return new Subscription(
                localSubscription.organizationId(),
                providerName(),
                localSubscription.providerCustomerId(),
                localSubscription.providerSubscriptionId(),
                localSubscription.planTier(),
                localSubscription.billingInterval(),
                localSubscription.status(),
                localSubscription.currentPeriodStart(),
                localSubscription.currentPeriodEnd(),
                localSubscription.cancelAtPeriodEnd(),
                localSubscription.gracePeriodEndsAt(),
                localSubscription.companyName(),
                localSubscription.billingCountry(),
                localSubscription.vatId(),
                localSubscription.promoCode(),
                localSubscription.discountPercent(),
                Instant.now()
        );
    }
}
