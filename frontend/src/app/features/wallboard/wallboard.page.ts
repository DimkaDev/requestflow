import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowCanvasComponent } from '../live-view/components/flow-canvas.component';

@Component({
  selector: 'app-wallboard-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FlowCanvasComponent],
  template: `
    <div class="pt-14 h-screen w-screen overflow-hidden flex flex-col bg-[#FAF7F2] text-[#1C1917]">
      <div class="px-8 py-4 bg-white border-b border-[#E7E2D8] flex items-center justify-between">
        <div class="flex items-center gap-4">
          <span class="w-3 h-3 rounded-full bg-status-ok animate-pulse"></span>
          <h1 class="text-xl font-bold tracking-tight">
            {{ store.activeProject()?.name || 'FlowTrace' }} · TV Showroom Wallboard
          </h1>
        </div>
        <div class="flex items-center gap-6 font-code-block text-lg font-semibold">
          <span>{{ store.totalRps() }} <span class="text-xs font-normal opacity-60">req/s</span></span>
          <span>{{ store.activeTokens().length }} <span class="text-xs font-normal opacity-60">in-flight</span></span>
          <span [class.text-status-error]="store.totalErrors() > 0" [class.text-status-ok]="store.totalErrors() === 0">
            {{ store.totalErrors() }} <span class="text-xs font-normal opacity-60">errors</span>
          </span>
          <a
            routerLink="/"
            class="px-3 py-1.5 rounded-lg bg-[#1C1917] text-white text-xs font-sans font-medium"
          >
            Exit Wallboard
          </a>
        </div>
      </div>

      <div class="flex-1 relative">
        <app-flow-canvas class="block w-full h-full" />
      </div>
    </div>
  `,
})
export class WallboardPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);

  public ngOnInit(): void {
    this.store.setTheme('cozy-light');
  }
}
