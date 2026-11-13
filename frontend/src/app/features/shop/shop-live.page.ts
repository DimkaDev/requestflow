import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowCanvasComponent } from '../live-view/components/flow-canvas.component';

type ShopVariant = 'cozy-light' | 'dark-neon' | 'cro-funnel' | 'tv-showroom';

@Component({
  selector: 'app-shop-live-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FlowCanvasComponent],
  template: `
    <div
      class="pt-14 min-h-screen flex flex-col transition-colors"
      [class.bg-[#FAF7F2]]="variant() === 'cozy-light'"
      [class.text-[#1C1917]]="variant() === 'cozy-light'"
      [class.bg-bg-0]="variant() !== 'cozy-light'"
      [class.text-text-1]="variant() !== 'cozy-light'"
    >
      <!-- Shop Top Bar + Variation Switcher -->
      <div
        class="px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3"
        [class.bg-white]="variant() === 'cozy-light'"
        [class.border-[#E7E2D8]]="variant() === 'cozy-light'"
        [class.bg-bg-1]="variant() !== 'cozy-light'"
        [class.border-border-structural]="variant() !== 'cozy-light'"
      >
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-status-ok/15 border border-status-ok/30 flex items-center justify-center">
            <span class="material-symbols-outlined text-status-ok text-[20px]">storefront</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="font-headline-sm text-base font-semibold">Live Shop Telemetry</h1>
              <span class="px-2 py-0.5 rounded-full bg-status-ok/15 text-status-ok text-[10px] font-code-sm font-semibold">
                {{ store.activeTokens().length }} active shoppers
              </span>
            </div>
            <p class="text-xs opacity-70">Watch orders and shoppers travel through your checkout funnel in real time.</p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Variation Switcher -->
          <div
            class="flex items-center p-1 rounded-xl border gap-1"
            [class.bg-[#F3EFE6]]="variant() === 'cozy-light'"
            [class.border-[#E7E2D8]]="variant() === 'cozy-light'"
            [class.bg-bg-2]="variant() !== 'cozy-light'"
            [class.border-border-structural]="variant() !== 'cozy-light'"
          >
            @for (v of variants; track v.id) {
              <button
                type="button"
                (click)="setVariant(v.id)"
                class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                [class.bg-node-queue]="variant() === v.id"
                [class.text-bg-0]="variant() === v.id"
                [class.font-semibold]="variant() === v.id"
                [class.opacity-75]="variant() !== v.id"
              >
                {{ v.label }}
              </button>
            }
          </div>

          @if (store.activeTemplateId() !== 'online-shop') {
            <button
              type="button"
              (click)="activateShopTemplate()"
              class="px-3 py-1.5 rounded-xl bg-status-ok text-bg-0 text-xs font-semibold flex items-center gap-1"
            >
              <span class="material-symbols-outlined text-[15px]">auto_fix_high</span>
              <span>Load Shop Flow</span>
            </button>
          }

          <a
            routerLink="/connectors"
            class="px-3 py-1.5 rounded-xl border border-border-structural bg-bg-2 text-text-1 text-xs font-medium flex items-center gap-1 hover:border-node-queue/50"
          >
            <span class="material-symbols-outlined text-[15px] text-node-queue">webhook</span>
            <span>Connectors</span>
          </a>
        </div>
      </div>

      <!-- KPI Strip (Business Insights / CRO Funnel) -->
      <div class="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        @for (kpi of kpis(); track kpi.label) {
          <div
            class="rounded-xl p-4 border transition-all"
            [class.bg-white]="variant() === 'cozy-light'"
            [class.border-[#E7E2D8]]="variant() === 'cozy-light'"
            [class.bg-bg-2]="variant() !== 'cozy-light'"
            [class.border-border-structural]="variant() !== 'cozy-light'"
          >
            <div class="flex items-center justify-between text-xs opacity-70">
              <span>{{ kpi.label }}</span>
              <span class="material-symbols-outlined text-[17px]" [style.color]="kpi.color">{{ kpi.icon }}</span>
            </div>
            <div class="mt-2 font-code-block text-xl font-semibold" [class.text-2xl]="variant() === 'tv-showroom'">
              {{ kpi.value }}
            </div>
            <div class="mt-1 text-[11px] font-code-sm" [style.color]="kpi.color">{{ kpi.sub }}</div>
          </div>
        }
      </div>

      <!-- Main Live Shop Stage -->
      <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 px-6 pb-6 min-h-[480px]">
        <div
          class="relative rounded-2xl border overflow-hidden min-h-[460px]"
          [class.lg:col-span-12]="variant() === 'tv-showroom'"
          [class.lg:col-span-8]="variant() !== 'tv-showroom'"
          [class.border-[#E7E2D8]]="variant() === 'cozy-light'"
          [class.border-border-structural]="variant() !== 'cozy-light'"
        >
          <app-flow-canvas class="block w-full h-full min-h-[460px]" />
        </div>

        @if (variant() !== 'tv-showroom') {
          <aside
            class="lg:col-span-4 rounded-2xl border p-4 flex flex-col gap-4"
            [class.bg-white]="variant() === 'cozy-light'"
            [class.border-[#E7E2D8]]="variant() === 'cozy-light'"
            [class.bg-bg-1]="variant() !== 'cozy-light'"
            [class.border-border-structural]="variant() !== 'cozy-light'"
          >
            <div class="flex items-center justify-between border-b border-border-structural/40 pb-2.5">
              <span class="text-sm font-semibold">
                {{ variant() === 'cro-funnel' ? 'CRO Stage Conversion' : 'Business Insights' }}
              </span>
              <span class="text-[11px] font-code-sm text-node-queue">Live window</span>
            </div>

            <div class="space-y-3 flex-1 overflow-y-auto">
              @for (stage of funnelStages(); track stage.key) {
                <div class="space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-medium">{{ stage.label }}</span>
                    <span class="font-code-sm">
                      {{ stage.count }} req/s · <span class="text-status-ok">{{ stage.pct }}%</span>
                    </span>
                  </div>
                  <div class="w-full h-2 rounded-full bg-bg-3/50 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-300"
                      [style.width.%]="stage.pct"
                      [style.background]="stage.errors > 0 ? '#F43F5E' : '#22D3EE'"
                    ></div>
                  </div>
                </div>
              }
            </div>

            <div class="pt-3 border-t border-border-structural/40 flex items-center justify-between text-xs">
              <span class="opacity-70">Need Shopify / Stripe events?</span>
              <a routerLink="/connectors" class="text-node-queue font-semibold hover:underline">
                Setup Webhook →
              </a>
            </div>
          </aside>
        }
      </div>
    </div>
  `,
})
export class ShopLivePageComponent {
  public readonly store = inject(FlowSessionStore);
  public readonly variant = signal<ShopVariant>('dark-neon');

  public readonly variants: Array<{ id: ShopVariant; label: string }> = [
    { id: 'cozy-light', label: 'Cozy Light' },
    { id: 'dark-neon', label: 'Dark Neon' },
    { id: 'cro-funnel', label: 'CRO Funnel' },
    { id: 'tv-showroom', label: 'TV Showroom' },
  ];

  public readonly funnelStages = computed(() => {
    const nodes = this.store.diagram().nodes;
    const stats = this.store.stats().nodes;
    const maxIn = Math.max(1, ...nodes.map((n) => stats[n.key]?.in ?? 0));
    return nodes.map((n) => {
      const m = stats[n.key] ?? { in: 0, errors: 0 };
      return {
        key: n.key,
        label: n.label,
        count: m.in,
        errors: m.errors,
        pct: Math.max(8, Math.round((m.in / maxIn) * 100)),
      };
    });
  });

  public readonly kpis = computed(() => {
    const rps = this.store.totalRps();
    const errs = this.store.totalErrors();
    const active = this.store.activeTokens().length;
    const estConversion = rps > 0 ? Math.max(1.2, Math.min(24.5, 4.8 + (active % 5) * 0.4)).toFixed(1) : '3.8';
    return [
      { label: 'Active Flow Rate', value: `${rps} req/s`, sub: 'Real-time funnel throughput', icon: 'speed', color: '#22D3EE' },
      { label: 'In-Flight Shoppers', value: `${active}`, sub: 'Traveling across nodes', icon: 'shopping_bag', color: '#8B5CF6' },
      { label: 'Checkout Conversion', value: `${estConversion}%`, sub: '+1.4% vs baseline', icon: 'trending_up', color: '#34D399' },
      { label: 'Failed Checkouts', value: `${errs}`, sub: errs > 0 ? 'Action needed' : '0 errors in window', icon: 'error_outline', color: errs > 0 ? '#F43F5E' : '#34D399' },
    ];
  });

  public setVariant(next: ShopVariant): void {
    this.variant.set(next);
    if (next === 'cozy-light') {
      this.store.setTheme('cozy-light');
    } else {
      this.store.setTheme('dark');
    }
  }

  public async activateShopTemplate(): Promise<void> {
    await this.store.applyTemplate('online-shop');
    if (!this.store.demoRunning()) {
      await this.store.toggleDemo();
    }
  }
}
