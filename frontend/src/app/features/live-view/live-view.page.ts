import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowCanvasComponent } from './components/flow-canvas.component';
import { NodeInspectorDrawerComponent } from './components/node-inspector-drawer.component';

@Component({
  selector: 'app-live-view-page',
  standalone: true,
  imports: [CommonModule, FlowCanvasComponent, NodeInspectorDrawerComponent],
  template: `
    <!-- V2 Incident Banner when errors are present -->
    @if (store.liveVariant() === 'v2' && store.totalErrors() > 0) {
      <aside
        aria-label="Critical Incident Alert"
        class="fixed top-14 left-0 right-0 z-40 h-10 bg-status-error/15 border-b border-status-error/40 px-gutter flex items-center justify-between backdrop-blur-md"
      >
        <div class="flex items-center gap-space-sm overflow-hidden text-ellipsis whitespace-nowrap">
          <span class="inline-flex items-center justify-center w-5 h-5 rounded-md bg-status-error text-bg-0 shrink-0 font-bold">
            <span class="material-symbols-outlined text-[16px]">warning</span>
          </span>
          <span class="font-code-sm text-code-sm font-semibold text-status-error uppercase tracking-wider">
            INCIDENT ACTIVE:
          </span>
          <span class="font-body-md text-text-1 text-sm font-medium">
            {{ store.totalErrors() }} failed spans detected in {{ store.activeProject()?.name || 'Production Mesh' }}
          </span>
        </div>
        <button
          type="button"
          (click)="store.activeFilterTier.set('degraded')"
          class="px-3 py-1 rounded-md bg-status-error hover:bg-status-error/90 text-bg-0 font-label-md text-xs font-semibold transition-colors"
        >
          Isolate Degraded
        </button>
      </aside>
    }

    <div
      class="w-full bg-bg-0 overflow-hidden"
      [class.pt-0]="store.liveVariant() === 'minimalist'"
      [class.h-screen]="store.liveVariant() === 'minimalist'"
      [class.pt-14]="store.liveVariant() !== 'minimalist' && !(store.liveVariant() === 'v2' && store.totalErrors() > 0)"
      [class.pt-24]="store.liveVariant() === 'v2' && store.totalErrors() > 0"
      [style.height]="store.liveVariant() === 'minimalist' ? '100vh' : '100vh'"
    >
      <div class="flex w-full h-full relative overflow-hidden bg-bg-0">
        <!-- Left Palette / Quick Scope Sub-rail -->
        @if (store.liveVariant() === 'minimalist') {
          <aside class="absolute left-6 top-1/2 -translate-y-1/2 z-20 hidden md:flex flex-col gap-1.5 p-1.5 rounded-2xl bg-bg-1/85 border border-border-structural backdrop-blur-xl shadow-2xl">
            <button
              type="button"
              (click)="store.resetViewport()"
              class="w-9 h-9 rounded-xl bg-bg-3 text-node-queue flex items-center justify-center transition-colors hover:bg-bg-2"
              title="Reset Pan & Zoom"
            >
              <span class="material-symbols-outlined text-[18px]">near_me</span>
            </button>
            <button
              type="button"
              (click)="store.zoomIn()"
              class="w-9 h-9 rounded-xl text-text-2 hover:text-text-1 hover:bg-bg-3 flex items-center justify-center transition-colors"
              title="Zoom In"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
            <button
              type="button"
              (click)="store.zoomOut()"
              class="w-9 h-9 rounded-xl text-text-2 hover:text-text-1 hover:bg-bg-3 flex items-center justify-center transition-colors"
              title="Zoom Out"
            >
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <div class="w-5 h-px bg-border-structural mx-auto my-1"></div>
            <button
              type="button"
              (click)="store.inspectorOpen.set(!store.inspectorOpen())"
              class="w-9 h-9 rounded-xl text-text-2 hover:text-text-1 hover:bg-bg-3 flex items-center justify-center transition-colors"
              title="Toggle Inspector Card"
            >
              <span class="material-symbols-outlined text-[18px]">dock_to_left</span>
            </button>
          </aside>
        } @else {
          <div class="hidden xl:flex flex-col w-14 shrink-0 bg-bg-1 border-r border-border-structural items-center py-space-md justify-between z-20">
            <div class="flex flex-col gap-space-sm items-center">
              <button
                type="button"
                (click)="store.resetViewport()"
                class="w-9 h-9 rounded-lg bg-bg-3 text-text-1 flex items-center justify-center border border-border-strong hover:bg-bg-2 transition-colors"
                title="Reset Pan & Zoom"
              >
                <span class="material-symbols-outlined text-[20px]">pan_tool</span>
              </button>
              <button
                type="button"
                (click)="store.zoomIn()"
                class="w-9 h-9 rounded-lg bg-bg-2 text-text-2 flex items-center justify-center hover:text-text-1 hover:bg-bg-3 transition-colors"
                title="Zoom In"
              >
                <span class="material-symbols-outlined text-[20px]">zoom_in</span>
              </button>
              <button
                type="button"
                (click)="store.zoomOut()"
                class="w-9 h-9 rounded-lg bg-bg-2 text-text-2 flex items-center justify-center hover:text-text-1 hover:bg-bg-3 transition-colors"
                title="Zoom Out"
              >
                <span class="material-symbols-outlined text-[20px]">zoom_out</span>
              </button>
              <div class="w-6 h-px bg-border-structural my-space-xs"></div>
              <button
                type="button"
                (click)="store.toggleLabels()"
                class="w-9 h-9 rounded-lg bg-bg-2 text-text-2 flex items-center justify-center hover:text-text-1 hover:bg-bg-3 transition-colors"
                title="Toggle Edge & Token Labels"
              >
                <span class="material-symbols-outlined text-[20px]">layers</span>
              </button>
              <button
                type="button"
                (click)="store.cycleLiveVariant()"
                class="w-9 h-9 rounded-lg bg-bg-2 text-node-queue flex items-center justify-center hover:bg-bg-3 transition-colors"
                title="Switch Live View Template Variation"
              >
                <span class="material-symbols-outlined text-[20px]">style</span>
              </button>
            </div>

            <div class="flex flex-col gap-space-sm items-center">
              <button
                type="button"
                (click)="store.inspectorOpen.set(!store.inspectorOpen())"
                class="w-9 h-9 rounded-lg bg-bg-2 text-status-ok flex items-center justify-center hover:bg-bg-3 transition-colors relative"
                title="Toggle Node Inspector"
              >
                <span class="material-symbols-outlined text-[20px]">troubleshoot</span>
                <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-status-ok"></span>
              </button>
            </div>
          </div>
        }

        <!-- Center Canvas Viewport -->
        <app-flow-canvas class="flex-1 h-full flex min-w-0" />

        <!-- Right-Hand Inspector Drawer / Studio / HUD -->
        <app-node-inspector-drawer />
      </div>
    </div>
  `,
})
export class LiveViewPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);

  public ngOnInit(): void {
    void this.store.init();
  }
}
