import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { TemplateDefinition } from '../../core/models';
import { FlowTemplateId, resolveTemplateProfile } from '../../core/template-visuals';

@Component({
  selector: 'app-template-gallery-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <!-- Hero Banner -->
        <section class="relative overflow-hidden rounded-2xl bg-bg-1 border border-border-structural p-6 md:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div class="max-w-xl space-y-3">
            <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-node-queue/10 border border-node-queue/30 text-node-queue text-xs font-code-sm">
              <span class="w-1.5 h-1.5 rounded-full bg-node-queue animate-ping"></span>
              <span>Live Architecture Templates</span>
            </div>
            <h1 class="font-headline-lg text-2xl md:text-3xl font-semibold text-text-1">
              Visualize every request hop with domain-tuned blocks
            </h1>
            <p class="text-sm text-text-2 leading-relaxed">
              Apply a blueprint to instantly configure your project graph, node icons, latency units, and animated request flow tokens.
            </p>
          </div>

          <!-- Animated Mini Flow Preview -->
          <div class="w-full lg:w-[440px] h-[140px] rounded-xl bg-bg-0 border border-border-structural relative overflow-hidden p-4 flex items-center justify-between">
            <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 440 140" fill="none">
              <path d="M 55 70 L 155 70 L 265 70 L 385 70" stroke="#262C3A" stroke-width="2" />
              <path d="M 55 70 L 385 70" stroke="#22D3EE" stroke-dasharray="4 4" stroke-width="1.5" opacity="0.6" />
              <circle r="4" fill="#22D3EE">
                <animateMotion dur="2.1s" repeatCount="indefinite" path="M 55 70 L 385 70" />
              </circle>
              <circle r="3.5" fill="#8B5CF6">
                <animateMotion begin="1.05s" dur="2.1s" repeatCount="indefinite" path="M 55 70 L 385 70" />
              </circle>
            </svg>
            @for (step of heroNodes; track step.label) {
              <div class="relative z-10 flex flex-col items-center gap-1.5">
                <div class="w-11 h-11 rounded-xl bg-bg-2 border border-border-strong flex items-center justify-center shadow-lg">
                  <span class="material-symbols-outlined text-[20px]" [style.color]="step.color">{{ step.icon }}</span>
                </div>
                <span class="font-code-sm text-[10px] text-text-2">{{ step.label }}</span>
              </div>
            }
          </div>
        </section>

        <!-- Filter & Search Bar -->
        <section class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <h2 class="font-headline-md text-xl font-semibold text-text-1">Architecture Templates</h2>
            <span class="px-2.5 py-0.5 rounded-full bg-bg-2 text-text-2 font-code-sm text-xs">
              {{ filteredTemplates().length }} ready
            </span>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <div class="flex items-center p-1 rounded-xl bg-bg-1 border border-border-structural gap-1">
              @for (cat of categories(); track cat) {
                <button
                  type="button"
                  (click)="selectedCategory.set(cat)"
                  class="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  [class.bg-bg-3]="selectedCategory() === cat"
                  [class.text-text-1]="selectedCategory() === cat"
                  [class.text-text-3]="selectedCategory() !== cat"
                >
                  {{ cat }}
                </button>
              }
            </div>

            <div class="relative flex items-center min-w-[220px]">
              <span class="material-symbols-outlined absolute left-2.5 text-text-3 text-[17px] pointer-events-none">search</span>
              <input
                type="text"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
                placeholder="Search templates…"
                class="w-full h-9 pl-8 pr-3 rounded-xl bg-bg-1 border border-border-structural text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-node-queue"
              />
            </div>
          </div>
        </section>

        <!-- Templates Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          @for (tpl of filteredTemplates(); track tpl.id) {
            @let isCurrent = store.activeTemplateId() === tpl.id;
            <article
              class="group flex flex-col rounded-2xl bg-bg-2 border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              [class.border-node-queue/70]="isCurrent"
              [class.border-border-structural]="!isCurrent"
            >
              <!-- Mini Topology SVG built from actual template diagram -->
              <div class="relative w-full h-40 rounded-xl bg-bg-1 border border-border-structural overflow-hidden mb-4">
                <div
                  class="absolute inset-0 opacity-40"
                  style="background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px); background-size: 16px 16px;"
                ></div>
                <div class="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-bg-3/90 font-code-sm text-[10px] text-node-queue">
                  {{ tpl.category }}
                </div>
                <svg class="w-full h-full relative z-10" viewBox="0 0 320 160" fill="none">
                  @for (edge of scaledEdges(tpl); track edge.id) {
                    <path [attr.d]="edge.path" stroke="#343C4F" stroke-width="1.5" />
                    <circle r="2.8" fill="#22D3EE">
                      <animateMotion dur="2.6s" repeatCount="indefinite" [attr.path]="edge.path" />
                    </circle>
                  }
                  @for (node of scaledNodes(tpl); track node.key) {
                    <g [attr.transform]="'translate(' + (node.sx - 18) + ',' + (node.sy - 12) + ')'">
                      <rect width="36" height="24" rx="6" fill="#171B24" stroke="#343C4F" />
                      <text x="18" y="15" text-anchor="middle" fill="#E8ECF4" font-size="7" font-family="Inter">
                        {{ node.shortLabel }}
                      </text>
                    </g>
                  }
                </svg>
              </div>

              <div class="flex items-center justify-between gap-2 mb-1">
                <span class="px-2 py-0.5 rounded-full bg-node-source/15 text-node-source font-chip-metric text-[11px]">
                  {{ tpl.category }}
                </span>
                <span class="font-code-sm text-[11px] text-text-3">
                  {{ tpl.diagram.nodes.length }} nodes · {{ tpl.diagram.edges.length }} edges
                </span>
              </div>

              <h3 class="font-body-node-label text-sm font-semibold text-text-1 group-hover:text-node-queue transition-colors">
                {{ tpl.name }}
              </h3>
              <p class="text-xs text-text-2 line-clamp-2 mt-1 mb-4 flex-1">
                {{ tpl.description }}
              </p>

              <button
                type="button"
                [disabled]="applyingId() === tpl.id"
                (click)="useTemplate(tpl)"
                class="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-[10px] bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold hover:opacity-95 transition-opacity disabled:opacity-60"
              >
                <span class="material-symbols-outlined text-[16px]">
                  {{ isCurrent ? 'check_circle' : 'add_task' }}
                </span>
                <span>
                  {{ applyingId() === tpl.id ? 'Applying…' : (isCurrent ? 'Active Template (Re-apply)' : 'Use template') }}
                </span>
              </button>
            </article>
          }
        </div>
      </div>
    </div>
  `,
})
export class TemplateGalleryPageComponent {
  public readonly store = inject(FlowSessionStore);
  private readonly router = inject(Router);

  public readonly selectedCategory = signal<string>('All');
  public readonly search = signal<string>('');
  public readonly applyingId = signal<string | null>(null);

  public readonly heroNodes = [
    { label: 'Ingress', icon: 'public', color: '#60A5FA' },
    { label: 'Gateway', icon: 'alt_route', color: '#8B5CF6' },
    { label: 'Queue', icon: 'stream', color: '#22D3EE' },
    { label: 'Store', icon: 'database', color: '#34D399' },
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
    const cats = new Set<string>(['All']);
    for (const t of this.allTemplates()) {
      if (t.category) cats.add(t.category);
    }
    return Array.from(cats);
  });

  public readonly filteredTemplates = computed(() => {
    const cat = this.selectedCategory();
    const q = this.search().trim().toLowerCase();
    return this.allTemplates().filter((t) => {
      if (cat !== 'All' && t.category !== cat) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  });

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
      sx: 45 + ((n.x - minX) / spanX) * 230,
      sy: 32 + ((n.y - minY) / spanY) * 96,
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
        return {
          id: e.id,
          path: `M ${from.sx} ${from.sy} L ${to.sx} ${to.sy}`,
        };
      })
      .filter((x): x is { id: string; path: string } => x !== null);
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
