import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlowTraceApiService } from '../../core/api.service';
import {
  BillingInterval,
  BillingInvoice,
  OrganizationBillingOverview,
  OrganizationView,
  PlanCatalogEntry,
  PlanTier,
  SubscriptionStatus,
} from '../../core/models';

@Component({
  selector: 'app-billing-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <!-- Header & Interval Toggle -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2.5">
              <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Billing, Usage &amp; Plans</h1>
              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase"
                [class.bg-status-ok/15]="subscriptionStatus() === 'ACTIVE'"
                [class.text-status-ok]="subscriptionStatus() === 'ACTIVE'"
                [class.bg-status-warn/15]="subscriptionStatus() === 'PAST_DUE'"
                [class.text-status-warn]="subscriptionStatus() === 'PAST_DUE'"
                [class.bg-bg-3]="subscriptionStatus() === 'CANCELED'"
                [class.text-text-3]="subscriptionStatus() === 'CANCELED'"
              >
                {{ subscriptionStatus() }}
              </span>
            </div>
            <p class="text-sm text-text-3 mt-1">
              Predictable event-based pricing with a 120% soft-cap buffer on paid plans and zero surprise overage charges.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center p-1 rounded-xl bg-bg-2 border border-border-structural">
              <button
                type="button"
                (click)="annual.set(false)"
                class="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                [class.bg-bg-3]="!annual()"
                [class.text-text-1]="!annual()"
                [class.text-text-3]="annual()"
              >
                Monthly
              </button>
              <button
                type="button"
                (click)="annual.set(true)"
                class="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                [class.bg-bg-3]="annual()"
                [class.text-node-queue]="annual()"
                [class.text-text-3]="!annual()"
              >
                Annual (-20%)
              </button>
            </div>

            <button
              type="button"
              (click)="openCustomerPortal()"
              [disabled]="busyAction()"
              class="px-3 py-1.5 rounded-xl bg-bg-2 hover:bg-bg-3 border border-border-structural text-xs font-medium text-text-2 transition-colors disabled:opacity-50"
            >
              Customer Portal
            </button>

            <button
              type="button"
              (click)="resyncSubscription()"
              [disabled]="busyAction()"
              class="px-3 py-1.5 rounded-xl bg-bg-2 hover:bg-bg-3 border border-border-structural text-xs font-medium text-text-2 transition-colors disabled:opacity-50"
              title="Re-synchronize subscription state from billing provider"
            >
              Resync
            </button>
          </div>
        </div>

        <!-- 7-Day Dunning Grace Period Alert Banner -->
        @if (subscriptionStatus() === 'PAST_DUE') {
          <div class="rounded-2xl border border-status-warn/40 bg-status-warn/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-status-warn">
                Payment past due: 7-day grace period active
              </div>
              <p class="text-xs text-text-2">
                Your paid plan ({{ currentPlan() }}) remains active until
                <span class="font-code-block font-semibold">{{ formatDate(overview()?.subscription?.gracePeriodEndsAt) }}</span>.
                If unpaid after 7 days, the organization downgrades to Starter Free without deleting any projects or diagrams.
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="simulateWebhook('invoice.paid')"
                [disabled]="busyAction()"
                class="px-3 py-1.5 rounded-xl bg-status-ok text-bg-0 text-xs font-semibold"
              >
                Retry Payment Now
              </button>
              <button
                type="button"
                (click)="openCustomerPortal()"
                class="px-3 py-1.5 rounded-xl bg-bg-2 border border-border-structural text-xs font-medium text-text-1"
              >
                Update Card
              </button>
            </div>
          </div>
        }

        <!-- Status Toast Banner -->
        @if (statusMessage()) {
          <div class="rounded-xl border border-node-queue/40 bg-node-queue/10 px-4 py-2.5 text-xs text-text-1 flex items-center justify-between">
            <span>{{ statusMessage() }}</span>
            <button type="button" (click)="statusMessage.set(null)" class="text-text-3 hover:text-text-1">Dismiss</button>
          </div>
        }

        <!-- Current Plan, Quota Guard & Promo Bar -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-5">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="text-xs uppercase tracking-wider text-text-3">Current Subscription</div>
              <div class="flex items-center gap-3 mt-1">
                <span class="text-xl font-semibold text-text-1">{{ currentPlan() }}</span>
                <span class="text-xs text-text-3 font-code-block">
                  {{ overview()?.subscription?.billingInterval ?? 'MONTHLY' }}
                </span>
                @if ((overview()?.subscription?.discountPercent ?? 0) > 0) {
                  <span class="px-2 py-0.5 rounded-full bg-status-ok/15 text-status-ok text-[11px] font-semibold">
                    Promo {{ overview()?.subscription?.promoCode }} (-{{ overview()?.subscription?.discountPercent }}%)
                  </span>
                }
              </div>
              <div class="text-xs text-text-3 mt-1">
                Provider: <span class="font-code-block text-text-2">{{ overview()?.subscription?.provider ?? 'sandbox' }}</span>
                · Period ends <span class="font-code-block text-text-2">{{ formatDate(overview()?.subscription?.currentPeriodEnd) }}</span>
              </div>
            </div>

            <div class="text-left md:text-right">
              <div class="text-xs text-text-3">Events ingested this month</div>
              <div class="font-code-block text-lg font-semibold text-node-queue mt-0.5">
                {{ (overview()?.usage?.totalEventsThisMonth ?? 0).toLocaleString() }}
                / {{ (overview()?.quotaCheck?.monthlyQuota ?? 100000).toLocaleString() }}
              </div>
              <div class="text-[11px] text-text-3">
                Hard stop ceiling:
                <span class="font-code-block text-text-2">
                  {{ (overview()?.quotaCheck?.effectiveHardStopQuota ?? 100000).toLocaleString() }}
                </span>
                @if (currentPlan() !== 'FREE') {
                  <span>(includes 120% soft-cap buffer)</span>
                }
              </div>
            </div>
          </div>

          <!-- Progress bar with 80% / 100% / 120% markers -->
          <div class="space-y-1.5">
            <div class="w-full h-3 rounded-full bg-bg-3 overflow-hidden relative">
              <div
                class="h-full rounded-full transition-all"
                [class.bg-gradient-to-r]="!overview()?.quotaCheck?.hardStopExceeded"
                [class.from-node-queue]="!overview()?.quotaCheck?.hardStopExceeded"
                [class.to-node-service]="!overview()?.quotaCheck?.hardStopExceeded"
                [class.bg-status-err]="overview()?.quotaCheck?.hardStopExceeded"
                [style.width.%]="usagePct()"
              ></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-text-3 font-code-block">
              <span>0%</span>
              <span [class.text-status-warn]="overview()?.quotaCheck?.warning80Reached">80% warning</span>
              <span [class.text-status-warn]="overview()?.quotaCheck?.softLimit100Reached">100% plan quota</span>
              <span [class.text-status-err]="overview()?.quotaCheck?.hardStopExceeded">
                {{ currentPlan() === 'FREE' ? '100% hard stop' : '120% hard stop' }}
              </span>
            </div>
          </div>

          <!-- Promo Code Input -->
          <div class="pt-3 border-t border-border-structural/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="text-xs text-text-3">
              Have a startup or launch promo code? Enter it before switching plans (e.g. <code class="font-code-block text-text-2">LAUNCH20</code> or <code class="font-code-block text-text-2">FLOW50</code>).
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                [ngModel]="promoCode()"
                (ngModelChange)="promoCode.set($event)"
                placeholder="Promo code (e.g. LAUNCH20)"
                class="px-3 py-1.5 rounded-xl bg-bg-2 border border-border-structural text-xs font-code-block text-text-1 uppercase w-48"
              />
            </div>
          </div>
        </section>

        <!-- Plan Cards -->
        <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          @for (plan of plans; track plan.tier) {
            @let isCurrent = currentPlan() === plan.tier;
            <article
              class="rounded-2xl bg-bg-2 border p-5 flex flex-col justify-between gap-5"
              [class.border-node-queue]="isCurrent"
              [class.border-border-structural]="!isCurrent"
            >
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-text-1">{{ plan.name }}</span>
                  @if (isCurrent) {
                    <span class="px-2 py-0.5 rounded-full bg-node-queue/15 text-node-queue text-[10px] font-semibold">
                      CURRENT
                    </span>
                  }
                </div>
                <div class="text-2xl font-bold text-text-1 font-code-block">
                  \${{ annual() ? plan.annualPrice : plan.monthlyPrice }}
                  <span class="text-xs font-normal text-text-3">/mo</span>
                </div>
                <p class="text-xs text-text-3">{{ plan.subtitle }}</p>
                <ul class="space-y-1.5 text-xs text-text-2 pt-2 border-t border-border-structural/60">
                  @for (feat of plan.features; track feat) {
                    <li class="flex items-center gap-1.5">
                      <span class="text-status-ok font-bold">✓</span>
                      <span>{{ feat }}</span>
                    </li>
                  }
                </ul>
              </div>

              <button
                type="button"
                [disabled]="isCurrent || updatingTier() === plan.tier"
                (click)="switchPlan(plan.tier)"
                class="w-full py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                [class.bg-bg-3]="isCurrent"
                [class.text-text-2]="isCurrent"
                [class.bg-gradient-to-r]="!isCurrent"
                [class.from-node-queue]="!isCurrent"
                [class.to-node-service]="!isCurrent"
                [class.text-bg-0]="!isCurrent"
              >
                {{ isCurrent ? 'Active Plan' : (updatingTier() === plan.tier ? 'Updating...' : 'Switch to ' + plan.name) }}
              </button>
            </article>
          }
        </section>

        <!-- EU B2B VAT Profile & Invoices Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- EU B2B VAT & Company Billing Profile -->
          <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-semibold text-text-1">EU B2B Billing &amp; VAT Profile</h2>
                <p class="text-xs text-text-3 mt-0.5">
                  Used on invoices and for EU cross-border reverse-charge VAT validation.
                </p>
              </div>
              @if (overview()?.subscription?.vatId) {
                <span class="px-2 py-0.5 rounded-full bg-status-ok/15 text-status-ok text-[11px] font-code-block font-semibold">
                  VAT {{ overview()?.subscription?.vatId }}
                </span>
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="space-y-1 block">
                <span class="text-xs text-text-2">Company Name</span>
                <input
                  type="text"
                  [ngModel]="companyName()"
                  (ngModelChange)="companyName.set($event)"
                  placeholder="Acme SRL"
                  class="w-full px-3 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs text-text-1"
                />
              </label>

              <label class="space-y-1 block">
                <span class="text-xs text-text-2">Billing Email</span>
                <input
                  type="email"
                  [ngModel]="billingEmail()"
                  (ngModelChange)="billingEmail.set($event)"
                  placeholder="finance@company.eu"
                  class="w-full px-3 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs text-text-1"
                />
              </label>

              <label class="space-y-1 block">
                <span class="text-xs text-text-2">Country (ISO-2)</span>
                <input
                  type="text"
                  maxlength="2"
                  [ngModel]="billingCountry()"
                  (ngModelChange)="billingCountry.set($event)"
                  placeholder="BE"
                  class="w-full px-3 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs font-code-block uppercase text-text-1"
                />
              </label>

              <label class="space-y-1 block">
                <span class="text-xs text-text-2">EU VAT ID</span>
                <input
                  type="text"
                  [ngModel]="vatId()"
                  (ngModelChange)="vatId.set($event)"
                  placeholder="BE0123456789"
                  class="w-full px-3 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs font-code-block uppercase text-text-1"
                />
              </label>
            </div>

            @if (profileError()) {
              <div class="text-xs text-status-err">{{ profileError() }}</div>
            }

            <div class="flex items-center justify-end">
              <button
                type="button"
                (click)="saveBillingProfile()"
                [disabled]="busyAction()"
                class="px-4 py-2 rounded-xl bg-node-queue text-bg-0 text-xs font-semibold disabled:opacity-50"
              >
                Save Billing Profile
              </button>
            </div>
          </section>

          <!-- Invoices History -->
          <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-4">
            <div>
              <h2 class="text-base font-semibold text-text-1">Invoices &amp; Receipts</h2>
              <p class="text-xs text-text-3 mt-0.5">
                Immutable billing ledger synchronized from Checkout and webhook events.
              </p>
            </div>

            @if ((overview()?.invoices?.length ?? 0) === 0) {
              <div class="py-8 text-center text-xs text-text-3 border border-dashed border-border-structural rounded-xl">
                No invoices issued yet for this organization.
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                  <thead>
                    <tr class="border-b border-border-structural text-text-3">
                      <th class="pb-2 font-medium">Date</th>
                      <th class="pb-2 font-medium">Plan</th>
                      <th class="pb-2 font-medium">Amount</th>
                      <th class="pb-2 font-medium">Status</th>
                      <th class="pb-2 font-medium text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-border-structural/50">
                    @for (inv of overview()?.invoices ?? []; track inv.id) {
                      <tr>
                        <td class="py-2.5 font-code-block text-text-2">{{ formatDate(inv.createdAt) }}</td>
                        <td class="py-2.5 text-text-1">{{ inv.planTier }} ({{ inv.billingInterval }})</td>
                        <td class="py-2.5 font-code-block text-text-1">
                          \${{ (inv.amountCents / 100).toFixed(2) }} {{ inv.currency }}
                        </td>
                        <td class="py-2.5">
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            [class.bg-status-ok/15]="inv.status === 'PAID'"
                            [class.text-status-ok]="inv.status === 'PAID'"
                            [class.bg-status-warn/15]="inv.status !== 'PAID'"
                            [class.text-status-warn]="inv.status !== 'PAID'"
                          >
                            {{ inv.status }}
                          </span>
                        </td>
                        <td class="py-2.5 text-right">
                          <a
                            [href]="inv.invoicePdfUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-node-queue hover:underline font-code-block"
                          >
                            PDF
                          </a>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        </div>

        <!-- Sandbox Webhook Simulator (Developer / QA Verification Bar) -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div class="text-xs font-semibold uppercase tracking-wider text-text-2">
              Signed Webhook Simulator (HMAC-SHA256)
            </div>
            <p class="text-xs text-text-3 mt-0.5">
              Dispatch a signed Stripe-compatible webhook event to test dunning grace periods and subscription transitions.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="simulateWebhook('invoice.payment_failed')"
              [disabled]="busyAction()"
              class="px-3 py-1.5 rounded-xl bg-status-warn/15 text-status-warn border border-status-warn/30 text-xs font-medium disabled:opacity-50"
            >
              Simulate Payment Failed (7d Grace)
            </button>
            <button
              type="button"
              (click)="simulateWebhook('invoice.paid')"
              [disabled]="busyAction()"
              class="px-3 py-1.5 rounded-xl bg-status-ok/15 text-status-ok border border-status-ok/30 text-xs font-medium disabled:opacity-50"
            >
              Simulate Invoice Paid
            </button>
            <button
              type="button"
              (click)="simulateWebhook('customer.subscription.deleted')"
              [disabled]="busyAction()"
              class="px-3 py-1.5 rounded-xl bg-bg-2 hover:bg-bg-3 border border-border-structural text-xs font-medium text-text-2 disabled:opacity-50"
            >
              Simulate Cancel to Free
            </button>
          </div>
        </section>
      </div>
    </div>
  `,
})
export class BillingPageComponent implements OnInit {
  private readonly api = inject(FlowTraceApiService);

  public readonly org = signal<OrganizationView | null>(null);
  public readonly overview = signal<OrganizationBillingOverview | null>(null);
  public readonly annual = signal(false);
  public readonly updatingTier = signal<PlanTier | null>(null);
  public readonly busyAction = signal(false);
  public readonly promoCode = signal('');
  public readonly companyName = signal('');
  public readonly billingEmail = signal('');
  public readonly billingCountry = signal('BE');
  public readonly vatId = signal('');
  public readonly profileError = signal<string | null>(null);
  public readonly statusMessage = signal<string | null>(null);

  public readonly currentPlan = computed<PlanTier>(
    () =>
      this.overview()?.subscription?.planTier ??
      this.org()?.organization.planTier ??
      this.overview()?.usage?.planTier ??
      'FREE'
  );

  public readonly subscriptionStatus = computed<SubscriptionStatus>(
    () => this.overview()?.subscription?.status ?? 'ACTIVE'
  );

  public readonly usagePct = computed(() =>
    Math.min(100, Math.round((this.overview()?.quotaCheck?.percentUsed ?? 0) * 10) / 10)
  );

  public readonly plans: Array<{
    tier: PlanTier;
    name: string;
    monthlyPrice: number;
    annualPrice: number;
    subtitle: string;
    features: string[];
  }> = [
    {
      tier: 'FREE',
      name: 'Starter Free',
      monthlyPrice: 0,
      annualPrice: 0,
      subtitle: 'For side projects and local evaluation.',
      features: ['100k events / month', '3 days trace retention', '25 blocks per diagram', 'Standard & Shop packs'],
    },
    {
      tier: 'PRO',
      name: 'Pro Mesh',
      monthlyPrice: 29,
      annualPrice: 23,
      subtitle: 'For growing SaaS and microservices.',
      features: ['5M events / month (120% soft cap)', '14 days trace retention', '100 blocks per diagram', 'All 7 packs + My blocks'],
    },
    {
      tier: 'BUSINESS',
      name: 'Business Ops',
      monthlyPrice: 99,
      annualPrice: 79,
      subtitle: 'High-volume production & CRO shops.',
      features: ['25M events / month (120% soft cap)', '30 days trace retention', '500 blocks & unlimited seats', 'EU B2B VAT & Webhooks'],
    },
    {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      monthlyPrice: 299,
      annualPrice: 239,
      subtitle: 'Dedicated throughput and custom SLA.',
      features: ['100M+ events / month (120% soft cap)', '90 days trace retention', '1,000 blocks per diagram', 'Priority SLA & Audit export'],
    },
  ];

  public async ngOnInit(): Promise<void> {
    try {
      const orgs = await this.api.listOrganizations();
      if (orgs.length > 0) {
        this.org.set(orgs[0]);
        await this.loadOverview(orgs[0].organization.id);
      }
    } catch {
      // Ignore transient bootstrap errors
    }
  }

  private async loadOverview(orgId: string): Promise<void> {
    const data = await this.api.getOrganizationBilling(orgId);
    this.applyOverview(data);
  }

  private applyOverview(data: OrganizationBillingOverview): void {
    this.overview.set(data);
    this.annual.set(data.subscription.billingInterval === 'ANNUAL');
    this.companyName.set(data.subscription.companyName ?? data.organization.name ?? '');
    this.billingEmail.set(data.organization.billingEmail ?? '');
    this.billingCountry.set(data.subscription.billingCountry ?? 'BE');
    this.vatId.set(data.subscription.vatId ?? '');
  }

  public async switchPlan(tier: PlanTier): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.updatingTier.set(tier);
    this.profileError.set(null);
    try {
      const interval: BillingInterval = this.annual() ? 'ANNUAL' : 'MONTHLY';
      const result = await this.api.createCheckoutSession(orgId, {
        planTier: tier,
        billingInterval: interval,
        promoCode: this.promoCode().trim() || undefined,
        returnUrl: typeof window !== 'undefined' ? window.location.href : 'http://localhost:4200/billing',
      });
      this.applyOverview(result.overview);
      this.statusMessage.set(
        `Switched subscription to ${tier} (${interval})` +
          (result.checkout.discountPercent > 0 ? ` with ${result.checkout.discountPercent}% promo discount.` : '.')
      );
    } finally {
      this.updatingTier.set(null);
    }
  }

  public async saveBillingProfile(): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.busyAction.set(true);
    this.profileError.set(null);
    try {
      const updated = await this.api.updateBillingProfile(orgId, {
        companyName: this.companyName(),
        billingEmail: this.billingEmail(),
        billingCountry: this.billingCountry(),
        vatId: this.vatId(),
      });
      this.applyOverview(updated);
      this.statusMessage.set('Billing & EU VAT profile saved.');
    } catch (err: any) {
      this.profileError.set(err?.message ?? 'Invalid EU VAT ID format.');
    } finally {
      this.busyAction.set(false);
    }
  }

  public async openCustomerPortal(): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.busyAction.set(true);
    try {
      const res = await this.api.createCustomerPortalSession(
        orgId,
        typeof window !== 'undefined' ? window.location.href : 'http://localhost:4200/billing'
      );
      this.statusMessage.set(`Customer portal session ready (${res.provider}): ${res.portalUrl}`);
    } finally {
      this.busyAction.set(false);
    }
  }

  public async resyncSubscription(): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.busyAction.set(true);
    try {
      const updated = await this.api.resyncSubscription(orgId);
      this.applyOverview(updated);
      this.statusMessage.set('Subscription state synchronized with billing provider.');
    } finally {
      this.busyAction.set(false);
    }
  }

  public async simulateWebhook(eventType: string): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.busyAction.set(true);
    try {
      const updated = await this.api.simulateBillingWebhook(orgId, {
        eventType,
        planTier: this.currentPlan(),
        billingInterval: this.annual() ? 'ANNUAL' : 'MONTHLY',
      });
      this.applyOverview(updated);
      this.statusMessage.set(`Processed signed webhook event: ${eventType}`);
    } finally {
      this.busyAction.set(false);
    }
  }

  public formatDate(iso?: string | null): string {
    if (!iso) return 'N/A';
    try {
      return new Date(iso).toISOString().slice(0, 10);
    } catch {
      return iso;
    }
  }
}
