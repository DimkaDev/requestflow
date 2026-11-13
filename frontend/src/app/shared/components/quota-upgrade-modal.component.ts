import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-quota-upgrade-modal',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-xl rounded-2xl bg-bg-2 border border-node-queue/50 shadow-[0_25px_65px_-15px_rgba(0,0,0,0.9),0_0_45px_-8px_rgba(34,211,238,0.18)] overflow-hidden">
          <div class="p-6 space-y-5">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <div class="w-11 h-11 rounded-xl bg-status-warn/15 border border-status-warn/40 flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-status-warn text-[24px]">warning</span>
                </div>
                <div>
                  <span class="text-[10px] font-code-sm uppercase tracking-wider text-status-warn font-semibold">
                    Monthly Quota Reached
                  </span>
                  <h2 class="font-headline-sm text-lg font-semibold text-text-1">
                    Upgrade to keep streaming live traces
                  </h2>
                </div>
              </div>
              <button
                type="button"
                (click)="closed.emit()"
                class="text-text-3 hover:text-text-1"
              >
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div class="p-4 rounded-xl bg-bg-1 border border-border-structural space-y-2">
              <div class="flex justify-between text-xs">
                <span class="text-text-2">Monthly Event Ingestion</span>
                <span class="font-code-sm text-status-error font-semibold">
                  {{ usedEvents.toLocaleString() }} / {{ quotaLimit.toLocaleString() }} (100%)
                </span>
              </div>
              <div class="w-full h-2 rounded-full bg-bg-3 overflow-hidden">
                <div class="h-full w-full bg-gradient-to-r from-status-warn to-status-error"></div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div class="p-4 rounded-xl bg-bg-1 border border-border-structural space-y-1.5">
                <div class="text-xs font-semibold text-text-2">Free Tier (Current)</div>
                <div class="text-lg font-bold text-text-1">$0<span class="text-xs text-text-3 font-normal">/mo</span></div>
                <div class="text-[11px] text-text-3">100k events/mo · 7d retention</div>
              </div>
              <div class="p-4 rounded-xl bg-bg-1 border border-node-queue/60 space-y-1.5">
                <div class="text-xs font-semibold text-node-queue">Pro Mesh</div>
                <div class="text-lg font-bold text-text-1">$29<span class="text-xs text-text-3 font-normal">/mo</span></div>
                <div class="text-[11px] text-text-2">10M events/mo · 30d retention · Alerts</div>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                (click)="closed.emit()"
                class="px-4 py-2 rounded-xl bg-bg-3 text-xs text-text-2 hover:text-text-1"
              >
                Dismiss
              </button>
              <a
                routerLink="/billing"
                (click)="closed.emit()"
                class="px-5 py-2 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold shadow-[0_0_20px_rgba(34,211,238,0.3)]"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class QuotaUpgradeModalComponent {
  @Input() public open = false;
  @Input() public usedEvents = 100000;
  @Input() public quotaLimit = 100000;
  @Output() public closed = new EventEmitter<void>();
}
