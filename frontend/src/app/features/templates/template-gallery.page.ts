import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { TemplateDefinition } from '../../core/models';
import { FlowTemplateId, resolveNodeIcon, resolveTemplateProfile } from '../../core/template-visuals';

@Component({
  selector: 'app-template-gallery-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1 flex">
      <!-- Left Workspace Sidebar -->
      <aside class="hidden lg:flex flex-col justify-between w-56 shrink-0 bg-bg-1 border-r border-border-structural p-3 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
        <div class="space-y-3">
          <div class="px-2.5 py-1 font-chip-metric text-[11px] text-text-3 uppercase tracking-wider">
            Workspace
          </div>
          <nav class="flex flex-col gap-1">
            <a
              routerLink="/projects"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
            >
              <span class="material-symbols-outlined text-[18px]">account_tree</span>
              <span>Projects</span>
            </a>
            <a
              routerLink="/templates"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-bg-3 text-text-1 font-semibold border border-border-strong text-xs"
            >
              <span class="material-symbols-outlined text-[18px] text-node-queue">dashboard_customize</span>
              <span>Templates</span>
            </a>
            <a
              routerLink="/alerts"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
            >
              <span class="material-symbols-outlined text-[18px]">notifications_active</span>
              <span>Alerts</span>
            </a>
            <a
              routerLink="/billing"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
            >
              <span class="material-symbols-outlined text-[18px]">credit_card</span>
              <span>Billing</span>
            </a>
            <a
              routerLink="/team"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
            >
              <span class="material-symbols-outlined text-[18px]">group</span>
              <span>Team</span>
            </a>
            <a
              routerLink="/docs"
              class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
            >
              <span class="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Docs</span>
            </a>
          </nav>
        </div>

        <div class="pt-3 border-t border-border-structural space-y-2">
          <div class="flex items-center gap-2 px-2.5 py-1">
            <span
              class="w-1.5 h-1.5 rounded-full"
              [class.bg-status-ok]="store.backendOnline()"
              [class.bg-status-warn]="!store.backendOnline()"
            ></span>
            <span class="font-code-sm text-[11px] text-text-3 truncate">
              {{ store.activeProject()?.name || 'us-east-prod-04' }} · 99.98%
            </span>
          </div>
          <a
            routerLink="/settings"
            class="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-all text-xs font-medium"
          >
            <span class="material-symbols-outlined text-[18px]">settings</span>
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <!-- Main Gallery Content -->
      <main class="flex-1 min-w-0 relative overflow-hidden">
        <div
          class="absolute inset-0 pointer-events-none opacity-35"
          style="background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px); background-size: 24px 24px;"
        ></div>
        <div class="absolute -top-32 right-12 w-96 h-96 bg-node-queue/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute top-48 left-1/3 w-80 h-80 bg-node-service/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="relative z-10 max-w-7xl mx-auto px-6 py-7 space-y-8">
          <!-- 1. FEATURED ARCHITECTURE TEMPLATE HERO -->
          <section class="relative w-full rounded-2xl bg-bg-1 border border-border-structural p-6 lg:p-8 overflow-hidden shadow-2xl">
            <div class="absolute inset-0 bg-gradient-to-r from-bg-1 via-bg-2/65 to-bg-1 pointer-events-none"></div>
            <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <!-- Left: Copy, Meta & CTAs -->
              <div class="lg:col-span-6 space-y-4">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-node-queue/15 text-node-queue text-[11px] font-chip-metric uppercase tracking-wider font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full bg-node-queue animate-ping"></span>
                    Featured Architecture Template
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full bg-bg-3 border border-border-structural text-text-2 text-[11px] font-code-sm">
                    v2.4 Live Telemetry
                  </span>
                </div>

                <div class="space-y-2">
                  <h1 class="font-headline-lg text-2xl md:text-[30px] leading-tight font-semibold text-text-1 tracking-tight">
                    Online shop — watch customers fill their carts,
                    <span class="bg-gradient-to-r from-node-queue to-node-service bg-clip-text text-transparent">live</span>
                  </h1>
                  <p class="text-sm text-text-2 leading-relaxed max-w-xl">
                    End-to-end e-commerce telemetry pipeline connecting Storefront, Product Catalog, Redis Cart, Checkout Service, and Stripe API with live conversion drops, edge rate metrics, and coin-burst animations.
                  </p>
                </div>

                <!-- Metadata Chips -->
                <div class="flex flex-wrap items-center gap-2 pt-1">
                  <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-3 text-text-1 text-xs">
                    <span class="material-symbols-outlined text-[15px] text-node-queue">shopping_bag</span>
                    <span>Commerce</span>
                  </div>
                  <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-3 text-text-1 text-xs">
                    <span class="material-symbols-outlined text-[15px] text-status-ok">trending_up</span>
                    <span>High Conversion</span>
                  </div>
                  <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-bg-3 text-text-2 font-code-sm text-xs">
                    <span class="text-text-1 font-semibold">8</span> nodes · 4 queues
                  </div>
                  <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-2 border border-border-structural text-text-2 font-code-sm text-[11px]">
                    <span class="w-2 h-2 rounded-full bg-status-ok"></span>
                    <span class="text-text-1">4.8k</span> deploys · <span class="text-status-ok">99.9%</span> uptime
                  </div>
                </div>

                <!-- Hero CTAs -->
                <div class="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    [disabled]="applyingId() === 'online-shop'"
                    (click)="applyFeaturedShop()"
                    class="flex items-center gap-2 px-5 py-2.5 rounded-[10px] bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-sm font-semibold shadow-lg hover:brightness-110 transition-all disabled:opacity-60"
                  >
                    <span class="material-symbols-outlined text-[18px]">bolt</span>
                    <span>{{ applyingId() === 'online-shop' ? 'Applying…' : 'Use this template' }}</span>
                  </button>
                  <a
                    routerLink="/shop"
                    class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-bg-3 border border-border-structural text-text-1 hover:border-border-strong hover:text-node-queue transition-all text-xs font-medium"
                  >
                    <span class="material-symbols-outlined text-[16px] text-node-queue">play_circle</span>
                    <span>Explore live preview</span>
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </a>
                </div>
              </div>

              <!-- Right: Live Shop Animated Canvas Simulation -->
              <div class="lg:col-span-6">
                <div class="relative w-full h-[260px] rounded-xl bg-bg-0 border border-border-structural overflow-hidden flex flex-col justify-between p-4">
                  <div
                    class="absolute inset-0 opacity-35"
                    style="background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px); background-size: 20px 20px;"
                  ></div>

                  <!-- Canvas HUD Top -->
                  <div class="relative z-20 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-status-ok animate-pulse"></span>
                      <span class="font-code-sm text-[11px] text-text-2">stream: shop.telemetry.events</span>
                    </div>
                    <div class="flex items-center gap-1.5 bg-bg-2 border border-border-structural px-2.5 py-1 rounded-md text-[11px] font-code-sm text-text-3">
                      <span>FPS: 60.0</span>
                      <span>·</span>
                      <span class="text-node-queue">8.4k evt/s</span>
                    </div>
                  </div>

                  <!-- Curved SVG Pipeline & Particles -->
                  <svg class="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="0 0 540 260" fill="none">
                    <defs>
                      <linearGradient id="heroAccentGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="540" y2="260">
                        <stop offset="0%" stop-color="#22D3EE" />
                        <stop offset="100%" stop-color="#8B5CF6" />
                      </linearGradient>
                    </defs>
                    <path d="M 65 140 C 110 140, 110 90, 160 90" stroke="#343C4F" stroke-dasharray="3 3" stroke-width="2" />
                    <path d="M 160 90 C 215 90, 215 150, 260 150" stroke="#343C4F" stroke-width="2" />
                    <path d="M 260 150 C 310 150, 315 95, 360 95 C 410 95, 420 145, 470 145" stroke="url(#heroAccentGrad)" stroke-width="2.5" opacity="0.9" />
                    <circle r="4" fill="#22D3EE">
                      <animateMotion dur="2.8s" repeatCount="indefinite" path="M 65 140 C 110 140, 110 90, 160 90 C 215 90, 215 150, 260 150 C 310 150, 315 95, 360 95 C 410 95, 420 145, 470 145" />
                    </circle>
                    <circle r="3.5" fill="#8B5CF6">
                      <animateMotion begin="1.2s" dur="3.4s" repeatCount="indefinite" path="M 160 90 C 215 90, 215 150, 260 150 C 310 150, 315 95, 360 95 C 410 95, 420 145, 470 145" />
                    </circle>
                  </svg>

                  <!-- Hero Pipeline Nodes -->
                  <div class="relative z-20 flex items-center justify-between px-2 my-auto">
                    @for (step of heroNodes; track step.label; let i = $index) {
                      <div class="flex flex-col items-center gap-1" [class.-translate-y-4]="i % 2 === 1">
                        <div class="w-11 h-11 rounded-xl bg-bg-2 border border-border-strong flex items-center justify-center shadow-lg">
                          <span class="material-symbols-outlined text-[20px]" [style.color]="step.color">{{ step.icon }}</span>
                        </div>
                        <span class="font-body-node-label text-[11px] text-text-1">{{ step.label }}</span>
                        <span class="font-code-sm text-[9px] text-text-3">{{ step.sub }}</span>
                      </div>
                    }
                  </div>

                  <!-- Canvas HUD Bottom -->
                  <div class="relative z-20 flex items-center justify-between text-[11px] font-code-sm text-text-3 pt-2 border-t border-border-structural/60">
                    <span>P99: <strong class="text-text-1">42ms</strong></span>
                    <span>Gross: <strong class="text-status-ok">$48,219/hr</strong></span>
                    <span>Drop-off: <strong class="text-text-1">&lt;1.8%</strong></span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 2. FILTER & SEARCH BAR -->
          <section class="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <h2 class="font-headline-md text-xl font-semibold text-text-1">Architecture Templates</h2>
              <span class="px-2.5 py-0.5 rounded-full bg-bg-2 border border-border-structural text-text-2 font-code-sm text-xs">
                {{ filteredTemplates().length }} templates ready
              </span>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <div class="flex flex-wrap items-center p-1 rounded-xl bg-bg-1 border border-border-structural gap-1">
                @for (cat of categories(); track cat.name) {
                  <button
                    type="button"
                    (click)="selectedCategory.set(cat.name)"
                    class="px-3 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                    [class.bg-bg-3]="selectedCategory() === cat.name"
                    [class.text-text-1]="selectedCategory() === cat.name"
                    [class.text-text-3]="selectedCategory() !== cat.name"
                  >
                    <span>{{ cat.name }}</span>
                    <span class="font-code-sm text-[10px] text-text-3">{{ cat.count }}</span>
                  </button>
                }
              </div>

              <div class="relative flex items-center min-w-[220px]">
                <span class="material-symbols-outlined absolute left-2.5 text-text-3 text-[17px] pointer-events-none">search</span>
                <input
                  type="text"
                  [ngModel]="search()"
                  (ngModelChange)="search.set($event)"
                  placeholder="Search templates, nodes, stack…"
                  class="w-full h-9 pl-8 pr-3 rounded-xl bg-bg-1 border border-border-structural text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-node-queue"
                />
              </div>

              <select
                [ngModel]="sortBy()"
                (ngModelChange)="sortBy.set($event)"
                class="h-9 px-3 rounded-xl bg-bg-1 border border-border-structural text-xs text-text-2 focus:outline-none focus:border-node-queue"
                aria-label="Sort templates"
              >
                <option value="default">Sort: Recommended</option>
                <option value="nodes">Sort: Most Nodes</option>
                <option value="name">Sort: Name (A–Z)</option>
              </select>
            </div>
          </section>

          <!-- 3. TEMPLATES GRID -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            @for (tpl of filteredTemplates(); track tpl.id) {
              @let isCurrent = store.activeTemplateId() === tpl.id;
              <article
                class="group flex flex-col rounded-2xl bg-bg-2 border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
                [class.border-node-queue/70]="isCurrent"
                [class.shadow-[0_0_24px_rgba(34,211,238,0.12)]="isCurrent"
                [class.border-border-structural]="!isCurrent"
              >
                <!-- Interactive Mini Topology Preview -->
                <div class="relative w-full h-44 rounded-xl bg-bg-1 border border-border-structural overflow-hidden mb-4">
                  <div
                    class="absolute inset-0 opacity-40"
                    style="background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px); background-size: 16px 16px;"
                  ></div>
                  <div class="absolute top-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-3/95 border border-border-structural font-code-sm text-[10px] text-text-1">
                    <span class="w-1.5 h-1.5 rounded-full" [style.background]="categoryAccent(tpl.category)"></span>
                    <span>{{ templateBadge(tpl) }}</span>
                  </div>
                  <div class="absolute bottom-2 right-2.5 z-20 font-code-sm text-[10px] text-text-3">
                    {{ templateMetricHint(tpl) }}
                  </div>

                  <svg class="w-full h-full relative z-10" viewBox="0 0 320 176" fill="none">
                    @for (edge of scaledEdges(tpl); track edge.id) {
                      <path [attr.d]="edge.path" stroke="#343C4F" stroke-width="1.5" />
                      <circle r="2.8" [attr.fill]="categoryAccent(tpl.category)">
                        <animateMotion dur="2.6s" repeatCount="indefinite" [attr.path]="edge.path" />
                      </circle>
                    }
                    @for (node of scaledNodes(tpl); track node.key) {
                      <g [attr.transform]="'translate(' + (node.sx - 20) + ',' + (node.sy - 13) + ')'">
                        <rect width="40" height="26" rx="7" fill="#171B24" stroke="#343C4F" />
                        <text x="20" y="16" text-anchor="middle" fill="#E8ECF4" font-size="7.5" font-family="Inter">
                          {{ node.shortLabel }}
                        </text>
                      </g>
                    }
                  </svg>
                </div>

                <!-- Category + Node/Edge Count -->
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span class="px-2 py-0.5 rounded-full bg-node-source/15 text-node-source font-chip-metric text-[11px] font-medium">
                    {{ tpl.category }}
                  </span>
                  <span class="font-code-sm text-[11px] text-text-3">
                    {{ tpl.diagram.nodes.length }} nodes · {{ tpl.diagram.edges.length }} edges
                  </span>
                </div>

                <!-- Title & Description -->
                <h3 class="font-body-node-label text-[15px] font-semibold text-text-1 group-hover:text-node-queue transition-colors">
                  {{ tpl.name }}
                </h3>
                <p class="text-xs text-text-2 line-clamp-2 mt-1 mb-3 flex-1">
                  {{ tpl.description }}
                </p>

                <!-- Stack Tags -->
                <div class="flex flex-wrap gap-1.5 mb-4">
                  @for (tag of templateStack(tpl); track tag) {
                    <span class="px-2 py-0.5 rounded bg-bg-1 border border-border-structural font-code-sm text-[10px] text-text-3">
                      {{ tag }}
                    </span>
                  }
                </div>

                <!-- Action CTA -->
                <button
                  type="button"
                  [disabled]="applyingId() === tpl.id"
                  (click)="useTemplate(tpl)"
                  class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold hover:brightness-110 transition-all disabled:opacity-60"
                >
                  <span class="material-symbols-outlined text-[16px]">
                    {{ isCurrent ? 'check_circle' : 'add_task' }}
                  </span>
                  <span>
                    {{ applyingId() === tpl.id ? 'Applying…' : (isCurrent ? 'Active Template · Re-apply' : 'Use template') }}
                  </span>
                </button>
              </article>
            }
          </div>
        </div>
      </main>
    </div>
  `,
})
export class TemplateGalleryPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly router = inject(Router);

  public readonly selectedCategory = signal<string>('All');
  public readonly search = signal<string>('');
  public readonly sortBy = signal<'default' | 'nodes' | 'name'>('default');
  public readonly applyingId = signal<string | null>(null);

  public readonly heroNodes = [
    { label: 'Browse', sub: 'Edge CDN', icon: 'search', color: '#60A5FA' },
    { label: 'Catalog', sub: '12ms', icon: 'grid_view', color: '#F59E0B' },
    { label: 'Cart', sub: 'Redis KV', icon: 'shopping_cart', color: '#22D3EE' },
    { label: 'Checkout', sub: 'gRPC', icon: 'point_of_sale', color: '#8B5CF6' },
    { label: 'Paid', sub: 'Stripe API', icon: 'check_circle', color: '#34D399' },
  ];

  private readonly fallbackTemplates: TemplateDefinition[] = (
    ['microservices', 'online-shop', 'queue-worker', 'ai-rag'] as FlowTemplateId[]
  ).map((id) => {
    const p = resolveTemplateProfile(id);
    const categoryMap: Record<FlowTemplateId, string> = {
      microservices: 'Developer',
      'online-shop': 'Commerce',
      'queue-worker': 'Service',
      'ai-rag': 'AI',
    };
    return {
      id: p.id,
      name: p.displayName,
      category: categoryMap[id],
      description: p.tagline,
      theme: p.recommendedTheme,
      diagram: {
        schema: 1,
        direction: 'TB',
        nodes: [
          { key: 'ingress', label: 'Ingress', type: 'source', x: 100, y: 40 },
          { key: 'core', label: 'Core Service', type: 'service', x: 100, y: 150 },
          { key: 'store', label: 'Datastore', type: 'datastore', x: 100, y: 260 },
        ],
        edges: [
          { id: 'e1', from: 'ingress', to: 'core' },
          { id: 'e2', from: 'core', to: 'store' },
        ],
      },
      defaultPersonas: ['standard'],
      terminalNodes: ['store'],
    };
  });

  public readonly allTemplates = computed<TemplateDefinition[]>(() => {
    const remote = this.store.templates();
    return remote.length > 0 ? remote : this.fallbackTemplates;
  });

  public readonly categories = computed(() => {
    const counts = new Map<string, number>();
    const list = this.allTemplates();
    for (const t of list) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }
    return [
      { name: 'All', count: list.length },
      ...Array.from(counts.entries()).map(([name, count]) => ({ name, count })),
    ];
  });

  public readonly filteredTemplates = computed(() => {
    const cat = this.selectedCategory();
    const q = this.search().trim().toLowerCase();
    const sort = this.sortBy();
    const filtered = this.allTemplates().filter((t) => {
      if (cat !== 'All' && t.category !== cat) return false;
      if (!q) return true;
      const stack = this.templateStack(t).join(' ').toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        stack.includes(q)
      );
    });
    if (sort === 'nodes') {
      return [...filtered].sort((a, b) => b.diagram.nodes.length - a.diagram.nodes.length);
    }
    if (sort === 'name') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    return filtered;
  });

  public ngOnInit(): void {
    void this.store.init();
  }

  public categoryAccent(category: string): string {
    switch (category.toLowerCase()) {
      case 'commerce':
      case 'e-commerce':
        return '#34D399';
      case 'ai':
        return '#8B5CF6';
      case 'service':
        return '#F59E0B';
      default:
        return '#22D3EE';
    }
  }

  public templateBadge(tpl: TemplateDefinition): string {
    switch (tpl.id) {
      case 'online-shop':
        return 'Funnel Live';
      case 'queue-worker':
        return 'Fleet Auto-scale';
      case 'ai-rag':
        return 'RAG Pipeline';
      default:
        return 'Ingress Mesh';
    }
  }

  public templateMetricHint(tpl: TemplateDefinition): string {
    switch (tpl.id) {
      case 'online-shop':
        return '+14.2% Conv';
      case 'queue-worker':
        return 'DLQ Enabled';
      case 'ai-rag':
        return '1536 dim vector';
      default:
        return '1.2ms p50';
    }
  }

  public templateStack(tpl: TemplateDefinition): string[] {
    switch (tpl.id) {
      case 'online-shop':
        return ['Storefront', 'Redis Cart', 'Stripe', 'Checkout'];
      case 'queue-worker':
        return ['Kafka', 'Workers', 'DLQ', 'Postgres'];
      case 'ai-rag':
        return ['Embeddings', 'Vector DB', 'LLM', 'Tools'];
      default:
        return ['Envoy', 'gRPC', 'Decision', 'Postgres'];
    }
  }

  public scaledNodes(tpl: TemplateDefinition) {
    const nodes = tpl.diagram.nodes;
    if (!nodes.length) return [];
    const minX = Math.min(...nodes.map((n) => n.x));
    const maxX = Math.max(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxY = Math.max(...nodes.map((n) => n.y));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);

    return nodes.map((n) => ({
      key: n.key,
      shortLabel: n.label.slice(0, 7),
      icon: resolveNodeIcon(tpl.id, n.key, n.type, n.icon),
      sx: 48 + ((n.x - minX) / spanX) * 224,
      sy: 38 + ((n.y - minY) / spanY) * 100,
    }));
  }

  public scaledEdges(tpl: TemplateDefinition) {
    const sNodes = this.scaledNodes(tpl);
    const map = new Map(sNodes.map((n) => [n.key, n]));
    return tpl.diagram.edges
      .map((e) => {
        const from = map.get(e.from);
        const to = map.get(e.to);
        if (!from || !to) return null;
        const midY = (from.sy + to.sy) / 2;
        return {
          id: e.id,
          path: `M ${from.sx} ${from.sy} C ${from.sx} ${midY}, ${to.sx} ${midY}, ${to.sx} ${to.sy}`,
        };
      })
      .filter((x): x is { id: string; path: string } => x !== null);
  }

  public async applyFeaturedShop(): Promise<void> {
    this.applyingId.set('online-shop');
    try {
      await this.store.applyTemplate('online-shop');
      await this.router.navigateByUrl('/');
    } finally {
      this.applyingId.set(null);
    }
  }

  public async useTemplate(tpl: TemplateDefinition): Promise<void> {
    this.applyingId.set(tpl.id);
    try {
      await this.store.applyTemplate(tpl.id as FlowTemplateId);
      await this.router.navigateByUrl('/');
    } finally {
      this.applyingId.set(null);
    }
  }
}
