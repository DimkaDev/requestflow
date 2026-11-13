import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FlowSessionStore } from '../../../core/flow-session.store';

@Component({
  selector: 'app-canvas-minimap',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="absolute bottom-20 right-6 w-40 h-28 rounded-xl bg-bg-1/95 border border-border-structural p-2 shadow-xl backdrop-blur-md z-20 flex flex-col justify-between pointer-events-auto"
    >
      <div class="flex items-center justify-between">
        <span class="font-chip-metric text-[10px] uppercase tracking-wider text-text-3 font-semibold">
          Minimap
        </span>
        <span class="font-code-sm text-[10px] text-text-3">
          {{ Math.round(store.zoom() * 100) }}%
        </span>
      </div>

      <div class="relative w-full h-20 bg-bg-0 rounded-lg overflow-hidden border border-border-structural/50">
        <svg class="w-full h-full" viewBox="0 0 160 80">
          @for (edge of miniEdges(); track edge.id) {
            <line
              [attr.x1]="edge.x1"
              [attr.y1]="edge.y1"
              [attr.x2]="edge.x2"
              [attr.y2]="edge.y2"
              stroke="#343C4F"
              stroke-width="1.2"
            />
          }
          @for (pt of miniNodes(); track pt.key) {
            <circle
              [attr.cx]="pt.cx"
              [attr.cy]="pt.cy"
              [attr.r]="pt.selected ? 3.5 : 2.8"
              [attr.fill]="pt.color"
              [attr.stroke]="pt.selected ? '#22D3EE' : null"
              [attr.stroke-width]="pt.selected ? 1 : 0"
            />
          }
          <rect
            x="16"
            y="4"
            width="128"
            height="72"
            rx="3"
            fill="none"
            stroke="#22D3EE"
            stroke-dasharray="2 2"
            stroke-width="1"
            opacity="0.75"
          />
        </svg>
      </div>
    </div>
  `,
})
export class CanvasMinimapComponent {
  public readonly store = inject(FlowSessionStore);
  public readonly Math = Math;

  private readonly bounds = computed(() => {
    const nodes = this.store.diagram().nodes;
    if (!nodes.length) {
      return { minX: 0, minY: 0, width: 800, height: 600 };
    }
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs) + 224;
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys) + 72;
    return {
      minX,
      minY,
      width: Math.max(200, maxX - minX),
      height: Math.max(200, maxY - minY),
    };
  });

  public readonly miniNodes = computed(() => {
    const b = this.bounds();
    const selected = this.store.selectedNode()?.key;
    const profile = this.store.templateProfile();
    return this.store.diagram().nodes.map((n) => ({
      key: n.key,
      cx: 16 + ((n.x + 100 - b.minX) / b.width) * 128,
      cy: 8 + ((n.y + 32 - b.minY) / b.height) * 64,
      selected: n.key === selected,
      color: profile.nodeTypeVisuals[n.type]?.accentHex ?? '#8B5CF6',
    }));
  });

  public readonly miniEdges = computed(() => {
    const map = new Map(this.miniNodes().map((n) => [n.key, n]));
    return this.store.diagram().edges
      .map((e) => {
        const from = map.get(e.from);
        const to = map.get(e.to);
        if (!from || !to) return null;
        return { id: e.id, x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy };
      })
      .filter((x): x is { id: string; x1: number; y1: number; x2: number; y2: number } => x !== null);
  });
}
