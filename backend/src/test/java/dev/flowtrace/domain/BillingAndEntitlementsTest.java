package dev.flowtrace.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.flowtrace.adapter.out.billing.StripeAndSandboxBillingAdapter;
import dev.flowtrace.application.EntitlementsService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BillingAndEntitlementsTest {

    @Test
    void unifiedPlanCatalogAndSoftCapQuotasWorkAsExpected() {
        EntitlementsService entitlements = new EntitlementsService();
        List<PlanCatalogEntry> plans = entitlements.listPlans();
        assertEquals(4, plans.size());

        PlanCatalogEntry free = entitlements.getPlanCatalogEntry(PlanTier.FREE);
        assertEquals(0, free.monthlyPriceUsd());
        assertEquals(100_000L, free.monthlyEventQuota());
        assertEquals(100_000L, free.effectiveHardStopQuota());

        PlanCatalogEntry pro = entitlements.getPlanCatalogEntry(PlanTier.PRO);
        assertEquals(29, pro.monthlyPriceUsd());
        assertEquals(23, pro.annualMonthlyPriceUsd());
        assertEquals(5_000_000L, pro.monthlyEventQuota());
        assertEquals(6_000_000L, pro.effectiveHardStopQuota());

        // Free plan hard-stops at 100% (100,000)
        var freeAt99k = entitlements.evaluateQuota(PlanTier.FREE, 99_999L);
        assertTrue(freeAt99k.warning80Reached());
        assertFalse(freeAt99k.softLimit100Reached());
        assertFalse(freeAt99k.hardStopExceeded());

        var freeAt100k = entitlements.evaluateQuota(PlanTier.FREE, 100_000L);
        assertTrue(freeAt100k.softLimit100Reached());
        assertTrue(freeAt100k.hardStopExceeded());

        // Pro plan warns at 100% (5,000,000) and hard-stops at 120% (6,000,000)
        var proAt5m = entitlements.evaluateQuota(PlanTier.PRO, 5_000_000L);
        assertTrue(proAt5m.warning80Reached());
        assertTrue(proAt5m.softLimit100Reached());
        assertFalse(proAt5m.hardStopExceeded());

        var proAt6m = entitlements.evaluateQuota(PlanTier.PRO, 6_000_000L);
        assertTrue(proAt6m.hardStopExceeded());
    }

    @Test
    void euVatIdValidationAndPromoDiscountsWork() {
        assertTrue(Subscription.isValidEuVatId(null));
        assertTrue(Subscription.isValidEuVatId(""));
        assertTrue(Subscription.isValidEuVatId("BE0123456789"));
        assertTrue(Subscription.isValidEuVatId("be 0123.456.789"));
        assertTrue(Subscription.isValidEuVatId("DE123456789"));
        assertTrue(Subscription.isValidEuVatId("NL123456789B01"));
        assertFalse(Subscription.isValidEuVatId("INVALID"));
        assertFalse(Subscription.isValidEuVatId("1234567890"));
        assertFalse(Subscription.isValidEuVatId("B123"));

        assertEquals("BE0123456789", Subscription.normalizeVatId("be 0123.456.789"));

        EntitlementsService entitlements = new EntitlementsService();
        // Pro monthly = $29 = 2900 cents; with LAUNCH20 (-20%) = 2320 cents
        assertEquals(2900, entitlements.calculateInvoiceAmountCents(PlanTier.PRO, BillingInterval.MONTHLY, null));
        assertEquals(2320, entitlements.calculateInvoiceAmountCents(PlanTier.PRO, BillingInterval.MONTHLY, "launch20"));
        // Pro annual = $23 * 12 = $276 = 27600 cents; with FLOW50 (-50%) = 13800 cents
        assertEquals(27600, entitlements.calculateInvoiceAmountCents(PlanTier.PRO, BillingInterval.ANNUAL, null));
        assertEquals(13800, entitlements.calculateInvoiceAmountCents(PlanTier.PRO, BillingInterval.ANNUAL, "FLOW50"));
    }

    @Test
    void dunningGracePeriodAndWebhookHmacVerificationWork() {
        UUID orgId = UUID.randomUUID();
        Instant now = Instant.now();
        Subscription pastDue = new Subscription(
                orgId,
                "sandbox",
                "cus_123",
                "sub_123",
                PlanTier.PRO,
                BillingInterval.MONTHLY,
                SubscriptionStatus.PAST_DUE,
                now.minus(Duration.ofDays(15)),
                now.plus(Duration.ofDays(15)),
                false,
                now.plus(Duration.ofDays(7)),
                "Acme SRL",
                "BE",
                "BE0123456789",
                null,
                0,
                now
        );

        assertTrue(pastDue.isInGracePeriod(now.plus(Duration.ofDays(3))));
        assertFalse(pastDue.isGracePeriodExpired(now.plus(Duration.ofDays(3))));
        assertTrue(pastDue.isGracePeriodExpired(now.plus(Duration.ofDays(8))));

        StripeAndSandboxBillingAdapter adapter = new StripeAndSandboxBillingAdapter(
                new EntitlementsService(),
                java.util.Optional.empty(),
                "whsec_unit_test_secret"
        );
        String payload = "{\"id\":\"evt_123\",\"type\":\"invoice.paid\",\"organizationId\":\"" + orgId + "\"}";
        String sig = adapter.computeWebhookSignature(payload, now.getEpochSecond());
        assertTrue(adapter.verifyWebhookSignature(payload, sig));
        assertFalse(adapter.verifyWebhookSignature(payload, "t=123,v1=deadbeef"));
        assertFalse(adapter.verifyWebhookSignature(payload, null));
    }
}
