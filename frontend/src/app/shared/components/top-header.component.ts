import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowTemplateId } from '../../core/template-visuals';

@Component({
  selector: 'app-top-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    @if (store.liveVariant() === 'minimalist') {
      <header class="fixed top-4 left-6 right-6 z-50 h-[52px] pointer-events-none">
        <div
          class="h-full w-full max-w-7xl mx-auto flex items-center justify-between px-4 rounded-full bg-bg-1/85 border border-border-strong backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45)] pointer-events-auto"
        >
          <div class="flex items-center gap-3">
            <a class="flex items-center gap-2 group" routerLink="/">
              <div
                class="w-7 h-7 rounded-lg bg-gradient-to-tr from-node-service to-node-queue flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.3)]"
              >
                <svg class="w-4 h-4 text-bg-0" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" viewBox="0 0 24 24">
                  <path d="M4 18c4-4 4-8 8-8s4 4 8 0"></path>
                </svg>
              </div>
              <span class="font-semibold text-[15px] tracking-tight text-text-1">FlowTrace</span>
            </a>
            <span class="text-border-strong text-sm">/</span>
            <button
              type="button"
              (click)="toggleProjectMenu()"
              class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-2 border border-border-structural text-xs font-medium text-text-2 hover:text-text-1 transition-colors"
            >
              <span class="w-1.5 h-1.5 rounded-full" [class.bg-status-ok]="store.wsConnected()" [class.bg-status-warn]="!store.wsConnected()"></span>
              <span class="max-w-[140px] truncate">{{ store.activeProject()?.name || 'Production Mesh' }}</span>
              <span class="material-symbols-outlined text-[14px] text-text-3">expand_more</span>
            </button>
            <span class="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono text-node-queue bg-node-queue/10 border border-node-queue/20">
              {{ store.templateProfile().displayName }}
            </span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Template & Variant Switcher -->
            <button
              type="button"
              (click)="toggleVariantMenu()"
              class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg-3 border border-node-queue/40 text-node-queue text-xs font-medium hover:bg-bg-2 transition-colors"
              title="Switch View Template / Layout Variant"
            >
              <span class="material-symbols-outlined text-[15px]">style</span>
              <span>{{ activeVariantLabel() }}</span>
              <span class="material-symbols-outlined text-[14px]">expand_more</span>
            </button>

            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-status-ok/10 border border-status-ok/25 text-status-ok text-[11px] font-mono font-medium">
              <span class="w-1.5 h-1.5 rounded-full bg-status-ok animate-ping"></span>
              <span>{{ store.totalRps() }} req/s</span>
            </div>

            <button
              type="button"
              (click)="store.toggleTheme()"
              class="w-8 h-8 rounded-full bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 flex items-center justify-center transition-colors"
              title="Toggle Theme"
            >
              <span class="material-symbols-outlined text-[16px]">{{ store.theme() === 'dark' ? 'dark_mode' : 'light_mode' }}</span>
            </button>
          </div>
        </div>
      </header>
    } @else {
      <header class="fixed top-0 left-0 right-0 z-50 h-14 bg-bg-1 border-b border-border-structural">
        <div class="w-full h-14 px-gutter flex items-center justify-between gap-space-md">
          <div class="flex items-center gap-space-md shrink-0">
            <div class="flex items-center gap-space-sm">
              <div class="relative flex items-center justify-center w-8 h-8 rounded-lg bg-bg-2 border border-border-structural">
                <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
                  <path d="M4 18c4-4 4-8 8-8s4 4 8 0"></path>
                </svg>
                <div
                  class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  [class.bg-node-queue]="store.liveVariant() !== 'v2'"
                  [class.bg-status-error]="store.liveVariant() === 'v2'"
                ></div>
              </div>
              <span class="font-headline-sm text-headline-sm text-text-1 tracking-tight">FlowTrace</span>
              <span class="font-code-sm text-code-sm px-space-xs py-0.5 rounded bg-bg-3 text-text-3 border border-border-structural">
                v1.0
              </span>
            </div>

            <div class="h-4 w-px bg-border-structural"></div>

            <!-- Project Dropdown -->
            <div class="relative">
              <button
                type="button"
                (click)="toggleProjectMenu()"
                class="flex items-center gap-space-xs px-space-sm py-1 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 hover:border-border-strong transition-all font-label-md text-label-md"
              >
                <span class="max-w-[160px] truncate">{{ store.activeProject()?.name || 'Production Mesh' }}</span>
                <span class="material-symbols-outlined text-text-3 text-[16px]">expand_more</span>
              </button>

              @if (store.projectMenuOpen()) {
                <div class="absolute left-0 mt-2 w-64 rounded-xl bg-bg-1 border border-border-strong shadow-2xl p-1.5 z-50">
                  <div class="px-2.5 py-1 text-[11px] font-label-uppercase text-text-3 uppercase">Projects</div>
                  @for (p of store.projects(); track p.id) {
                    <button
                      type="button"
                      (click)="store.selectProject(p.id)"
                      class="w-full text-left px-2.5 py-2 rounded-lg text-sm flex items-center justify-between hover:bg-bg-3 transition-colors"
                      [class.bg-bg-3]="p.id === store.selectedProjectId()"
                      [class.text-node-queue]="p.id === store.selectedProjectId()"
                    >
                      <span class="truncate">{{ p.name }}</span>
                      @if (p.id === store.selectedProjectId()) {
                        <span class="material-symbols-outlined text-[16px]">check</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Live / Incident Badge -->
            @if (store.liveVariant() === 'v2' && store.totalErrors() > 0) {
              <div class="flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-status-error/10 border border-status-error/40">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-error opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-status-error"></span>
                </span>
                <span class="font-chip-metric text-chip-metric text-status-error uppercase tracking-wider font-semibold">
                  Incident Active
                </span>
              </div>
            } @else {
              <div class="flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-bg-2 border border-border-structural">
                <span class="relative flex h-2 w-2">
                  @if (store.wsConnected()) {
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-status-ok"></span>
                  } @else {
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-status-warn"></span>
                  }
                </span>
                <span
                  class="font-chip-metric text-chip-metric uppercase tracking-wider font-semibold"
                  [class.text-status-ok]="store.wsConnected()"
                  [class.text-status-warn]="!store.wsConnected()"
                >
                  {{ store.wsConnected() ? 'Live' : 'Sync' }}
                </span>
              </div>
            }

            <nav class="hidden lg:flex items-center gap-space-xs ml-space-sm">
              <a
                routerLink="/"
                routerLinkActive="bg-bg-3 text-text-1 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                class="px-space-sm py-1 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors font-label-md text-label-md"
              >
                Live Topology
              </a>
              <button
                type="button"
                (click)="store.setLiveVariant('v2')"
                class="px-space-sm py-1 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors font-label-md text-label-md"
                [class.bg-bg-3]="store.liveVariant() === 'v2'"
                [class.text-text-1]="store.liveVariant() === 'v2'"
              >
                Traces
              </button>
              <button
                type="button"
                (click)="store.setLiveVariant('v3')"
                class="px-space-sm py-1 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors font-label-md text-label-md"
                [class.bg-bg-3]="store.liveVariant() === 'v3'"
                [class.text-text-1]="store.liveVariant() === 'v3'"
              >
                Service Mesh
              </button>
              <button
                type="button"
                (click)="store.setLiveVariant('minimalist')"
                class="px-space-sm py-1 rounded-lg text-text-2 hover:bg-bg-2 hover:text-text-1 transition-colors font-label-md text-label-md"
                [class.bg-bg-3]="store.liveVariant() === 'minimalist'"
                [class.text-text-1]="store.liveVariant() === 'minimalist'"
              >
                Studio
              </button>
            </nav>
          </div>

          <div class="flex items-center gap-space-sm">
            <!-- Search Trace ID -->
            <div class="relative hidden sm:flex items-center">
              <span class="material-symbols-outlined absolute left-space-sm text-text-3 text-[18px] pointer-events-none">search</span>
              <input
                type="text"
                [ngModel]="store.searchQuery()"
                (ngModelChange)="store.searchQuery.set($event)"
                class="w-48 lg:w-64 h-8 pl-8 pr-12 rounded-lg bg-bg-3 border border-border-structural text-text-1 placeholder:text-text-3 font-body-md text-body-md focus:outline-none focus:border-node-queue transition-colors"
                placeholder="search trace id…"
              />
              <kbd class="absolute right-space-sm px-1.5 py-0.5 rounded bg-bg-2 border border-border-structural text-text-3 font-code-sm text-[10px]">
                ⌘K
              </kbd>
            </div>

            <!-- Template & Variant Switcher Button -->
            <div class="relative">
              <button
                type="button"
                (click)="toggleVariantMenu()"
                class="flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-bg-3 border border-node-queue/40 text-node-queue hover:bg-bg-2 transition-all font-label-md text-label-md"
                title="Switch Screen Template & Flow Architecture"
              >
                <span class="material-symbols-outlined text-[16px]">style</span>
                <span class="hidden md:inline">{{ activeVariantLabel() }}</span>
                <span class="material-symbols-outlined text-[15px]">expand_more</span>
              </button>
            </div>

            <button
              type="button"
              (click)="store.toggleTheme()"
              class="flex items-center justify-center w-8 h-8 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 hover:border-border-strong transition-all"
              title="Toggle Dark / Light Theme"
            >
              <span class="material-symbols-outlined text-[18px]">
                {{ store.theme() === 'dark' ? 'dark_mode' : 'light_mode' }}
              </span>
            </button>

            <button
              type="button"
              (click)="store.toggleDemo()"
              class="hidden md:flex items-center gap-space-xs px-space-sm h-8 rounded-lg border transition-all font-label-md text-label-md"
              [class.bg-status-ok/15]="store.demoRunning()"
              [class.border-status-ok/40]="store.demoRunning()"
              [class.text-status-ok]="store.demoRunning()"
              [class.bg-bg-3]="!store.demoRunning()"
              [class.border-border-structural]="!store.demoRunning()"
              [class.text-text-1]="!store.demoRunning()"
            >
              <span class="material-symbols-outlined text-[16px]">
                {{ store.demoRunning() ? 'stop_circle' : 'play_circle' }}
              </span>
              <span>{{ store.demoRunning() ? 'Demo On' : 'Start Demo' }}</span>
            </button>

            <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>
      </header>
    }

    <!-- Shared Template & Variant Switcher Popover -->
    @if (store.variantMenuOpen()) {
      <div
        class="fixed top-16 right-4 z-50 w-80 rounded-2xl bg-bg-1 border border-border-strong shadow-2xl p-3 space-y-3"
      >
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="font-label-uppercase text-[11px] text-text-3 uppercase font-semibold">
              Screen Layout Variant
            </span>
            <button
              type="button"
              (click)="store.variantMenuOpen.set(false)"
              class="text-text-3 hover:text-text-1"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
          <div class="space-y-1">
            @for (v of store.variants; track v.id) {
              <button
                type="button"
                (click)="store.setLiveVariant(v.id)"
                class="w-full text-left px-2.5 py-2 rounded-xl border transition-all flex items-start justify-between gap-2"
                [class.bg-bg-3]="store.liveVariant() === v.id"
                [class.border-node-queue/60]="store.liveVariant() === v.id"
                [class.border-border-structural]="store.liveVariant() !== v.id"
                [class.hover:bg-bg-2]="store.liveVariant() !== v.id"
              >
                <div>
                  <div class="text-xs font-semibold text-text-1">{{ v.name }}</div>
                  <div class="text-[11px] text-text-3 leading-snug mt-0.5">{{ v.description }}</div>
                </div>
                @if (store.liveVariant() === v.id) {
                  <span class="material-symbols-outlined text-[16px] text-node-queue shrink-0">check_circle</span>
                }
              </button>
            }
          </div>
        </div>

        <div class="pt-2 border-t border-border-structural">
          <div class="font-label-uppercase text-[11px] text-text-3 uppercase font-semibold mb-1.5">
            Flow Block Template (Backend)
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            @for (tpl of flowTemplates; track tpl.id) {
              <button
                type="button"
                (click)="applyFlowTemplate(tpl.id)"
                class="px-2.5 py-2 rounded-lg border text-left transition-all"
                [class.bg-bg-3]="store.activeTemplateId() === tpl.id"
                [class.border-node-queue/60]="store.activeTemplateId() === tpl.id"
                [class.border-border-structural]="store.activeTemplateId() !== tpl.id"
              >
                <div class="text-xs font-semibold text-text-1 flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[15px] text-node-queue">{{ tpl.icon }}</span>
                  <span class="truncate">{{ tpl.label }}</span>
                </div>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class TopHeaderComponent {
  public readonly store = inject(FlowSessionStore);

  public readonly activeVariantLabel = computed(() => {
    const found = this.store.variants.find((v) => v.id === this.store.liveVariant());
    return found?.shortLabel ?? 'V1 Classic';
  });

  public readonly flowTemplates: Array<{ id: FlowTemplateId; label: string; icon: string }> = [
    { id: 'microservices', label: 'Microservices', icon: 'hub' },
    { id: 'online-shop', label: 'Online Shop', icon: 'storefront' },
    { id: 'queue-worker', label: 'Queue Bus', icon: 'stream' },
    { id: 'ai-rag', label: 'AI / RAG', icon: 'psychology' },
  ];

  public toggleVariantMenu(): void {
    this.store.projectMenuOpen.set(false);
    this.store.variantMenuOpen.set(!this.store.variantMenuOpen());
  }

  public toggleProjectMenu(): void {
    this.store.variantMenuOpen.set(false);
    this.store.projectMenuOpen.set(!this.store.projectMenuOpen());
  }

  public async applyFlowTemplate(id: FlowTemplateId): Promise<void> {
    this.store.variantMenuOpen.set(false);
    await this.store.applyTemplate(id);
  }
}
