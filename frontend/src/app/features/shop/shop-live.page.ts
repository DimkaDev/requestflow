import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowCanvasComponent } from '../live-view/components/flow-canvas.component';

type ShopVariant = 'cozy-light' | 'dark-neon' | 'cro-funnel' | 'tv-showroom';

@Component({
  selector: 'app-shop-live-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FlowCanvasComponent],
  template: `
    <div
      class="pt-14 min-h-screen flex flex-col justify-between transition-colors"
      [class.bg-[#FBF7F2]]="isCozy()"
      [class.text-[#2B2520]]="isCozy()"
      [class.bg-[#0B0E14]]="!isCozy()"
      [class.text-[#F1F5F9]]="!isCozy()"
    >
      <div class="flex-1 flex flex-col">
        <!-- TOP KPI STRIP (5-Card Boutique Metric Matrix) -->
        <section
          class="w-full px-6 py-4 border-b"
          [class.bg-[#F0E7DD]/65]="isCozy()"
          [class.border-[#EADFD3]]="isCozy()"
          [class.bg-[#0D111A]]="!isCozy()"
          [class.border-white/[0.07]]="!isCozy()"
        >
          <div class="max-w-[1440px] mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <!-- 1. Visitors Now -->
            <div
              class="rounded-xl p-4 border relative overflow-hidden shadow-sm"
              [class.bg-white]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-[11px] font-semibold uppercase tracking-wider"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  Visitors Now
                </span>
                <span
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                  [class.bg-[#FFEDD5]]="isCozy()"
                  [class.text-[#9A3412]]="isCozy()"
                  [class.bg-cyan-400/15]="!isCozy()"
                  [class.text-cyan-300]="!isCozy()"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full animate-pulse"
                    [class.bg-[#9D4300]]="isCozy()"
                    [class.bg-cyan-400]="!isCozy()"
                  ></span>
                  <span>Active</span>
                </span>
              </div>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-2xl font-bold tracking-tight">{{ visitorsNow() }}</span>
                <span class="text-[11px] font-semibold text-emerald-500 flex items-center">
                  <span class="material-symbols-outlined text-[14px]">north_east</span>
                  <span>+{{ MathMax1(store.totalRps()) }} req/s</span>
                </span>
              </div>
              <div
                class="mt-2 flex items-center gap-1 text-xs"
                [class.text-[#8C8073]]="isCozy()"
                [class.text-[#64748B]]="!isCozy()"
              >
                <span
                  class="material-symbols-outlined text-[15px]"
                  [class.text-[#9D4300]]="isCozy()"
                  [class.text-cyan-400]="!isCozy()"
                >
                  visibility
                </span>
                <span>Concurrent store browsing</span>
              </div>
              <div
                class="absolute bottom-0 left-0 right-0 h-0.5"
                [class.bg-gradient-to-r]="true"
                [class.from-[#9D4300]]="isCozy()"
                [class.to-[#B4136D]]="isCozy()"
                [class.from-cyan-400]="!isCozy()"
                [class.to-violet-500]="!isCozy()"
              ></div>
            </div>

            <!-- 2. Carts Active -->
            <div
              class="rounded-xl p-4 border relative overflow-hidden shadow-sm"
              [class.bg-white]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-[11px] font-semibold uppercase tracking-wider"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  Carts Active
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  [class.bg-[#F0E7DD]]="isCozy()"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.bg-white/[0.06]]="!isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  {{ store.activeTokens().length > 8 ? 'High Load' : 'Steady' }}
                </span>
              </div>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-2xl font-bold tracking-tight">{{ cartsActive() }}</span>
                <span class="text-[11px] font-semibold text-emerald-500 flex items-center">
                  <span class="material-symbols-outlined text-[14px]">arrow_upward</span>
                  <span>+14%</span>
                </span>
              </div>
              <div
                class="mt-2 flex items-center gap-1 text-xs"
                [class.text-[#8C8073]]="isCozy()"
                [class.text-[#64748B]]="!isCozy()"
              >
                <span class="material-symbols-outlined text-[15px] text-amber-500">shopping_basket</span>
                <span>In-flight checkout sessions</span>
              </div>
              <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500/50"></div>
            </div>

            <!-- 3. Sales Today -->
            <div
              class="rounded-xl p-4 border relative overflow-hidden shadow-sm"
              [class.bg-white]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-[11px] font-semibold uppercase tracking-wider"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  Sales Today
                </span>
                <span
                  class="text-[11px] font-medium"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  Target: 200
                </span>
              </div>
              <div class="mt-2 flex items-baseline gap-2">
                <span class="text-2xl font-bold tracking-tight">{{ salesToday() }}</span>
                <span
                  class="text-[11px] font-medium"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  {{ salesPace() }}% pace
                </span>
              </div>
              <div
                class="w-full rounded-full h-1.5 mt-3 overflow-hidden"
                [class.bg-[#F0E7DD]]="isCozy()"
                [class.bg-white/[0.08]]="!isCozy()"
              >
                <div
                  class="h-full rounded-full transition-all"
                  [style.width.%]="salesPace()"
                  [class.bg-gradient-to-r]="true"
                  [class.from-[#9D4300]]="isCozy()"
                  [class.to-[#B4136D]]="isCozy()"
                  [class.from-cyan-400]="!isCozy()"
                  [class.to-emerald-400]="!isCozy()"
                ></div>
              </div>
            </div>

            <!-- 4. Revenue Today (Signature Gradient Card) -->
            <div
              class="rounded-xl p-4 text-white shadow-md relative overflow-hidden"
              [class.bg-gradient-to-br]="true"
              [class.from-[#9D4300]]="isCozy()"
              [class.via-[#9D4300]]="isCozy()"
              [class.to-[#B4136D]]="isCozy()"
              [class.from-cyan-600]="!isCozy()"
              [class.to-violet-600]="!isCozy()"
            >
              <div class="relative z-10">
                <div class="flex items-center justify-between text-white/85">
                  <span class="text-[11px] uppercase tracking-wider font-semibold">Revenue Today</span>
                  <span class="material-symbols-outlined text-[18px]">verified</span>
                </div>
                <div class="mt-1.5 text-2xl font-bold tracking-tight text-white">
                  €{{ revenueTodayFormatted() }}
                </div>
                <div class="mt-2 flex items-center justify-between text-white/90 text-[11px]">
                  <span class="flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">trending_up</span>
                    <span>AOV: €79.68</span>
                  </span>
                  <span class="font-semibold bg-white/20 px-2 py-0.5 rounded-full">+22.4%</span>
                </div>
              </div>
              <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
            </div>

            <!-- 5. Conversion Rate -->
            <div
              class="col-span-2 md:col-span-1 rounded-xl p-4 border relative overflow-hidden shadow-sm"
              [class.bg-white]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              <div class="flex items-center justify-between">
                <span
                  class="text-[11px] font-semibold uppercase tracking-wider"
                  [class.text-[#6E6359]]="isCozy()"
                  [class.text-[#94A3B8]]="!isCozy()"
                >
                  Conversion
                </span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-semibold flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{{ store.totalErrors() > 0 ? 'Watch' : 'Healthy' }}</span>
                </span>
              </div>
              <div class="mt-2 flex items-center justify-between">
                <span class="text-2xl font-bold tracking-tight">{{ conversionPct() }}%</span>
                <div class="relative w-10 h-10">
                  <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                    <path
                      [attr.stroke]="isCozy() ? '#F0E7DD' : '#1E293B'"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke-width="3.5"
                    />
                    <path
                      [attr.stroke]="isCozy() ? '#9D4300' : '#22D3EE'"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke-dasharray="72, 100"
                      stroke-linecap="round"
                      stroke-width="3.5"
                    />
                  </svg>
                  <span
                    class="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                    [class.text-[#9D4300]]="isCozy()"
                    [class.text-cyan-400]="!isCozy()"
                  >
                    ↑
                  </span>
                </div>
              </div>
              <div
                class="mt-1 text-[11px]"
                [class.text-[#8C8073]]="isCozy()"
                [class.text-[#64748B]]="!isCozy()"
              >
                Errors in window: {{ store.totalErrors() }}
              </div>
            </div>
          </div>
        </section>

        <!-- REALTIME JOURNEY GRAPH HEADER + CONTROLS -->
        <section class="max-w-[1440px] w-full mx-auto px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <span
              class="w-2.5 h-2.5 rounded-full"
              [class.bg-[#9D4300]]="isCozy()"
              [class.bg-cyan-400]="!isCozy()"
            ></span>
            <h1 class="text-lg font-semibold tracking-tight">Realtime Journey Graph</h1>
            <span
              class="px-2.5 py-0.5 rounded-md font-mono text-[11px] border"
              [class.bg-[#F0E7DD]]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.text-[#6E6359]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
              [class.text-[#94A3B8]]="!isCozy()"
            >
              stream_id: {{ store.activeProject()?.id || 'shop_prod_01' }}
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- 4 Shop Display Mode Switcher -->
            <div
              class="flex items-center p-1 rounded-xl border gap-1"
              [class.bg-[#F0E7DD]]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              @for (v of variants; track v.id) {
                <button
                  type="button"
                  (click)="setVariant(v.id)"
                  class="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                  [class.bg-[#9D4300]]="variant() === v.id && isCozy()"
                  [class.text-white]="variant() === v.id && isCozy()"
                  [class.bg-cyan-400]="variant() === v.id && !isCozy()"
                  [class.text-[#070B12]]="variant() === v.id && !isCozy()"
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
                class="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1 hover:brightness-110"
              >
                <span class="material-symbols-outlined text-[15px]">auto_fix_high</span>
                <span>Load Shop Flow</span>
              </button>
            }

            <button
              type="button"
              (click)="store.toggleDemo()"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
              [class.bg-[#9D4300]]="!store.demoRunning() && isCozy()"
              [class.text-white]="!store.demoRunning()"
              [class.bg-cyan-500]="!store.demoRunning() && !isCozy()"
              [class.bg-emerald-600]="store.demoRunning()"
            >
              <span class="material-symbols-outlined text-[15px]">
                {{ store.demoRunning() ? 'pause_circle' : 'play_circle' }}
              </span>
              <span>{{ store.demoRunning() ? 'Demo Running' : 'Start Demo Traffic' }}</span>
            </button>

            <a
              routerLink="/connectors"
              class="px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors"
              [class.bg-white]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.text-[#2B2520]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
              [class.text-[#CBD5E1]]="!isCozy()"
            >
              <span class="material-symbols-outlined text-[15px] text-emerald-500">webhook</span>
              <span>Connectors</span>
            </a>
          </div>
        </section>

        <!-- MAIN JOURNEY STAGE + OPTIONAL CRO DRAWER -->
        <section class="max-w-[1440px] w-full mx-auto px-6 pb-5 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div
            class="relative rounded-2xl border overflow-hidden min-h-[480px] flex flex-col"
            [class.lg:col-span-8]="variant() === 'cro-funnel'"
            [class.lg:col-span-12]="variant() !== 'cro-funnel'"
            [class.bg-white]="isCozy()"
            [class.border-[#EADFD3]]="isCozy()"
            [class.bg-[#0D111A]]="!isCozy()"
            [class.border-white/[0.08]]="!isCozy()"
          >
            <!-- Zone Labels Header Strip (matching Stitch Cozy Light Shop Live Demo) -->
            <div
              class="px-5 py-2.5 border-b grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono uppercase tracking-wider"
              [class.bg-[#FEF1E9]/70]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#111622]]="!isCozy()"
              [class.border-white/[0.06]]="!isCozy()"
            >
              <div class="flex items-center justify-between">
                <span class="flex items-center gap-2 font-semibold" [class.text-[#9D4300]]="isCozy()" [class.text-cyan-400]="!isCozy()">
                  <span class="w-2 h-2 rounded-full" [class.bg-[#9D4300]]="isCozy()" [class.bg-cyan-400]="!isCozy()"></span>
                  <span>Store Zone · Ingress &amp; Discovery</span>
                </span>
                <span class="opacity-65">Organic + Direct</span>
              </div>
              <div class="flex items-center justify-between sm:border-l sm:pl-4" [class.border-[#EADFD3]]="isCozy()" [class.border-white/[0.07]]="!isCozy()">
                <span class="flex items-center gap-2 font-semibold" [class.text-[#B4136D]]="isCozy()" [class.text-violet-400]="!isCozy()">
                  <span class="w-2 h-2 rounded-full" [class.bg-[#B4136D]]="isCozy()" [class.bg-violet-400]="!isCozy()"></span>
                  <span>Checkout Zone · Intent &amp; Conversion</span>
                </span>
                <span class="opacity-65">Stripe &amp; Settlement</span>
              </div>
            </div>

            <div class="relative w-full h-[560px]">
              <app-flow-canvas class="block w-full h-full" />
            </div>
          </div>

          <!-- High-Density CRO Funnel Side Panel (shown in CRO Funnel mode) -->
          @if (variant() === 'cro-funnel') {
            <aside
              class="lg:col-span-4 rounded-2xl border p-4 flex flex-col gap-4 bg-[#111622] border-white/[0.08]"
            >
              <div class="flex items-center justify-between border-b border-white/[0.07] pb-2.5">
                <span class="text-sm font-semibold text-[#F1F5F9]">CRO Stage Conversion</span>
                <span class="text-[11px] font-mono text-cyan-400">Live window</span>
              </div>

              <div class="space-y-3 flex-1 overflow-y-auto">
                @for (stage of funnelStages(); track stage.key) {
                  <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-medium text-[#E2E8F0]">{{ stage.label }}</span>
                      <span class="font-mono text-[#94A3B8]">
                        {{ stage.count }} req/s · <span class="text-emerald-400">{{ stage.pct }}%</span>
                      </span>
                    </div>
                    <div class="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        class="h-full rounded-full transition-all duration-300"
                        [style.width.%]="stage.pct"
                        [style.background]="stage.errors > 0 ? '#F43F5E' : '#22D3EE'"
                      ></div>
                    </div>
                  </div>
                }
              </div>

              <div class="pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs">
                <span class="text-[#94A3B8]">Need Shopify / Stripe webhooks?</span>
                <a routerLink="/connectors" class="text-cyan-400 font-semibold hover:underline">
                  Setup Webhook →
                </a>
              </div>
            </aside>
          }
        </section>
      </div>

      <!-- BOTTOM LIVE SALE TICKER & PLAYBACK BAR -->
      <div class="max-w-[1440px] w-full mx-auto px-6 pb-4">
        <div
          class="rounded-2xl border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm"
          [class.bg-white]="isCozy()"
          [class.border-[#EADFD3]]="isCozy()"
          [class.bg-[#111622]]="!isCozy()"
          [class.border-white/[0.08]]="!isCozy()"
        >
          <div class="flex flex-wrap items-center gap-3 min-w-0">
            <span
              class="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold flex items-center gap-1.5"
              [class.bg-[#F0E7DD]]="isCozy()"
              [class.text-[#9D4300]]="isCozy()"
              [class.bg-cyan-400/10]="!isCozy()"
              [class.text-cyan-300]="!isCozy()"
            >
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-[#9D4300]]="isCozy()" [class.bg-cyan-400]="!isCozy()"></span>
              <span>{{ store.demoRunning() ? 'DEMO DATA' : 'LIVE STREAM' }} · {{ store.totalRps() }} events/sec</span>
            </span>

            <span class="text-xs font-medium truncate">
              <span class="font-semibold" [class.text-[#9D4300]]="isCozy()" [class.text-amber-400]="!isCozy()">
                ⚡ LIVE SALE TICKER:
              </span>
              <span class="ml-1.5 opacity-85">{{ latestSaleTicker() }}</span>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Speed Multipliers -->
            <div
              class="flex items-center p-0.5 rounded-lg border text-[11px] font-mono"
              [class.bg-[#FBF7F2]]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#0B0E14]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              @for (spd of speeds; track spd) {
                <button
                  type="button"
                  (click)="store.setSpeed(spd)"
                  class="px-2 py-1 rounded-md transition-colors"
                  [class.bg-[#9D4300]]="store.speedMultiplier() === spd && isCozy()"
                  [class.text-white]="store.speedMultiplier() === spd && isCozy()"
                  [class.bg-cyan-400]="store.speedMultiplier() === spd && !isCozy()"
                  [class.text-[#070B12]]="store.speedMultiplier() === spd && !isCozy()"
                >
                  {{ spd }}x
                </button>
              }
            </div>

            <button
              type="button"
              (click)="store.setStreamMode(store.streamMode() === 'smooth' ? 'realtime' : 'smooth')"
              class="px-2.5 py-1.5 rounded-lg border text-xs font-medium"
              [class.bg-[#F0E7DD]]="isCozy()"
              [class.border-[#EADFD3]]="isCozy()"
              [class.bg-[#0B0E14]]="!isCozy()"
              [class.border-white/[0.08]]="!isCozy()"
            >
              {{ store.streamMode() === 'smooth' ? 'Smooth' : 'Realtime' }}
            </button>

            <button
              type="button"
              (click)="setVariant(variant() === 'tv-showroom' ? 'cozy-light' : 'tv-showroom')"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5"
              [class.bg-[#B4136D]]="isCozy()"
              [class.text-white]="isCozy()"
              [class.bg-violet-500]="!isCozy()"
              [class.text-white]="!isCozy()"
            >
              <span class="material-symbols-outlined text-[15px]">tv</span>
              <span>{{ variant() === 'tv-showroom' ? 'Exit TV' : 'TV Mode' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <footer
        class="border-t px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]"
        [class.border-[#EADFD3]]="isCozy()"
        [class.text-[#8C8073]]="isCozy()"
        [class.border-white/[0.06]]="!isCozy()"
        [class.text-[#64748B]]="!isCozy()"
      >
        <span>FlowTrace Engine · {{ store.activeProject()?.name || 'Online Shop Demo' }}</span>
        <span>{{ variantLabel() }}</span>
      </footer>
    </div>
  `,
})
export class ShopLivePageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly route = inject(ActivatedRoute);

  public readonly variant = signal<ShopVariant>('cozy-light');
  public readonly speeds = [0.5, 1, 2, 4];

  public readonly variants: Array<{ id: ShopVariant; label: string }> = [
    { id: 'cozy-light', label: 'Cozy Light' },
    { id: 'dark-neon', label: 'Dark Neon' },
    { id: 'cro-funnel', label: 'CRO Funnel' },
    { id: 'tv-showroom', label: 'TV Showroom' },
  ];

  public readonly isCozy = computed(() => this.variant() === 'cozy-light');

  public readonly visitorsNow = computed(() => Math.max(12, this.store.activeTokens().length * 6 + this.store.totalRps() * 3));
  public readonly cartsActive = computed(() => Math.max(3, this.store.activeTokens().length * 2));
  public readonly salesToday = computed(() => Math.max(18, this.store.recentTraces().length + 140));
  public readonly salesPace = computed(() => Math.min(100, Math.round((this.salesToday() / 200) * 100)));
  public readonly revenueTodayFormatted = computed(() => (this.salesToday() * 79.68).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }));

  public readonly conversionPct = computed(() => {
    const rps = this.store.totalRps();
    const active = this.store.activeTokens().length;
    return rps > 0 ? Math.max(1.2, Math.min(24.5, 4.4 + (active % 5) * 0.3)).toFixed(1) : '4.8';
  });

  public readonly latestSaleTicker = computed(() => {
    const latest = this.store.recentTraces()[0];
    if (!latest) return 'Watching real-time customer journeys across checkout stages…';
    return `Trace ${latest.id.slice(0, 12)} · ${latest.lastNode || 'checkout'} (${latest.status.toUpperCase()})`;
  });

  public readonly variantLabel = computed(() => {
    switch (this.variant()) {
      case 'cozy-light':
        return 'FlowTrace Analytics · Cozy Light Edition';
      case 'dark-neon':
        return 'FlowTrace Analytics · Dark Neon Ops Hub';
      case 'cro-funnel':
        return 'FlowTrace Analytics · High-Density CRO Funnel';
      case 'tv-showroom':
        return 'FlowTrace Analytics · TV Showroom Mode';
    }
  });

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

  public async ngOnInit(): Promise<void> {
    await this.store.init();
    const modeParam = this.route.snapshot.queryParamMap.get('mode') as ShopVariant | null;
    if (modeParam && this.variants.some((v) => v.id === modeParam)) {
      this.setVariant(modeParam);
    } else {
      this.setVariant('cozy-light');
    }
    if (this.store.activeTemplateId() !== 'online-shop' || this.store.diagram().nodes.length === 0) {
      await this.activateShopTemplate();
    } else if (!this.store.demoRunning()) {
      await this.store.toggleDemo();
    }
    this.centerShopCanvas();
  }

  private centerShopCanvas(): void {
    const nodes = this.store.diagram().nodes;
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const maxY = Math.max(...nodes.map((n) => n.y));
    const spanX = Math.max(400, maxX - minX + 200);
    const spanY = Math.max(300, maxY - minY + 120);
    const zoom = Math.max(0.7, Math.min(1, Number(Math.min(1100 / spanX, 500 / spanY).toFixed(2))));
    this.store.zoom.set(zoom);
    this.store.panX.set(Math.round(90 - minX * zoom));
    this.store.panY.set(Math.round(50 - minY * zoom));
  }

  public MathMax1(n: number): number {
    return Math.max(0, n);
  }

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
    this.centerShopCanvas();
  }
}
