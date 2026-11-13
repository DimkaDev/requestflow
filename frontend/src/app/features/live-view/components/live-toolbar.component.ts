import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlowSessionStore } from '../../../core/flow-session.store';

@Component({
  selector: 'app-live-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div
        class="h-11 px-3.5 rounded-full bg-bg-1/90 border border-border-structural backdrop-blur-xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex items-center gap-space-md"
      >
        <!-- Play / Pause Live -->
        <button
          type="button"
          (click)="store.togglePause()"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-3 border border-border-structural hover:border-border-strong text-text-1 transition-all"
          title="Pause or Resume Live Animation"
        >
          <span
            class="w-2 h-2 rounded-full"
            [class.bg-status-ok]="!store.paused()"
            [class.animate-pulse]="!store.paused()"
            [class.bg-status-warn]="store.paused()"
          ></span>
          <span
            class="font-label-md text-label-md font-semibold"
            [class.text-status-ok]="!store.paused()"
            [class.text-status-warn]="store.paused()"
          >
            {{ store.paused() ? 'Paused' : 'Live' }}
          </span>
        </button>

        <div class="h-4 w-px bg-border-structural"></div>

        <!-- Speed Slider -->
        <div class="flex items-center gap-2">
          <span class="font-code-sm text-code-sm text-text-3 font-medium">Speed:</span>
          <input
            type="range"
            min="0.25"
            max="4"
            step="0.25"
            [ngModel]="store.speedMultiplier()"
            (ngModelChange)="store.setSpeed(+$event)"
            class="w-16 h-1 bg-bg-3 rounded-lg appearance-none cursor-pointer accent-node-queue"
          />
          <span class="font-code-sm text-code-sm text-text-1 font-semibold w-8 tabular-nums">
            {{ store.speedMultiplier().toFixed(1) }}×
          </span>
        </div>

        <div class="h-4 w-px bg-border-structural hidden sm:block"></div>

        <!-- Mode Toggle Pill -->
        <div class="hidden sm:flex items-center p-0.5 rounded-full bg-bg-0 border border-border-structural text-text-2 text-label-sm font-label-sm">
          <button
            type="button"
            (click)="store.setStreamMode('realtime')"
            class="px-2.5 py-1 rounded-full transition-colors"
            [class.bg-bg-2]="store.streamMode() === 'realtime'"
            [class.text-text-1]="store.streamMode() === 'realtime'"
            [class.font-medium]="store.streamMode() === 'realtime'"
            [class.text-text-3]="store.streamMode() !== 'realtime'"
          >
            Realtime
          </button>
          <button
            type="button"
            (click)="store.setStreamMode('smooth')"
            class="px-2.5 py-1 rounded-full transition-colors"
            [class.bg-bg-2]="store.streamMode() === 'smooth'"
            [class.text-text-1]="store.streamMode() === 'smooth'"
            [class.font-medium]="store.streamMode() === 'smooth'"
            [class.text-text-3]="store.streamMode() !== 'smooth'"
          >
            Smooth
          </button>
        </div>

        <!-- Labels Toggle Pill -->
        <button
          type="button"
          (click)="store.toggleLabels()"
          class="px-2.5 py-1 rounded-full border font-label-sm text-label-sm font-medium flex items-center gap-1 transition-colors"
          [class.bg-bg-3]="store.showLabels()"
          [class.border-node-queue/50]="store.showLabels()"
          [class.text-node-queue]="store.showLabels()"
          [class.bg-bg-0]="!store.showLabels()"
          [class.border-border-structural]="!store.showLabels()"
          [class.text-text-3]="!store.showLabels()"
        >
          <span class="material-symbols-outlined text-[14px]">
            {{ store.showLabels() ? 'check' : 'visibility_off' }}
          </span>
          <span>Labels</span>
        </button>

        <div class="h-4 w-px bg-border-structural"></div>

        <!-- Fit to Screen -->
        <button
          type="button"
          (click)="store.resetViewport()"
          class="w-7 h-7 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 flex items-center justify-center transition-colors"
          title="Fit to Screen"
        >
          <span class="material-symbols-outlined text-[16px]">fit_screen</span>
        </button>

        <!-- Cycle Template Variant -->
        <button
          type="button"
          (click)="store.cycleLiveVariant()"
          class="px-3 py-1 rounded-lg bg-bg-3 border border-border-structural hover:border-node-queue/50 text-text-1 font-label-md text-label-md flex items-center gap-1 transition-all"
          title="Switch Live View Template Variation"
        >
          <span class="material-symbols-outlined text-[15px] text-node-queue">style</span>
          <span>Template</span>
        </button>
      </div>
    </div>
  `,
})
export class LiveToolbarComponent {
  public readonly store = inject(FlowSessionStore);
}
