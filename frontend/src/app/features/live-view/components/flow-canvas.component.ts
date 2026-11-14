import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FlowSessionStore } from '../../../core/flow-session.store';
import { DiagramEdge, DiagramNode } from '../../../core/models';
import { resolveNodeIcon } from '../../../core/template-visuals';
import { CanvasMinimapComponent } from './canvas-minimap.component';
import { LiveToolbarComponent } from './live-toolbar.component';

@Component({
  selector: 'app-flow-canvas',
  standalone: true,
  imports: [CommonModule, CanvasMinimapComponent, LiveToolbarComponent],
  template: `
    <div
      class="relative flex-1 h-full overflow-hidden select-none"
      [class.border-r]="store.liveVariant() === 'v2'"
      [class.border-border-structural]="store.liveVariant() === 'v2'"
      (mousedown)="onCanvasMouseDown($event)"
      (mousemove)="onCanvasMouseMove($event)"
      (mouseup)="onCanvasMouseUp()"
      (mouseleave)="onCanvasMouseUp()"
      (wheel)="onWheel($event)"
    >
      <!-- Dotted Background Grid -->
      <div
        class="absolute inset-0 pointer-events-none"
        [style.background-color]="'var(--bg-0)'"
        [style.background-image]="'radial-gradient(var(--grid-dot) 1.2px, transparent 1.2px)'"
        [style.background-size]="store.liveVariant() === 'minimalist' ? '32px 32px' : '24px 24px'"
      ></div>

      @if (store.liveVariant() === 'v3' || store.liveVariant() === 'minimalist') {
        <div
          class="absolute inset-0 pointer-events-none opacity-40"
          style="background: radial-gradient(circle at 50% 42%, rgba(34, 211, 238, 0.06), transparent 62%);"
        ></div>
      }

      <!-- Top Overlay Telemetry Controls -->
      @if (store.liveVariant() === 'v3') {
        <div class="absolute top-3 left-4 right-4 flex flex-wrap items-center justify-between gap-3 z-20 pointer-events-auto">
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-bg-1/95 border border-border-structural backdrop-blur-xl shadow-lg">
              <span class="font-code-sm text-code-sm text-text-3 font-semibold">MESH:</span>
              <span class="font-label-md text-label-md text-text-1 font-semibold flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-status-ok"></span>
                {{ store.activeProject()?.name || 'us-east-prod-mesh' }}
              </span>
              <span class="text-border-strong">/</span>
              <span class="font-code-sm text-code-sm text-node-queue">{{ store.templateProfile().tagline }}</span>
            </div>
            <div class="hidden lg:flex items-center gap-4 px-3.5 py-1.5 rounded-xl bg-bg-1/95 border border-border-structural backdrop-blur-xl shadow-lg font-code-sm text-code-sm">
              <div class="flex items-center gap-1.5">
                <span class="text-text-3 text-xs">Ingress:</span>
                <span class="text-text-1 font-semibold">{{ store.totalRps() }} req/s</span>
              </div>
              <span class="text-border-strong">|</span>
              <div class="flex items-center gap-1.5">
                <span class="text-text-3 text-xs">Errors:</span>
                <span class="font-semibold" [class.text-status-ok]="store.totalErrors() === 0" [class.text-status-error]="store.totalErrors() > 0">
                  {{ store.totalErrors() }}
                </span>
              </div>
              <span class="text-border-strong">|</span>
              <div class="flex items-center gap-1.5">
                <span class="text-text-3 text-xs">Nodes:</span>
                <span class="text-text-1 font-semibold">{{ store.diagram().nodes.length }} Active</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 p-1 rounded-xl bg-bg-1/95 border border-border-structural backdrop-blur-xl shadow-lg">
            <span class="text-[11px] text-text-3 uppercase tracking-wider px-2 font-medium">Filter:</span>
            <button
              type="button"
              (click)="store.activeFilterTier.set('all')"
              class="px-2.5 py-1 rounded-lg text-label-sm transition-colors"
              [class.bg-bg-3]="store.activeFilterTier() === 'all'"
              [class.text-text-1]="store.activeFilterTier() === 'all'"
              [class.font-semibold]="store.activeFilterTier() === 'all'"
              [class.text-text-2]="store.activeFilterTier() !== 'all'"
            >
              All Tiers
            </button>
            <button
              type="button"
              (click)="store.activeFilterTier.set('degraded')"
              class="px-2.5 py-1 rounded-lg text-label-sm transition-colors flex items-center gap-1"
              [class.bg-bg-3]="store.activeFilterTier() === 'degraded'"
              [class.text-text-1]="store.activeFilterTier() === 'degraded'"
              [class.text-text-2]="store.activeFilterTier() !== 'degraded'"
            >
              <span>Degraded</span>
              @if (store.totalErrors() > 0) {
                <span class="px-1.5 rounded-full bg-status-error/20 text-status-error text-[10px] font-bold">
                  {{ store.totalErrors() }}
                </span>
              }
            </button>
            <button
              type="button"
              (click)="store.activeFilterTier.set('edge')"
              class="px-2.5 py-1 rounded-lg text-label-sm transition-colors"
              [class.bg-bg-3]="store.activeFilterTier() === 'edge'"
              [class.text-text-1]="store.activeFilterTier() === 'edge'"
              [class.text-text-2]="store.activeFilterTier() !== 'edge'"
            >
              Edge
            </button>
            <button
              type="button"
              (click)="store.activeFilterTier.set('data')"
              class="px-2.5 py-1 rounded-lg text-label-sm transition-colors"
              [class.bg-bg-3]="store.activeFilterTier() === 'data'"
              [class.text-text-1]="store.activeFilterTier() === 'data'"
              [class.text-text-2]="store.activeFilterTier() !== 'data'"
            >
              Data Tier
            </button>
          </div>
        </div>
      } @else if (store.liveVariant() === 'minimalist') {
        <div class="absolute top-20 left-8 z-10 hidden lg:flex flex-col gap-1 pointer-events-none">
          <div class="text-[11px] font-mono uppercase tracking-widest text-text-3">Architecture Canvas</div>
          <div class="text-xs font-mono text-text-2 flex items-center gap-2">
            <span>{{ store.diagram().nodes.length }} Nodes</span>
            <span class="text-border-strong">•</span>
            <span class="text-status-ok">{{ store.templateProfile().displayName }}</span>
            <span class="text-border-strong">•</span>
            <span>{{ store.totalRps() }} req/s</span>
          </div>
        </div>
      } @else {
        <div class="absolute top-space-md left-space-lg flex items-center gap-space-md z-20 pointer-events-auto">
          <div class="flex items-center gap-space-sm px-space-md py-1.5 rounded-lg bg-bg-1/90 border border-border-structural backdrop-blur-md shadow-sm">
            <span class="font-code-sm text-code-sm text-text-3">MESH:</span>
            <span class="font-label-md text-label-md text-text-1 font-semibold">
              {{ store.activeProject()?.name || 'us-east-cluster-prod' }}
            </span>
            <span class="w-1 h-1 rounded-full bg-border-strong"></span>
            <span class="font-code-sm text-code-sm text-node-queue">
              {{ store.templateProfile().tagline }}
            </span>
          </div>
          <div class="hidden md:flex items-center gap-space-sm px-space-md py-1.5 rounded-lg bg-bg-1/90 border border-border-structural backdrop-blur-md shadow-sm">
            <span class="flex h-2 w-2 rounded-full" [class.bg-status-ok]="store.wsConnected()" [class.bg-status-warn]="!store.wsConnected()"></span>
            <span class="font-label-md text-label-md text-text-2">Mesh Ingress:</span>
            <span class="font-code-sm text-code-sm text-text-1 font-medium tabular-nums">{{ store.totalRps() }} req/s</span>
            <span class="text-border-strong">|</span>
            <span class="font-label-md text-label-md text-text-2">Active Tokens:</span>
            <span class="font-code-sm text-code-sm text-status-warn font-medium tabular-nums">{{ store.activeTokens().length }}</span>
          </div>
        </div>
      }

      <!-- Pan/Zoom Transformed Graph Layer -->
      <div
        class="absolute inset-0 origin-top-left transition-transform duration-75"
        [style.transform]="viewportTransform()"
      >
        <!-- SVG Graph Connections & Animated Flow Particles -->
        <svg class="absolute inset-0 w-[2400px] h-[1800px] pointer-events-none z-0 overflow-visible">
          <defs>
            <linearGradient id="edge-active-gradient" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="0" y2="900">
              <stop offset="0%" stop-color="#22D3EE"></stop>
              <stop offset="100%" stop-color="#8B5CF6"></stop>
            </linearGradient>
            <radialGradient cx="50%" cy="50%" id="particle-cyan-glow" r="50%">
              <stop offset="0%" stop-color="#22D3EE" stop-opacity="1"></stop>
              <stop offset="60%" stop-color="#8B5CF6" stop-opacity="0.75"></stop>
              <stop offset="100%" stop-color="#8B5CF6" stop-opacity="0"></stop>
            </radialGradient>
            <radialGradient cx="50%" cy="50%" id="particle-error-glow" r="50%">
              <stop offset="0%" stop-color="#F43F5E" stop-opacity="1"></stop>
              <stop offset="55%" stop-color="#F43F5E" stop-opacity="0.75"></stop>
              <stop offset="100%" stop-color="#F43F5E" stop-opacity="0"></stop>
            </radialGradient>
            <marker id="arrowhead" markerUnits="userSpaceOnUse" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <polygon fill="#343C4F" points="0 1.5, 7 4, 0 6.5"></polygon>
            </marker>
            <marker id="arrowhead-active" markerUnits="userSpaceOnUse" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <polygon fill="#8B5CF6" points="0 1.5, 7 4, 0 6.5"></polygon>
            </marker>
            <marker id="arrowhead-error" markerUnits="userSpaceOnUse" markerHeight="8" markerWidth="8" orient="auto" refX="7" refY="4">
              <polygon fill="#F43F5E" points="0 1.5, 7 4, 0 6.5"></polygon>
            </marker>
          </defs>

          <!-- Diagram Edges -->
          @for (edge of store.diagram().edges; track edge.id) {
            <path
              [attr.d]="getEdgePath(edge)"
              fill="none"
              [attr.stroke]="edgeStroke(edge)"
              [attr.stroke-width]="edgeActive(edge) ? 3 : 2"
              [attr.stroke-dasharray]="edgeErrors(edge) > 0 || edge.discovered ? '6 4' : null"
              stroke-linecap="round"
              [attr.marker-end]="edgeMarker(edge)"
            />
          }

          <!-- Ghost Edges (Auto-discovered unmapped hops) -->
          @for (ghost of store.ghostEdges(); track ghost.id) {
            <line
              [attr.x1]="ghost.x1"
              [attr.y1]="ghost.y1"
              [attr.x2]="ghost.x2"
              [attr.y2]="ghost.y2"
              stroke="#F59E0B"
              stroke-width="2"
              stroke-dasharray="5 5"
              opacity="0.75"
            />
          }

          <!-- Live Animated Tokens from AnimationEngine -->
          @for (tok of store.activeTokens(); track tok.id) {
            <g [attr.opacity]="tok.opacity">
              @for (pt of tok.trail; track $index) {
                <circle
                  [attr.cx]="pt.x"
                  [attr.cy]="pt.y"
                  [attr.r]="Math.max(1.5, 4 - $index * 0.45)"
                  [attr.fill]="tok.status === 'error' ? '#F43F5E' : '#22D3EE'"
                  [attr.opacity]="Math.max(0.1, 0.55 - $index * 0.08)"
                />
              }
              @if (isShopTemplate()) {
                <!-- Shop Live Demo: Animal Avatar Badge -->
                <circle
                  [attr.cx]="tok.x"
                  [attr.cy]="tok.y"
                  [attr.r]="18 * tok.scale"
                  [attr.fill]="tok.status === 'error' ? 'rgba(225, 29, 72, 0.16)' : 'rgba(157, 67, 0, 0.14)'"
                />
                <circle
                  [attr.cx]="tok.x"
                  [attr.cy]="tok.y"
                  [attr.r]="14 * tok.scale"
                  [attr.fill]="store.theme() === 'cozy-light' ? '#FFF8F5' : '#151B28'"
                  [attr.stroke]="tok.status === 'error' ? '#E11D48' : tok.toNode === 'paid' ? '#059669' : '#9D4300'"
                  stroke-width="2"
                />
                <text
                  [attr.x]="tok.x"
                  [attr.y]="tok.y + 5"
                  text-anchor="middle"
                  font-size="15"
                  class="select-none"
                >
                  {{ resolveShopAnimal(tok.id, tok.avatarIcon) }}
                </text>
                @if (tok.carriedIcons && tok.carriedIcons.length > 0) {
                  <circle
                    [attr.cx]="tok.x + 11"
                    [attr.cy]="tok.y - 11"
                    r="6.5"
                    fill="#9D4300"
                    stroke="#FFF8F5"
                    stroke-width="1.2"
                  />
                  <text
                    [attr.x]="tok.x + 11"
                    [attr.y]="tok.y - 8"
                    text-anchor="middle"
                    fill="#FFFFFF"
                    font-size="8"
                    font-weight="700"
                    font-family="JetBrains Mono, monospace"
                  >
                    {{ tok.carriedIcons.length }}
                  </text>
                }
                @if (store.showLabels() && tok.shortTag) {
                  <g [attr.transform]="'translate(' + tok.x + ',' + (tok.y + 24) + ')'">
                    <rect
                      x="-26"
                      y="-9"
                      width="52"
                      height="15"
                      rx="7.5"
                      [attr.fill]="tok.status === 'error' ? '#E11D48' : tok.toNode === 'paid' ? '#059669' : '#201B16'"
                    />
                    <text
                      x="0"
                      y="2"
                      text-anchor="middle"
                      fill="#FFFFFF"
                      font-size="9"
                      font-weight="600"
                      font-family="JetBrains Mono, monospace"
                    >
                      {{ tok.shortTag }}
                    </text>
                  </g>
                }
              } @else {
                <circle
                  [attr.cx]="tok.x"
                  [attr.cy]="tok.y"
                  [attr.r]="13 * tok.scale"
                  [attr.fill]="tok.status === 'error' ? 'url(#particle-error-glow)' : 'url(#particle-cyan-glow)'"
                />
                <circle
                  [attr.cx]="tok.x"
                  [attr.cy]="tok.y"
                  [attr.r]="5 * tok.scale"
                  [attr.fill]="tok.status === 'error' ? '#F43F5E' : '#22D3EE'"
                />
                @if (store.showLabels()) {
                  <g [attr.transform]="'translate(' + (tok.x + 10) + ',' + (tok.y - 10) + ')'">
                    <rect
                      x="0"
                      y="-10"
                      [attr.width]="tok.avatarIcon || (tok.carriedIcons && tok.carriedIcons.length) ? 84 : 58"
                      height="18"
                      rx="9"
                      fill="#11141B"
                      stroke="#262C3A"
                      stroke-width="1"
                    />
                    <text
                      x="7"
                      y="2"
                      fill="#E8ECF4"
                      font-size="10"
                      font-family="JetBrains Mono, monospace"
                    >
                      {{ tok.avatarIcon ? tok.avatarIcon + ' ' : '' }}{{ tok.shortTag }}
                    </text>
                  </g>
                }
              }
            </g>
          }
        </svg>

        <!-- Edge Label Pills -->
        @if (store.showLabels()) {
          @for (edge of store.diagram().edges; track edge.id) {
            @if (edge.label || getEdgePercentage(edge) !== null) {
              <div
                class="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
                [style.left.px]="getEdgeMidpoint(edge).x"
                [style.top.px]="getEdgeMidpoint(edge).y"
              >
                <span
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-2/95 border text-chip-metric font-chip-metric shadow-sm backdrop-blur-sm"
                  [class.border-status-error/40]="edgeErrors(edge) > 0"
                  [class.text-status-error]="edgeErrors(edge) > 0"
                  [class.border-border-structural]="edgeErrors(edge) === 0"
                  [class.text-text-1]="edgeErrors(edge) === 0"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    [class.bg-status-error]="edgeErrors(edge) > 0"
                    [class.bg-node-queue]="edgeErrors(edge) === 0"
                  ></span>
                  @if (edge.label) {
                    <span>{{ edge.label }}</span>
                  }
                  @if (getEdgePercentage(edge); as pct) {
                    <span
                      class="font-code-sm font-semibold tabular-nums"
                      [class.text-status-error]="edgeErrors(edge) > 0"
                      [class.text-text-3]="edgeErrors(edge) === 0"
                    >
                      {{ pct }}%
                    </span>
                  } @else if (getEdgePercentage(edge) === 0) {
                    <span class="font-code-sm text-text-3 tabular-nums">0%</span>
                  } @else if (store.getEdgeMetric(edge.id).hops > 0) {
                    <span class="text-text-3 font-code-sm tabular-nums">{{ store.getEdgeMetric(edge.id).hops }}</span>
                  }
                </span>
              </div>
            }
          }
        }

        <!-- Template-Driven Interactive Nodes -->
        <div class="absolute inset-0 z-10 pointer-events-none">
          @for (node of visibleNodes(); track node.key) {
            <div
              class="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
              [class.transition-transform]="draggingNodeKey() !== node.key"
              [style.left.px]="node.x"
              [style.top.px]="node.y"
              [style.width.px]="cardWidth()"
              [style.height.px]="cardHeight()"
              [style.transform]="nodeTransform(node.key)"
              (mousedown)="onNodeMouseDown(node, $event)"
              (click)="onNodeClick(node, $event)"
            >
              @if (store.liveVariant() === 'minimalist') {
                <!-- Minimalist Studio Card Style -->
                <div
                  class="relative w-full h-full rounded-2xl p-3 bg-bg-1/90 backdrop-blur-md border transition-colors flex flex-col justify-between shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
                  [class.border-node-queue]="isSelected(node.key)"
                  [class.shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_12px_32px_rgba(34,211,238,0.18)]]="isSelected(node.key)"
                  [class.border-status-error/60]="!isSelected(node.key) && nodeErrors(node.key) > 0"
                  [class.border-border-structural]="!isSelected(node.key) && nodeErrors(node.key) === 0"
                >
                  @if (isSelected(node.key)) {
                    <div class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-node-queue text-bg-0 font-mono text-[9px] font-bold tracking-wider uppercase">
                      Focus Node
                    </div>
                  }
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden select-none"
                        [ngClass]="typeVisual(node).accentBgClass + ' ' + typeVisual(node).accentTextClass"
                      >
                        <span class="material-symbols-outlined text-[17px] leading-none">{{ nodeIcon(node) }}</span>
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs font-semibold text-text-1 truncate">{{ node.label }}</div>
                        <div class="text-[10px] font-mono text-text-3 truncate">{{ node.key }}</div>
                      </div>
                    </div>
                    <span class="text-[10px] font-mono text-text-2 tabular-nums">
                      {{ nodeInRate(node.key) }} {{ typeVisual(node).metricUnit }}
                    </span>
                  </div>
                </div>
              } @else {
                <!-- Classic Ops / Incident Split / Kinetic Grid Card Style (Template-Dependent) -->
                <div
                  class="relative w-full h-full bg-bg-2 px-space-md py-space-xs flex items-center justify-between transition-all group overflow-visible"
                  [ngClass]="[
                    typeVisual(node).cardShapeClass,
                    isSelected(node.key)
                      ? 'border border-node-queue/80 shadow-[0_0_0_1.5px_rgba(34,211,238,0.5),0_0_24px_rgba(139,92,246,0.3)]'
                      : nodeErrors(node.key) > 0
                        ? 'border border-status-error shadow-[0_0_18px_rgba(244,63,94,0.25)]'
                        : 'border border-border-structural shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-border-strong'
                  ]"
                >
                  @if (node.type === 'decision') {
                    <div class="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-node-decision"></div>
                  }

                  @if (isSelected(node.key)) {
                    <div class="absolute -top-2.5 left-3 px-1.5 py-0.5 rounded bg-node-queue text-bg-0 font-chip-metric text-[10px] font-bold tracking-wider uppercase">
                      Active Focus
                    </div>
                  } @else if (store.liveVariant() === 'v2' && nodeErrors(node.key) > 0) {
                    <div class="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full bg-status-error text-bg-0 font-chip-metric text-[10px] font-bold tracking-wider uppercase">
                      Root Cause
                    </div>
                  }

                  <!-- Top Port Anchor -->
                  <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-bg-0 border-2 border-border-strong"></div>

                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 overflow-hidden select-none"
                      [ngClass]="typeVisual(node).accentBgClass + ' ' + typeVisual(node).accentTextClass"
                    >
                      <span class="material-symbols-outlined text-[22px] leading-none">{{ nodeIcon(node) }}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="font-body-node-label text-body-node-label text-text-1 truncate">
                        {{ node.label }}
                      </span>
                      <span class="font-code-sm text-code-sm text-text-3 truncate">
                        {{ node.key }}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-col items-end shrink-0 pl-1">
                    <span
                      class="font-code-sm text-code-sm font-semibold tabular-nums"
                      [ngClass]="typeVisual(node).accentTextClass"
                    >
                      {{ nodeInRate(node.key) }}
                    </span>
                    @if (nodeErrors(node.key) > 0) {
                      <span class="font-chip-metric text-chip-metric text-status-error font-semibold bg-status-error/15 border border-status-error/30 px-1.5 py-0.5 rounded-full flex items-center gap-1 mt-0.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-status-error animate-ping"></span>
                        {{ nodeErrors(node.key) }} err
                      </span>
                    } @else {
                      <span class="font-chip-metric text-chip-metric text-text-3">
                        {{ typeVisual(node).badgeLabel }}
                      </span>
                    }
                  </div>

                  <!-- Bottom Port Anchor -->
                  <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-bg-0 border-2 border-border-strong"></div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Minimap -->
      @if (store.liveVariant() !== 'v2') {
        <app-canvas-minimap />
      }

      <!-- Bottom Floating Pill Toolbar -->
      <app-live-toolbar />
    </div>
  `,
})
export class FlowCanvasComponent {
  public readonly store = inject(FlowSessionStore);
  public readonly Math = Math;

  private readonly dragging = signal<boolean>(false);
  public readonly draggingNodeKey = signal<string | null>(null);
  private lastX = 0;
  private lastY = 0;
  private nodeDragStartClientX = 0;
  private nodeDragStartClientY = 0;
  private nodeDragStartX = 0;
  private nodeDragStartY = 0;
  private nodeMoved = false;

  public readonly cardWidth = computed(() => this.store.templateProfile().cardWidth);
  public readonly cardHeight = computed(() => this.store.templateProfile().cardHeight);

  public readonly viewportTransform = computed(
    () => `translate(${this.store.panX()}px, ${this.store.panY()}px) scale(${this.store.zoom()})`
  );

  public readonly visibleNodes = computed(() => {
    const nodes = this.store.diagram().nodes;
    const filter = this.store.activeFilterTier();
    if (filter === 'all') return nodes;
    if (filter === 'degraded') return nodes.filter((n) => this.nodeErrors(n.key) > 0);
    if (filter === 'edge') return nodes.filter((n) => n.type === 'source' || n.type === 'queue' || n.type === 'decision');
    if (filter === 'data') return nodes.filter((n) => n.type === 'datastore' || n.type === 'end');
    return nodes;
  });

  public typeVisual(node: DiagramNode) {
    return this.store.templateProfile().nodeTypeVisuals[node.type];
  }

  public nodeIcon(node: DiagramNode): string {
    return resolveNodeIcon(this.store.activeTemplateId(), node.key, node.type, node.icon);
  }

  public isSelected(nodeKey: string): boolean {
    return this.store.selectedNode()?.key === nodeKey;
  }

  public nodeInRate(nodeKey: string): string {
    const count = this.store.getNodeMetric(nodeKey).in;
    return count >= 1000 ? `${(count / 1000).toFixed(1)}k/s` : `${count}/s`;
  }

  public nodeErrors(nodeKey: string): number {
    return this.store.getNodeMetric(nodeKey).errors;
  }

  public nodeTransform(nodeKey: string): string {
    const eff = this.store.getNodeEffect(nodeKey);
    if (!eff) return '';
    return `translateX(${eff.shakeOffsetPx}px) scale(${eff.pulseScale})`;
  }

  public getEdgePath(edge: DiagramEdge): string {
    return this.store.engine.buildEdgeSvgPath(edge.from, edge.to, 0);
  }

  public getEdgeMidpoint(edge: DiagramEdge): { x: number; y: number } {
    return this.store.engine.interpolateEdgePosition(edge.from, edge.to, 0.5, 0);
  }

  public isShopTemplate(): boolean {
    return this.store.activeTemplateId() === 'online-shop';
  }

  public resolveShopAnimal(seed: string, avatarIcon?: string | null): string {
    if (avatarIcon && avatarIcon !== '👤') return avatarIcon;
    const animals = ['🐼', '🦊', '🐱', '🐰', '🦁', '🐨', '🐸', '🦉'];
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    return animals[Math.abs(hash) % animals.length];
  }

  public getEdgePercentage(edge: DiagramEdge): number | null {
    const outgoing = this.store.diagram().edges.filter((e) => e.from === edge.from);
    if (outgoing.length <= 1) return null;
    const totalHops = outgoing.reduce((sum, e) => sum + this.store.getEdgeMetric(e.id).hops, 0);
    if (totalHops <= 0) return 0;
    return Math.round((this.store.getEdgeMetric(edge.id).hops / totalHops) * 100);
  }

  public edgeErrors(edge: DiagramEdge): number {
    return this.store.getEdgeMetric(edge.id).errors;
  }

  public edgeActive(edge: DiagramEdge): boolean {
    return (
      this.store.getEdgeMetric(edge.id).hops > 0 ||
      this.store.activeTokens().some((t) => t.fromNode === edge.from && t.toNode === edge.to)
    );
  }

  public edgeStroke(edge: DiagramEdge): string {
    if (this.edgeErrors(edge) > 0) return '#F43F5E';
    if (edge.discovered) return '#F59E0B';
    if (this.edgeActive(edge)) return 'url(#edge-active-gradient)';
    return '#343C4F';
  }

  public edgeMarker(edge: DiagramEdge): string {
    if (this.edgeErrors(edge) > 0) return 'url(#arrowhead-error)';
    if (this.edgeActive(edge)) return 'url(#arrowhead-active)';
    return 'url(#arrowhead)';
  }

  public onNodeMouseDown(node: DiagramNode, event: MouseEvent): void {
    if (event.button !== 0) return;
    event.stopPropagation();
    this.draggingNodeKey.set(node.key);
    this.nodeDragStartClientX = event.clientX;
    this.nodeDragStartClientY = event.clientY;
    this.nodeDragStartX = node.x;
    this.nodeDragStartY = node.y;
    this.nodeMoved = false;
  }

  public onNodeClick(node: DiagramNode, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.nodeMoved) {
      this.store.selectNode(node.key);
    }
    this.nodeMoved = false;
  }

  public onCanvasMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.dragging.set(true);
    this.lastX = event.clientX;
    this.lastY = event.clientY;
  }

  public onCanvasMouseMove(event: MouseEvent): void {
    const nodeKey = this.draggingNodeKey();
    if (nodeKey) {
      const dx = (event.clientX - this.nodeDragStartClientX) / this.store.zoom();
      const dy = (event.clientY - this.nodeDragStartClientY) / this.store.zoom();
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        this.nodeMoved = true;
      }
      if (this.nodeMoved) {
        this.store.updateNodePosition(
          nodeKey,
          Math.round(this.nodeDragStartX + dx),
          Math.round(this.nodeDragStartY + dy)
        );
      }
      return;
    }

    if (!this.dragging()) return;
    const dx = event.clientX - this.lastX;
    const dy = event.clientY - this.lastY;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    this.store.panX.set(this.store.panX() + dx);
    this.store.panY.set(this.store.panY() + dy);
  }

  public onCanvasMouseUp(): void {
    if (this.draggingNodeKey()) {
      const moved = this.nodeMoved;
      this.draggingNodeKey.set(null);
      if (moved) {
        void this.store.persistDiagramPositions();
      }
    }
    this.dragging.set(false);
  }

  public onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.store.zoomIn();
    } else {
      this.store.zoomOut();
    }
  }
}
