import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FlowSessionStore } from '../../../core/flow-session.store';
import { TraceSummary } from '../../../core/models';

@Component({
  selector: 'app-node-inspector-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (store.inspectorOpen() && store.selectedNode(); as node) {
      @if (store.liveVariant() === 'v2') {
        <!-- V2: 45% Trace Diagnostic Studio -->
        <aside class="w-[45%] min-w-[360px] h-full bg-bg-1 flex flex-col z-30 shadow-2xl overflow-y-auto">
          <div class="p-space-lg border-b border-border-structural bg-bg-2/40 flex flex-col gap-space-sm">
            <div class="flex items-center justify-between">
              <div
                class="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full font-code-sm text-xs font-semibold border"
                [class.bg-status-error/15]="store.totalErrors() > 0"
                [class.border-status-error/30]="store.totalErrors() > 0"
                [class.text-status-error]="store.totalErrors() > 0"
                [class.bg-node-queue/15]="store.totalErrors() === 0"
                [class.border-node-queue/30]="store.totalErrors() === 0"
                [class.text-node-queue]="store.totalErrors() === 0"
              >
                <span class="w-2 h-2 rounded-full animate-ping" [class.bg-status-error]="store.totalErrors() > 0" [class.bg-node-queue]="store.totalErrors() === 0"></span>
                <span>TRACE STUDIO · {{ node.label }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="font-code-sm text-xs text-text-3">Trace:</span>
                <span class="font-code-sm text-xs text-node-queue font-semibold bg-bg-0 px-2 py-0.5 rounded border border-border-structural">
                  {{ shortTraceId(store.selectedTraceDetail()?.summary?.id) }}
                </span>
              </div>
            </div>

            <div class="p-3 rounded-xl bg-bg-2 border border-border-structural flex flex-col gap-1.5">
              <div class="flex items-center gap-2 text-node-queue font-label-md text-xs font-semibold">
                <span class="material-symbols-outlined text-[18px]">analytics</span>
                <span>NODE TELEMETRY &amp; TRACE ATTRIBUTION</span>
              </div>
              <p class="font-body-md text-sm text-text-1 leading-snug">
                Inspecting <code class="px-1.5 py-0.5 bg-bg-0 rounded text-node-queue font-code-sm text-xs">{{ node.key }}</code>
                ({{ node.type }}) with {{ nodeMetric().in }} events/s and {{ nodeMetric().errors }} errors.
              </p>
            </div>
          </div>

          <!-- Span Waterfall -->
          <div class="p-space-lg border-b border-border-structural flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="font-label-uppercase text-xs font-semibold text-text-3">Span Waterfall Timeline</span>
              <span class="px-2 py-0.5 rounded bg-bg-3 border border-border-structural text-[11px] font-code-sm text-text-2">
                {{ traceEvents().length }} Events
              </span>
            </div>

            <div class="rounded-xl bg-bg-0 border border-border-structural p-3 flex flex-col gap-2.5 font-code-sm">
              @for (ev of traceEvents(); track ev.id) {
                <div class="flex flex-col gap-1">
                  <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <span
                        class="w-2 h-2 rounded shrink-0"
                        [class.bg-status-error]="ev.type === 'error'"
                        [class.bg-status-ok]="ev.type !== 'error'"
                      ></span>
                      <span class="text-text-1 font-medium truncate">
                        {{ ev.fromNode ? ev.fromNode + ' → ' + ev.node : ev.node }}
                      </span>
                    </div>
                    <span class="text-text-3 text-xs shrink-0">{{ ev.type }}</span>
                  </div>
                  <div class="w-full h-2.5 bg-bg-2 rounded overflow-hidden relative">
                    <div
                      class="h-full rounded"
                      [class.bg-status-error]="ev.type === 'error'"
                      [class.bg-node-queue]="ev.type !== 'error'"
                      [style.width.%]="Math.min(100, Math.max(12, 100 / Math.max(1, traceEvents().length)))"
                      [style.margin-left.%]="Math.min(85, $index * (85 / Math.max(1, traceEvents().length)))"
                    ></div>
                  </div>
                </div>
              } @empty {
                <div class="text-xs text-text-3 py-4 text-center">
                  Select a trace below or start Demo Simulator to inspect span waterfall.
                </div>
              }
            </div>
          </div>

          <!-- Recent Traces Picker -->
          <div class="p-space-lg flex-1 flex flex-col gap-2">
            <span class="font-label-uppercase text-xs font-semibold text-text-3">Recent Traces</span>
            @for (tr of store.filteredTraces().slice(0, 8); track tr.id) {
              <button
                type="button"
                (click)="store.inspectTrace(tr.id)"
                class="w-full text-left p-2.5 rounded-xl bg-bg-2 border border-border-structural hover:border-border-strong flex items-center justify-between transition-colors"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="w-2 h-2 rounded-full" [class.bg-status-ok]="tr.status !== 'error'" [class.bg-status-error]="tr.status === 'error'"></span>
                  <span class="font-code-sm text-xs text-text-1 truncate">{{ tr.id }}</span>
                </div>
                <span class="font-code-sm text-xs text-text-3">{{ tr.eventCount }} hops</span>
              </button>
            }
          </div>
        </aside>
      } @else if (store.liveVariant() === 'v3') {
        <!-- V3: Floating Collapsible Hover HUD -->
        <div class="absolute top-20 right-5 w-80 z-30 pointer-events-auto">
          <div class="rounded-2xl bg-bg-1/95 border border-border-structural backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
            <div class="p-3 border-b border-border-structural bg-bg-2/50 flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <span class="w-2 h-2 rounded-full bg-node-service animate-pulse shrink-0"></span>
                <span class="font-label-md text-label-md font-semibold text-text-1 truncate">{{ node.label }}</span>
                <span class="px-1.5 py-0.5 rounded bg-node-service/20 text-node-service font-code-sm text-[10px]">SELECTED</span>
              </div>
              <button
                type="button"
                (click)="store.inspectorOpen.set(false)"
                class="w-6 h-6 rounded flex items-center justify-center text-text-3 hover:text-text-1 hover:bg-bg-3"
                title="Close HUD"
              >
                <span class="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>
            <div class="p-3 grid grid-cols-3 gap-2 border-b border-border-structural text-center">
              <div class="p-2 rounded-lg bg-bg-0/60 border border-border-structural/60">
                <span class="text-[10px] text-text-3 block">Ingress</span>
                <span class="font-code-sm text-code-sm font-semibold text-text-1">{{ nodeMetric().in }}/s</span>
              </div>
              <div class="p-2 rounded-lg bg-bg-0/60 border border-border-structural/60">
                <span class="text-[10px] text-text-3 block">Errors</span>
                <span class="font-code-sm text-code-sm font-semibold" [class.text-status-ok]="nodeMetric().errors === 0" [class.text-status-error]="nodeMetric().errors > 0">
                  {{ nodeMetric().errors }}
                </span>
              </div>
              <div class="p-2 rounded-lg bg-bg-0/60 border border-border-structural/60">
                <span class="text-[10px] text-text-3 block">Type</span>
                <span class="font-code-sm text-code-sm font-semibold text-node-queue">{{ node.type }}</span>
              </div>
            </div>
            <div class="p-3 space-y-1.5 max-h-44 overflow-y-auto">
              @for (tr of store.filteredTraces().slice(0, 5); track tr.id) {
                <button
                  type="button"
                  (click)="store.inspectTrace(tr.id)"
                  class="w-full px-2 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 border border-border-structural flex items-center justify-between text-xs"
                >
                  <span class="font-mono text-[11px] text-text-2 truncate">{{ shortTraceId(tr.id) }}</span>
                  <span class="font-mono text-[10px]" [class.text-status-ok]="tr.status !== 'error'" [class.text-status-error]="tr.status === 'error'">
                    {{ tr.status }}
                  </span>
                </button>
              }
            </div>
          </div>
        </div>
      } @else if (store.liveVariant() === 'minimalist') {
        <!-- Minimalist Studio: Contextual Floating Glass Card -->
        <aside class="absolute top-20 right-6 bottom-24 w-[340px] z-30 pointer-events-none flex flex-col justify-start">
          <div class="w-full max-h-full rounded-3xl bg-bg-1/85 border border-border-strong backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.65)] p-4 flex flex-col gap-3 pointer-events-auto overflow-hidden">
            <div class="flex items-start justify-between pb-3 border-b border-border-structural">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="w-2 h-2 rounded-full bg-node-queue"></span>
                  <span class="text-[11px] font-mono uppercase tracking-widest text-node-queue font-medium">
                    Selected {{ node.type }}
                  </span>
                </div>
                <h2 class="text-base font-semibold text-text-1 tracking-tight">{{ node.label }}</h2>
                <span class="text-[11px] font-mono text-text-3">{{ node.key }}</span>
              </div>
              <button
                type="button"
                (click)="store.inspectorOpen.set(false)"
                class="w-7 h-7 rounded-full bg-bg-2 hover:bg-bg-3 text-text-3 hover:text-text-1 flex items-center justify-center transition-colors"
              >
                <span class="material-symbols-outlined text-[15px]">close</span>
              </button>
            </div>

            <div class="grid grid-cols-3 gap-2">
              <div class="p-2 rounded-xl bg-bg-2 border border-border-structural">
                <span class="text-[10px] font-mono text-text-3 block mb-0.5">Ingress</span>
                <span class="text-sm font-semibold font-mono text-text-1">{{ nodeMetric().in }}</span>
                <span class="text-[9px] text-text-3 block">req/sec</span>
              </div>
              <div class="p-2 rounded-xl bg-bg-2 border border-border-structural">
                <span class="text-[10px] font-mono text-text-3 block mb-0.5">Errors</span>
                <span class="text-sm font-semibold font-mono" [class.text-status-ok]="nodeMetric().errors === 0" [class.text-status-error]="nodeMetric().errors > 0">
                  {{ nodeMetric().errors }}
                </span>
                <span class="text-[9px] text-text-3 block">window</span>
              </div>
              <div class="p-2 rounded-xl bg-bg-2 border border-border-structural">
                <span class="text-[10px] font-mono text-text-3 block mb-0.5">Tokens</span>
                <span class="text-sm font-semibold font-mono text-node-queue">{{ store.activeTokens().length }}</span>
                <span class="text-[9px] text-text-3 block">in flight</span>
              </div>
            </div>

            <div class="flex-1 flex flex-col min-h-0">
              <div class="flex items-center justify-between text-[11px] font-mono text-text-3 mb-1.5">
                <span>Recent Traces</span>
                <span class="text-status-ok text-[10px]">live</span>
              </div>
              <div class="space-y-1 overflow-y-auto">
                @for (tr of store.filteredTraces().slice(0, 6); track tr.id) {
                  <button
                    type="button"
                    (click)="store.inspectTrace(tr.id)"
                    class="w-full px-2.5 py-1.5 rounded-lg bg-bg-2 hover:bg-bg-3 border border-border-structural flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <span class="font-mono text-[11px] text-text-2">#{{ shortTraceId(tr.id) }}</span>
                    <span class="font-mono text-[10px]" [class.text-status-ok]="tr.status !== 'error'" [class.text-status-error]="tr.status === 'error'">
                      {{ tr.eventCount }} events
                    </span>
                  </button>
                }
              </div>
            </div>
          </div>
        </aside>
      } @else {
        <!-- V1: Right-Hand Inspector Drawer (360px Fixed Desktop) -->
        <aside class="w-[360px] shrink-0 h-full bg-bg-1 border-l border-border-structural flex flex-col z-30 shadow-2xl">
          <!-- Drawer Header -->
          <div class="p-space-lg border-b border-border-structural flex flex-col gap-space-sm bg-bg-1/90">
            <div class="flex items-center justify-between">
              <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-node-service/15 border border-node-service/30 text-node-service font-chip-metric text-chip-metric font-semibold">
                <span class="w-1.5 h-1.5 rounded-full bg-node-service"></span>
                <span>{{ node.type }} · Selected</span>
              </div>
              <button
                type="button"
                (click)="store.inspectorOpen.set(false)"
                class="w-7 h-7 rounded-lg bg-bg-2 border border-border-structural text-text-3 hover:text-text-1 hover:border-border-strong flex items-center justify-center transition-colors"
                title="Close Inspector"
              >
                <span class="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div>
              <h2 class="font-headline-sm text-headline-sm text-text-1 tracking-tight truncate">{{ node.label }}</h2>
              <div class="flex items-center gap-2 mt-1">
                <span class="font-code-sm text-code-sm text-text-2 px-1.5 py-0.5 rounded bg-bg-0 border border-border-structural">
                  {{ node.key }}
                </span>
                <button
                  type="button"
                  (click)="copyKey(node.key)"
                  class="text-text-3 hover:text-node-queue transition-colors flex items-center"
                  title="Copy node key"
                >
                  <span class="material-symbols-outlined text-[16px]">
                    {{ copiedKey() === node.key ? 'check' : 'content_copy' }}
                  </span>
                </button>
                <span class="text-text-3 font-code-sm text-xs ml-auto">{{ store.activeTemplateId() }}</span>
              </div>
            </div>
          </div>

          <!-- Telemetry Metrics Section -->
          <div class="p-space-lg border-b border-border-structural flex flex-col gap-space-md">
            <div class="flex items-center justify-between">
              <span class="font-label-uppercase text-label-uppercase text-text-3 font-semibold">Realtime Telemetry</span>
              <span
                class="font-chip-metric text-chip-metric px-2 py-0.5 rounded border"
                [class.text-status-ok]="nodeMetric().errors === 0"
                [class.bg-status-ok/10]="nodeMetric().errors === 0"
                [class.border-status-ok/20]="nodeMetric().errors === 0"
                [class.text-status-error]="nodeMetric().errors > 0"
                [class.bg-status-error/10]="nodeMetric().errors > 0"
                [class.border-status-error/30]="nodeMetric().errors > 0"
              >
                {{ nodeMetric().errors === 0 ? 'Operational' : 'Degraded' }}
              </span>
            </div>

            <!-- 2x2 Metric Stat Grid -->
            <div class="grid grid-cols-2 gap-space-sm">
              <div class="p-2.5 rounded-xl bg-bg-2 border border-border-structural flex flex-col">
                <span class="font-label-sm text-label-sm text-text-3">Ingress Rate</span>
                <span class="font-headline-sm text-headline-sm text-text-1 tabular-nums mt-0.5">
                  {{ nodeMetric().in }} <span class="font-body-md text-xs text-text-3 font-normal">req/s</span>
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-bg-2 border border-border-structural flex flex-col">
                <span class="font-label-sm text-label-sm text-text-3">Active Tokens</span>
                <span class="font-headline-sm text-headline-sm text-text-1 tabular-nums mt-0.5">
                  {{ store.activeTokens().length }} <span class="font-body-md text-xs text-text-3 font-normal">live</span>
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-bg-2 border border-border-structural flex flex-col">
                <span class="font-label-sm text-label-sm text-text-3">Stream Window</span>
                <span class="font-headline-sm text-headline-sm text-node-queue tabular-nums mt-0.5">
                  {{ store.stats().windowMs }} <span class="font-body-md text-xs text-text-3 font-normal">ms</span>
                </span>
              </div>
              <div class="p-2.5 rounded-xl bg-bg-2 border border-border-structural flex flex-col">
                <span class="font-label-sm text-label-sm text-text-3">Errors</span>
                <span
                  class="font-headline-sm text-headline-sm tabular-nums mt-0.5"
                  [class.text-status-ok]="nodeMetric().errors === 0"
                  [class.text-status-error]="nodeMetric().errors > 0"
                >
                  {{ nodeMetric().errors }}
                </span>
              </div>
            </div>

            <!-- Mini Sparkline Area Chart -->
            <div class="p-3 rounded-xl bg-bg-0 border border-border-structural flex flex-col gap-2">
              <div class="flex items-center justify-between text-code-sm font-code-sm">
                <span class="text-text-3">Traffic Throughput (Live)</span>
                <span class="text-node-queue font-medium">{{ store.totalRps() }} req/s</span>
              </div>
              <div class="w-full h-14 relative">
                <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 280 60">
                  <defs>
                    <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stop-color="#22D3EE" stop-opacity="0.35"></stop>
                      <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0.0"></stop>
                    </linearGradient>
                    <linearGradient id="sparkline-stroke" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stop-color="#22D3EE"></stop>
                      <stop offset="100%" stop-color="#8B5CF6"></stop>
                    </linearGradient>
                  </defs>
                  <path [attr.d]="sparklineAreaPath()" fill="url(#sparkline-fill)"></path>
                  <path [attr.d]="sparklineStrokePath()" fill="none" stroke="url(#sparkline-stroke)" stroke-linecap="round" stroke-width="2"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Trace Stream List (Scrollable) -->
          <div class="flex-1 overflow-y-auto flex flex-col p-space-lg gap-space-sm">
            <div class="flex items-center justify-between sticky top-0 bg-bg-1/95 py-1 z-10">
              <span class="font-label-uppercase text-label-uppercase text-text-3 font-semibold">Live Trace Stream</span>
              <span class="font-code-sm text-code-sm text-text-3">Last {{ store.filteredTraces().length }} traces</span>
            </div>

            @for (tr of store.filteredTraces(); track tr.id) {
              <button
                type="button"
                (click)="store.inspectTrace(tr.id)"
                class="w-full text-left p-2.5 rounded-xl bg-bg-2 border hover:border-border-strong flex flex-col gap-1.5 transition-all"
                [class.border-status-error/40]="tr.status === 'error'"
                [class.border-border-structural]="tr.status !== 'error'"
              >
                <div class="flex items-center justify-between w-full">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="w-2 h-2 rounded-full shrink-0"
                      [class.bg-status-ok]="tr.status !== 'error'"
                      [class.bg-status-error]="tr.status === 'error'"
                    ></span>
                    <span class="font-code-sm text-code-sm text-text-1 font-semibold truncate">
                      {{ shortTraceId(tr.id) }}
                    </span>
                  </div>
                  <span
                    class="font-code-sm text-code-sm px-1.5 py-0.5 rounded border shrink-0"
                    [class.text-status-ok]="tr.status !== 'error'"
                    [class.bg-status-ok/10]="tr.status !== 'error'"
                    [class.border-status-ok/20]="tr.status !== 'error'"
                    [class.text-status-error]="tr.status === 'error'"
                    [class.bg-status-error/10]="tr.status === 'error'"
                    [class.border-status-error/30]="tr.status === 'error'"
                  >
                    {{ tr.eventCount }} hops
                  </span>
                </div>
                <div class="flex items-center gap-1 text-[11px] text-text-3 font-code-sm truncate w-full">
                  <span>Last node:</span>
                  <span class="text-node-queue font-medium truncate">{{ tr.lastNode || 'ingress' }}</span>
                </div>
              </button>
            } @empty {
              <div class="p-4 rounded-xl bg-bg-2 border border-border-structural text-center text-xs text-text-3">
                No traces yet. Click <strong>Start Demo</strong> in the header to stream live requests.
              </div>
            }
          </div>

          <!-- Drawer Footer Actions -->
          <div class="p-space-md border-t border-border-structural flex items-center gap-space-sm bg-bg-1/95">
            <button
              type="button"
              (click)="store.toggleDemo()"
              class="flex-1 h-9 rounded-lg bg-bg-3 border border-border-structural hover:border-border-strong text-text-1 font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5"
            >
              <span class="material-symbols-outlined text-[16px]">
                {{ store.demoRunning() ? 'stop' : 'play_arrow' }}
              </span>
              <span>{{ store.demoRunning() ? 'Stop Demo' : 'Run Demo' }}</span>
            </button>
            <button
              type="button"
              (click)="store.setLiveVariant('v2')"
              class="h-9 px-3 rounded-lg bg-gradient-to-r from-node-queue to-node-service text-bg-0 font-label-md text-label-md font-semibold hover:opacity-90 transition-opacity flex items-center gap-1"
            >
              <span>Span Waterfall</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </aside>
      }
    }
  `,
})
export class NodeInspectorDrawerComponent {
  public readonly store = inject(FlowSessionStore);
  public readonly Math = Math;
  public readonly copiedKey = signal<string | null>(null);

  public readonly nodeMetric = computed(() => {
    const key = this.store.selectedNode()?.key;
    return key ? this.store.getNodeMetric(key) : { in: 0, errors: 0 };
  });

  public readonly traceEvents = computed(() => this.store.selectedTraceDetail()?.events ?? []);

  public readonly sparklineStrokePath = computed(() => {
    const vals = this.store.throughputHistory();
    const step = 280 / Math.max(1, vals.length - 1);
    return vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${Math.round(i * step)} ${Math.max(4, Math.min(56, 56 - v))}`)
      .join(' ');
  });

  public readonly sparklineAreaPath = computed(() => `${this.sparklineStrokePath()} L 280 60 L 0 60 Z`);

  public shortTraceId(id?: string | null): string {
    if (!id) return '—';
    return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  }

  public copyKey(key: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(key);
    }
    this.copiedKey.set(key);
    setTimeout(() => this.copiedKey.set(null), 1500);
  }
}
