package dev.flowtrace.application;

import dev.flowtrace.domain.BillingInterval;
import dev.flowtrace.domain.PlanCatalogEntry;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Subscription;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Arrays;
import java.util.List;

/**
 * Declarative Entitlements Engine (E3-Step-2 / DEC-02).
 * Centralizes plan catalog metadata, quota checks, 120% soft-cap evaluation,
 * pack access checks, and pricing calculations with promo codes.
 */
@ApplicationScoped
public class EntitlementsService {

    public record QuotaCheckResult(
            PlanTier tier,
            long monthlyQuota,
            long effectiveHardStopQuota,
            long currentEvents,
            double percentUsed,
            boolean warning80Reached,
            boolean softLimit100Reached,
            boolean hardStopExceeded
    ) {
    }

    public List<PlanCatalogEntry> listPlans() {
        return Arrays.stream(PlanTier.values())
                .map(PlanTier::toCatalogEntry)
                .toList();
    }

    public PlanCatalogEntry getPlanCatalogEntry(PlanTier tier) {
        return (tier != null ? tier : PlanTier.FREE).toCatalogEntry();
    }

    public QuotaCheckResult evaluateQuota(PlanTier rawTier, long currentEvents) {
        PlanTier tier = rawTier != null ? rawTier : PlanTier.FREE;
        long quota = tier.monthlyEventQuota();
        long hardStop = tier.effectiveHardStopQuota();
        double pct = quota > 0 ? Math.round(((double) currentEvents / quota) * 1000.0) / 10.0 : 0.0;
        boolean warn80 = quota > 0 && currentEvents >= Math.round(quota * 0.80);
        boolean soft100 = quota > 0 && currentEvents >= quota;
        boolean hardExceeded = hardStop > 0 && currentEvents >= hardStop;
        return new QuotaCheckResult(
                tier,
                quota,
                hardStop,
                currentEvents,
                pct,
                warn80,
                soft100,
                hardExceeded
        );
    }

    public boolean canUsePack(PlanTier rawTier, String packId) {
        if (packId == null || packId.isBlank()) {
            return true;
        }
        PlanTier tier = rawTier != null ? rawTier : PlanTier.FREE;
        return tier.allowedPacks().contains(packId.trim().toLowerCase());
    }

    public int calculateInvoiceAmountCents(PlanTier rawTier, BillingInterval rawInterval, String promoCode) {
        PlanTier tier = rawTier != null ? rawTier : PlanTier.FREE;
        BillingInterval interval = rawInterval != null ? rawInterval : BillingInterval.MONTHLY;
        int baseUsd = interval == BillingInterval.ANNUAL
                ? tier.annualMonthlyPriceUsd() * 12
                : tier.monthlyPriceUsd();
        int discountPct = Subscription.resolvePromoDiscountPercent(promoCode);
        int baseCents = baseUsd * 100;
        if (discountPct <= 0) {
            return baseCents;
        }
        return Math.max(0, Math.round(baseCents * (100 - discountPct) / 100.0f));
    }
}
