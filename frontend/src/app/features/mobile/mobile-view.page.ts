import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';

@Component({
  selector: 'app-mobile-view-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1 pb-20">
      <div class="max-w-md mx-auto px-4 py-5 space-y-5">
        <div class="rounded-2xl bg-bg-1 border border-border-structural p-4 flex items-center justify-between">
          <div>
            <div class="text-[11px] uppercase tracking-wider text-text-3">Owner Mobile View</div>
            <div class="text-base font-semibold text-text-1">{{ store.activeProject()?.name || 'Production Mesh' }}</div>
          </div>
          <span
            class="px-2.5 py-1 rounded-full text-xs font-semibold"
            [class.bg-status-ok/15]="store.totalErrors() === 0"
            [class.text-status-ok]="store.totalErrors() === 0"
            [class.bg-status-error/15]="store.totalErrors() > 0"
            [class.text-status-error]="store.totalErrors() > 0"
          >
            {{ store.totalErrors() > 0 ? 'Degraded' : 'Healthy' }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2.5">
          <div class="rounded-xl bg-bg-2 border border-border-structural p-3">
            <div class="text-[10px] text-text-3 uppercase">Throughput</div>
            <div class="font-code-block text-lg font-semibold text-node-queue mt-1">{{ store.totalRps() }}/s</div>
          </div>
          <div class="rounded-xl bg-bg-2 border border-border-structural p-3">
            <div class="text-[10px] text-text-3 uppercase">In-Flight</div>
            <div class="font-code-block text-lg font-semibold text-text-1 mt-1">{{ store.activeTokens().length }}</div>
          </div>
          <div class="rounded-xl bg-bg-2 border border-border-structural p-3">
            <div class="text-[10px] text-text-3 uppercase">Errors</div>
            <div class="font-code-block text-lg font-semibold text-status-error mt-1">{{ store.totalErrors() }}</div>
          </div>
        </div>

        <div class="rounded-2xl bg-bg-1 border border-border-structural p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold text-text-1">Recent Traces</h2>
            <a routerLink="/traces" class="text-xs text-node-queue">Replay →</a>
          </div>
          <div class="space-y-2">
            @for (t of store.recentTraces().slice(0, 6); track t.id) {
              <div class="p-3 rounded-xl bg-bg-2 border border-border-structural flex items-center justify-between text-xs">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    [class.bg-status-error]="t.status === 'error'"
                    [class.bg-status-ok]="t.status !== 'error'"
                  ></span>
                  <span class="font-code-sm truncate">{{ t.id }}</span>
                </div>
                <span class="font-code-sm text-text-3">{{ t.eventCount }} hops</span>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Mobile Bottom Nav -->
      <nav class="fixed bottom-0 inset-x-0 h-14 bg-bg-1 border-t border-border-structural flex items-center justify-around text-[11px]">
        <a routerLink="/" class="flex flex-col items-center text-text-2">
          <span class="material-symbols-outlined text-[20px]">hub</span>
          <span>Live</span>
        </a>
        <a routerLink="/traces" class="flex flex-col items-center text-text-2">
          <span class="material-symbols-outlined text-[20px]">route</span>
          <span>Traces</span>
        </a>
        <a routerLink="/alerts" class="flex flex-col items-center text-text-2">
          <span class="material-symbols-outlined text-[20px]">notifications</span>
          <span>Alerts</span>
        </a>
        <a routerLink="/shop" class="flex flex-col items-center text-text-2">
          <span class="material-symbols-outlined text-[20px]">storefront</span>
          <span>Shop</span>
        </a>
      </nav>
    </div>
  `,
})
export class MobileViewPageComponent {
  public readonly store = inject(FlowSessionStore);
}
