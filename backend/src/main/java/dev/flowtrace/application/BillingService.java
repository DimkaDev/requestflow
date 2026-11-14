package dev.flowtrace.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.flowtrace.application.port.out.AuditLogRepository;
import dev.flowtrace.application.port.out.BillingProviderPort;
import dev.flowtrace.application.port.out.OrganizationRepository;
import dev.flowtrace.domain.BillingInterval;
import dev.flowtrace.domain.BillingInvoice;
import dev.flowtrace.domain.OrgPermission;
import dev.flowtrace.domain.Organization;
import dev.flowtrace.domain.OrganizationUsage;
import dev.flowtrace.domain.PlanCatalogEntry;
import dev.flowtrace.domain.PlanTier;
import dev.flowtrace.domain.Subscription;
import dev.flowtrace.domain.SubscriptionStatus;
import dev.flowtrace.domain.ValidationException;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotAuthorizedException;
import java.time.Duration;
import java.time.Instant;
import java.time.YearMonth;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Commercial Billing, Subscriptions, 7-Day Dunning Grace Period, and B2B VAT Profile Use Case (Epic E3 / ADR-0011).
 */
@ApplicationScoped
public class BillingService {

    public record OrganizationBillingOverview(
            Organization organization,
            Subscription subscription,
            OrganizationUsage usage,
            EntitlementsService.QuotaCheckResult quotaCheck,
            List<BillingInvoice> invoices,
            List<PlanCatalogEntry> availablePlans
    ) {
    }

    public record CheckoutOutcome(
            BillingProviderPort.CheckoutSessionResult checkout,
            OrganizationBillingOverview overview
    ) {
    }

    public record WebhookProcessOutcome(
            boolean processed,
            boolean duplicate,
            String eventId,
            String eventType,
            Subscription subscription
    ) {
    }

    private final OrganizationRepository organizationRepository;
    private final OrganizationService organizationService;
    private final EntitlementsService entitlementsService;
    private final UsageMeterService usageMeterService;
    private final BillingProviderPort billingProviderPort;
    private final AuditLogRepository auditLogRepository;
    private final IngestEventUseCase ingestEventUseCase;
    private final ObjectMapper objectMapper;

    @Inject
    public BillingService(
            OrganizationRepository organizationRepository,
            OrganizationService organizationService,
            EntitlementsService entitlementsService,
            UsageMeterService usageMeterService,
            BillingProviderPort billingProviderPort,
            AuditLogRepository auditLogRepository,
            IngestEventUseCase ingestEventUseCase,
            ObjectMapper objectMapper
    ) {
        this.organizationRepository = organizationRepository;
        this.organizationService = organizationService;
        this.entitlementsService = entitlementsService;
        this.usageMeterService = usageMeterService;
        this.billingProviderPort = billingProviderPort;
        this.auditLogRepository = auditLogRepository;
        this.ingestEventUseCase = ingestEventUseCase;
        this.objectMapper = objectMapper;
    }

    public List<PlanCatalogEntry> listPlans() {
        return entitlementsService.listPlans();
    }

    public Subscription getOrInitSubscription(UUID organizationId) {
        Organization org = organizationService.requireActiveOrganization(organizationId);
        return organizationRepository.findSubscription(organizationId)
                .orElseGet(() -> {
                    Instant now = Instant.now();
                    Subscription initial = new Subscription(
                            organizationId,
                            billingProviderPort.providerName(),
                            "cus_" + organizationId.toString().substring(0, 8),
                            "sub_" + organizationId.toString().substring(0, 8),
                            org.planTier(),
                            BillingInterval.MONTHLY,
                            SubscriptionStatus.ACTIVE,
                            now,
                            now.plus(Duration.ofDays(30)),
                            false,
                            null,
                            org.name(),
                            null,
                            null,
                            null,
                            0,
                            now
                    );
                    return organizationRepository.upsertSubscription(initial);
                });
    }

    public OrganizationBillingOverview getBillingOverview(UUID userId, UUID organizationId) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.ORG_VIEW);
        Organization org = organizationService.requireActiveOrganization(organizationId);
        Subscription sub = getOrInitSubscription(organizationId);
        OrganizationUsage usage = usageMeterService.getOrganizationUsage(organizationId, YearMonth.now(), org.planTier());
        EntitlementsService.QuotaCheckResult quotaCheck = entitlementsService.evaluateQuota(org.planTier(), usage.totalEventsThisMonth());
        List<BillingInvoice> invoices = organizationRepository.listInvoices(organizationId);
        return new OrganizationBillingOverview(
                org,
                sub,
                usage,
                quotaCheck,
                invoices,
                entitlementsService.listPlans()
        );
    }

    public CheckoutOutcome createCheckoutSession(
            UUID userId,
            UUID organizationId,
            String targetTierStr,
            String intervalStr,
            String promoCode,
            String returnUrl
    ) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.BILLING_MANAGE);
        Organization org = organizationService.requireActiveOrganization(organizationId);
        Subscription currentSub = getOrInitSubscription(organizationId);

        PlanTier targetTier = PlanTier.fromString(targetTierStr != null ? targetTierStr : PlanTier.PRO.name());
        BillingInterval interval = BillingInterval.fromString(intervalStr);
        String cleanPromo = (promoCode != null && !promoCode.isBlank())
                ? promoCode.trim().toUpperCase(Locale.ROOT)
                : null;

        BillingProviderPort.CheckoutSessionResult checkout = billingProviderPort.createCheckoutSession(
                organizationId,
                org.billingEmail(),
                targetTier,
                interval,
                cleanPromo,
                returnUrl
        );

        if (checkout.sandboxImmediateApplied() || targetTier == PlanTier.FREE) {
            Instant now = Instant.now();
            Duration periodDuration = interval == BillingInterval.ANNUAL ? Duration.ofDays(365) : Duration.ofDays(30);
            Subscription updatedSub = new Subscription(
                    organizationId,
                    checkout.provider(),
                    currentSub.providerCustomerId(),
                    "sub_" + organizationId.toString().substring(0, 8) + "_" + targetTier.name().toLowerCase(Locale.ROOT),
                    targetTier,
                    interval,
                    SubscriptionStatus.ACTIVE,
                    now,
                    now.plus(periodDuration),
                    false,
                    null,
                    currentSub.companyName(),
                    currentSub.billingCountry(),
                    currentSub.vatId(),
                    cleanPromo,
                    checkout.discountPercent(),
                    now
            );
            organizationRepository.upsertSubscription(updatedSub);
            organizationRepository.updateOrganization(organizationId, null, null, null, targetTier);
            ingestEventUseCase.evictKeyCache();

            if (checkout.amountCents() > 0) {
                String invId = "in_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
                organizationRepository.createInvoice(new BillingInvoice(
                        UUID.randomUUID(),
                        organizationId,
                        invId,
                        targetTier,
                        interval,
                        checkout.amountCents(),
                        "USD",
                        "PAID",
                        "https://pay.flowtrace.dev/invoices/" + invId + ".pdf",
                        now
                ));
            }

            recordAudit(
                    organizationId,
                    userId,
                    "billing.subscription.updated",
                    "subscription",
                    updatedSub.providerSubscriptionId(),
                    Map.of(
                            "planTier", targetTier.name(),
                            "billingInterval", interval.name(),
                            "amountCents", checkout.amountCents(),
                            "discountPercent", checkout.discountPercent()
                    )
            );
        }

        return new CheckoutOutcome(checkout, getBillingOverview(userId, organizationId));
    }

    public BillingProviderPort.PortalSessionResult createCustomerPortalSession(
            UUID userId,
            UUID organizationId,
            String returnUrl
    ) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.BILLING_MANAGE);
        Subscription sub = getOrInitSubscription(organizationId);
        return billingProviderPort.createCustomerPortalSession(
                organizationId,
                sub.providerCustomerId(),
                returnUrl
        );
    }

    public OrganizationBillingOverview updateBillingProfile(
            UUID userId,
            UUID organizationId,
            String companyName,
            String billingEmail,
            String billingCountry,
            String vatId
    ) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.BILLING_MANAGE);
        if (!Subscription.isValidEuVatId(vatId)) {
            throw new BadRequestException(
                    "Invalid EU VAT ID format. Expected 2-letter country prefix followed by 8-12 alphanumeric characters (e.g. BE0123456789)."
            );
        }
        String normalizedVat = Subscription.normalizeVatId(vatId);
        String cleanCompany = (companyName != null && !companyName.isBlank()) ? companyName.trim() : null;
        String cleanCountry = (billingCountry != null && !billingCountry.isBlank())
                ? billingCountry.trim().toUpperCase(Locale.ROOT)
                : null;
        String cleanEmail = (billingEmail != null && !billingEmail.isBlank()) ? billingEmail.trim() : null;

        if (cleanEmail != null) {
            organizationRepository.updateOrganization(organizationId, null, null, cleanEmail, null);
        }

        Subscription current = getOrInitSubscription(organizationId);
        Subscription updated = new Subscription(
                organizationId,
                current.provider(),
                current.providerCustomerId(),
                current.providerSubscriptionId(),
                current.planTier(),
                current.billingInterval(),
                current.status(),
                current.currentPeriodStart(),
                current.currentPeriodEnd(),
                current.cancelAtPeriodEnd(),
                current.gracePeriodEndsAt(),
                cleanCompany != null ? cleanCompany : current.companyName(),
                cleanCountry != null ? cleanCountry : current.billingCountry(),
                normalizedVat,
                current.promoCode(),
                current.discountPercent(),
                Instant.now()
        );
        organizationRepository.upsertSubscription(updated);

        recordAudit(
                organizationId,
                userId,
                "billing.profile.updated",
                "subscription",
                organizationId.toString(),
                Map.of(
                        "companyName", updated.companyName() != null ? updated.companyName() : "",
                        "billingCountry", updated.billingCountry() != null ? updated.billingCountry() : "",
                        "vatId", updated.vatId() != null ? updated.vatId() : ""
                )
        );
        return getBillingOverview(userId, organizationId);
    }

    public OrganizationBillingOverview resyncSubscription(UUID userId, UUID organizationId) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.BILLING_MANAGE);
        Subscription local = getOrInitSubscription(organizationId);
        Subscription synced = billingProviderPort.fetchProviderSubscriptionState(local);
        organizationRepository.upsertSubscription(synced);
        organizationRepository.updateOrganization(organizationId, null, null, null, synced.planTier());
        ingestEventUseCase.evictKeyCache();
        recordAudit(
                organizationId,
                userId,
                "billing.subscription.resynced",
                "subscription",
                synced.providerSubscriptionId(),
                Map.of("planTier", synced.planTier().name(), "status", synced.status().name())
        );
        return getBillingOverview(userId, organizationId);
    }

    public WebhookProcessOutcome handleWebhook(String rawPayload, String signatureHeader) {
        if (!billingProviderPort.verifyWebhookSignature(rawPayload, signatureHeader)) {
            throw new NotAuthorizedException("Invalid Stripe-Signature webhook signature");
        }
        if (rawPayload == null || rawPayload.isBlank()) {
            throw new BadRequestException("Webhook payload cannot be empty");
        }

        try {
            JsonNode root = objectMapper.readTree(rawPayload);
            String eventId = root.hasNonNull("id") ? root.get("id").asText()
                    : (root.hasNonNull("eventId") ? root.get("eventId").asText() : "evt_" + UUID.randomUUID());
            String eventType = root.hasNonNull("type") ? root.get("type").asText()
                    : (root.hasNonNull("eventType") ? root.get("eventType").asText() : "unknown");

            JsonNode dataObj = root.has("data") && root.get("data").has("object")
                    ? root.get("data").get("object")
                    : root;

            String orgIdStr = extractText(dataObj, "organizationId", "client_reference_id");
            if (orgIdStr == null && dataObj.has("metadata") && dataObj.get("metadata").hasNonNull("organizationId")) {
                orgIdStr = dataObj.get("metadata").get("organizationId").asText();
            }
            if (orgIdStr == null || orgIdStr.isBlank()) {
                throw new BadRequestException("Webhook payload missing organizationId");
            }
            UUID organizationId = UUID.fromString(orgIdStr.trim());
            Instant now = Instant.now();

            boolean firstTime = organizationRepository.tryRecordWebhookEvent(eventId, organizationId, eventType, now);
            Subscription current = getOrInitSubscription(organizationId);
            if (!firstTime) {
                return new WebhookProcessOutcome(false, true, eventId, eventType, current);
            }

            String tierStr = extractText(dataObj, "planTier", "tier");
            PlanTier targetTier = tierStr != null ? PlanTier.fromString(tierStr) : current.planTier();
            String intervalStr = extractText(dataObj, "billingInterval", "interval");
            BillingInterval interval = intervalStr != null ? BillingInterval.fromString(intervalStr) : current.billingInterval();
            String promoCode = extractText(dataObj, "promoCode", "coupon");
            String finalPromo = promoCode != null ? promoCode.toUpperCase(Locale.ROOT) : current.promoCode();
            int discountPct = Subscription.resolvePromoDiscountPercent(finalPromo);

            Subscription updated;
            switch (eventType) {
                case "checkout.session.completed", "customer.subscription.updated", "invoice.paid" -> {
                    Duration periodDuration = interval == BillingInterval.ANNUAL ? Duration.ofDays(365) : Duration.ofDays(30);
                    updated = new Subscription(
                            organizationId,
                            current.provider(),
                            current.providerCustomerId(),
                            current.providerSubscriptionId(),
                            targetTier,
                            interval,
                            SubscriptionStatus.ACTIVE,
                            now,
                            now.plus(periodDuration),
                            false,
                            null,
                            current.companyName(),
                            current.billingCountry(),
                            current.vatId(),
                            finalPromo,
                            discountPct,
                            now
                    );
                    organizationRepository.upsertSubscription(updated);
                    organizationRepository.updateOrganization(organizationId, null, null, null, targetTier);
                    ingestEventUseCase.evictKeyCache();

                    int amountCents = entitlementsService.calculateInvoiceAmountCents(targetTier, interval, finalPromo);
                    if (amountCents > 0) {
                        String invId = "in_" + eventId.replaceAll("[^a-zA-Z0-9]", "");
                        organizationRepository.createInvoice(new BillingInvoice(
                                UUID.randomUUID(),
                                organizationId,
                                invId,
                                targetTier,
                                interval,
                                amountCents,
                                "USD",
                                "PAID",
                                "https://pay.flowtrace.dev/invoices/" + invId + ".pdf",
                                now
                        ));
                    }
                }
                case "invoice.payment_failed" -> {
                    Instant graceEnds = now.plus(Duration.ofDays(7));
                    updated = new Subscription(
                            organizationId,
                            current.provider(),
                            current.providerCustomerId(),
                            current.providerSubscriptionId(),
                            current.planTier(),
                            current.billingInterval(),
                            SubscriptionStatus.PAST_DUE,
                            current.currentPeriodStart(),
                            current.currentPeriodEnd(),
                            current.cancelAtPeriodEnd(),
                            graceEnds,
                            current.companyName(),
                            current.billingCountry(),
                            current.vatId(),
                            current.promoCode(),
                            current.discountPercent(),
                            now
                    );
                    organizationRepository.upsertSubscription(updated);
                    int amountCents = entitlementsService.calculateInvoiceAmountCents(
                            current.planTier(),
                            current.billingInterval(),
                            current.promoCode()
                    );
                    String invId = "in_failed_" + eventId.replaceAll("[^a-zA-Z0-9]", "");
                    organizationRepository.createInvoice(new BillingInvoice(
                            UUID.randomUUID(),
                            organizationId,
                            invId,
                            current.planTier(),
                            current.billingInterval(),
                            amountCents,
                            "USD",
                            "PAST_DUE",
                            "https://pay.flowtrace.dev/invoices/" + invId + ".pdf",
                            now
                    ));
                }
                case "customer.subscription.deleted" -> {
                    updated = new Subscription(
                            organizationId,
                            current.provider(),
                            current.providerCustomerId(),
                            current.providerSubscriptionId(),
                            PlanTier.FREE,
                            BillingInterval.MONTHLY,
                            SubscriptionStatus.CANCELED,
                            now,
                            now.plus(Duration.ofDays(30)),
                            false,
                            null,
                            current.companyName(),
                            current.billingCountry(),
                            current.vatId(),
                            null,
                            0,
                            now
                    );
                    organizationRepository.upsertSubscription(updated);
                    organizationRepository.updateOrganization(organizationId, null, null, null, PlanTier.FREE);
                    ingestEventUseCase.evictKeyCache();
                }
                default -> updated = current;
            }

            recordAudit(
                    organizationId,
                    null,
                    "billing.webhook." + eventType,
                    "subscription",
                    eventId,
                    Map.of(
                            "eventType", eventType,
                            "planTier", updated.planTier().name(),
                            "status", updated.status().name()
                    )
            );
            return new WebhookProcessOutcome(true, false, eventId, eventType, updated);
        } catch (ValidationException | IllegalArgumentException e) {
            throw new BadRequestException("Invalid webhook payload: " + e.getMessage());
        } catch (NotAuthorizedException | BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Failed to parse webhook payload: " + e.getMessage());
        }
    }

    public OrganizationBillingOverview simulateSandboxWebhook(
            UUID userId,
            UUID organizationId,
            String eventType,
            String targetTierStr,
            String intervalStr
    ) {
        organizationService.requirePermission(organizationId, userId, OrgPermission.BILLING_MANAGE);
        Subscription current = getOrInitSubscription(organizationId);
        String cleanEventType = (eventType != null && !eventType.isBlank())
                ? eventType.trim()
                : "invoice.payment_failed";
        PlanTier tier = (targetTierStr != null && !targetTierStr.isBlank())
                ? PlanTier.fromString(targetTierStr)
                : current.planTier();
        BillingInterval interval = (intervalStr != null && !intervalStr.isBlank())
                ? BillingInterval.fromString(intervalStr)
                : current.billingInterval();

        String eventId = "evt_sim_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String payload = String.format(
                "{\"id\":\"%s\",\"type\":\"%s\",\"organizationId\":\"%s\",\"planTier\":\"%s\",\"billingInterval\":\"%s\"}",
                eventId,
                cleanEventType,
                organizationId,
                tier.name(),
                interval.name()
        );
        String sig = billingProviderPort.computeWebhookSignature(payload, Instant.now().getEpochSecond());
        handleWebhook(payload, sig);
        return getBillingOverview(userId, organizationId);
    }

    @Scheduled(every = "1h", concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void scheduledExpirePastDueSubscriptions() {
        expirePastDueSubscriptions(Instant.now());
    }

    /**
     * Evaluates all PAST_DUE subscriptions whose 7-day dunning grace window has elapsed,
     * downgrading them to FREE (status = CANCELED) while preserving all projects and diagrams.
     */
    public int expirePastDueSubscriptions(Instant cutoff) {
        Instant checkTime = cutoff != null ? cutoff : Instant.now();
        List<Subscription> expired = organizationRepository.findPastDueSubscriptionsExpiredBefore(checkTime);
        for (Subscription sub : expired) {
            Subscription downgraded = new Subscription(
                    sub.organizationId(),
                    sub.provider(),
                    sub.providerCustomerId(),
                    sub.providerSubscriptionId(),
                    PlanTier.FREE,
                    BillingInterval.MONTHLY,
                    SubscriptionStatus.CANCELED,
                    checkTime,
                    checkTime.plus(Duration.ofDays(30)),
                    false,
                    null,
                    sub.companyName(),
                    sub.billingCountry(),
                    sub.vatId(),
                    null,
                    0,
                    checkTime
            );
            organizationRepository.upsertSubscription(downgraded);
            organizationRepository.updateOrganization(sub.organizationId(), null, null, null, PlanTier.FREE);
            recordAudit(
                    sub.organizationId(),
                    null,
                    "billing.dunning.downgraded_to_free",
                    "subscription",
                    sub.providerSubscriptionId(),
                    Map.of(
                            "previousPlanTier", sub.planTier().name(),
                            "newPlanTier", PlanTier.FREE.name(),
                            "gracePeriodEndedAt", sub.gracePeriodEndsAt() != null ? sub.gracePeriodEndsAt().toString() : ""
                    )
            );
        }
        if (!expired.isEmpty()) {
            ingestEventUseCase.evictKeyCache();
        }
        return expired.size();
    }

    private static String extractText(JsonNode node, String primaryField, String fallbackField) {
        if (node == null) {
            return null;
        }
        if (node.hasNonNull(primaryField)) {
            return node.get(primaryField).asText();
        }
        if (fallbackField != null && node.hasNonNull(fallbackField)) {
            return node.get(fallbackField).asText();
        }
        return null;
    }

    private void recordAudit(
            UUID organizationId,
            UUID actorUserId,
            String action,
            String targetType,
            String targetId,
            Map<String, Object> meta
    ) {
        if (auditLogRepository == null || organizationId == null) {
            return;
        }
        auditLogRepository.append(organizationId, actorUserId, null, action, targetType, targetId, meta);
    }
}
