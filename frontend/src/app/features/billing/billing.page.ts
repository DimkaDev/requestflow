import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FlowTraceApiService } from '../../core/api.service';
import { OrganizationUsage, OrganizationView, PlanTier } from '../../core/models';

@Component({
  selector: 'app-billing-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Billing, Usage &amp; Plans</h1>
            <p class="text-sm text-text-3 mt-1">
              Simple, predictable event-based pricing for live topology monitoring.
            </p>
          </div>
          <div class="flex items-center p-1 rounded-xl bg-bg-2 border border-border-structural">
            <button
              type="button"
              (click)="annual.set(false)"
              class="px-3 py-1 rounded-lg text-xs font-medium"
              [class.bg-bg-3]="!annual()"
              [class.text-text-1]="!annual()"
              [class.text-text-3]="annual()"
            >
              Monthly
            </button>
            <button
              type="button"
              (click)="annual.set(true)"
              class="px-3 py-1 rounded-lg text-xs font-medium"
              [class.bg-bg-3]="annual()"
              [class.text-node-queue]="annual()"
              [class.text-text-3]="!annual()"
            >
              Annual (-20%)
            </button>
          </div>
        </div>

        <!-- Current Usage Card -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs uppercase tracking-wider text-text-3">Current Plan</div>
              <div class="text-xl font-semibold text-text-1 mt-0.5">{{ currentPlan() }}</div>
            </div>
            <div class="text-right">
              <div class="text-xs text-text-3">Events this month</div>
              <div class="font-code-block text-lg font-semibold text-node-queue">
                {{ (usage()?.totalEventsThisMonth ?? 0).toLocaleString() }} / {{ (usage()?.monthlyQuota ?? 100000).toLocaleString() }}
              </div>
            </div>
          </div>

          <div class="w-full h-2.5 rounded-full bg-bg-3 overflow-hidden">
            <div
              class="h-full rounded-full bg-gradient-to-r from-node-queue to-node-service transition-all"
              [style.width.%]="usagePct()"
            ></div>
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
                <div class="text-2xl font-bold text-text-1">
                  \${{ annual() ? plan.annualPrice : plan.monthlyPrice }}
                  <span class="text-xs font-normal text-text-3">/mo</span>
                </div>
                <p class="text-xs text-text-3">{{ plan.subtitle }}</p>
                <ul class="space-y-1.5 text-xs text-text-2 pt-2 border-t border-border-structural/60">
                  @for (feat of plan.features; track feat) {
                    <li class="flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[15px] text-status-ok">check</span>
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
                {{ isCurrent ? 'Active Plan' : (updatingTier() === plan.tier ? 'Updating…' : 'Switch to ' + plan.name) }}
              </button>
            </article>
          }
        </section>
      </div>
    </div>
  `,
})
export class BillingPageComponent implements OnInit {
  private readonly api = inject(FlowTraceApiService);

  public readonly org = signal<OrganizationView | null>(null);
  public readonly usage = signal<OrganizationUsage | null>(null);
  public readonly annual = signal(false);
  public readonly updatingTier = signal<PlanTier | null>(null);

  public readonly currentPlan = computed<PlanTier>(
    () => this.org()?.organization.planTier ?? this.usage()?.planTier ?? 'FREE'
  );

  public readonly usagePct = computed(() =>
    Math.min(100, Math.round((this.usage()?.percentUsed ?? 0) * 10) / 10)
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
      features: ['100k events / month', '7 days trace retention', 'All flow templates'],
    },
    {
      tier: 'PRO',
      name: 'Pro Mesh',
      monthlyPrice: 29,
      annualPrice: 23,
      subtitle: 'For growing SaaS and microservices.',
      features: ['10M events / month', '30 days retention', 'Alerts & Webhooks'],
    },
    {
      tier: 'BUSINESS',
      name: 'Business Ops',
      monthlyPrice: 99,
      annualPrice: 79,
      subtitle: 'High-volume production & CRO shops.',
      features: ['50M events / month', '90 days retention', 'Unlimited connectors'],
    },
    {
      tier: 'ENTERPRISE',
      name: 'Enterprise',
      monthlyPrice: 299,
      annualPrice: 239,
      subtitle: 'Dedicated throughput and custom SLA.',
      features: ['500M+ events / month', 'Custom retention', 'SSO & Audit export'],
    },
  ];

  public async ngOnInit(): Promise<void> {
    try {
      const orgs = await this.api.listOrganizations();
      if (orgs.length > 0) {
        this.org.set(orgs[0]);
        this.usage.set(await this.api.getOrganizationUsage(orgs[0].organization.id));
      }
    } catch {
      // Ignore transient errors
    }
  }

  public async switchPlan(tier: PlanTier): Promise<void> {
    const orgId = this.org()?.organization.id;
    if (!orgId) return;
    this.updatingTier.set(tier);
    try {
      const updated = await this.api.updateOrganization(orgId, { planTier: tier });
      this.org.set(updated);
      this.usage.set(await this.api.getOrganizationUsage(orgId));
    } finally {
      this.updatingTier.set(null);
    }
  }
}
