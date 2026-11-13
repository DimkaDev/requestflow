import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActiveToken, AnimationEngine } from '../../core/animation-engine';
import { FlowSessionStore } from '../../core/flow-session.store';
import { DiagramEdge, DiagramNode, TraceEventRecord, TraceSummary } from '../../core/models';
import { resolveNodeIcon, resolveTemplateProfile } from '../../core/template-visuals';

@Component({
  selector: 'app-traces-replay-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="pt-14 h-screen w-screen overflow-hidden flex bg-bg-0 text-text-1">
      <!-- LEFT COLUMN: TRACE LIST & FILTERS -->
      <aside class="w-[330px] shrink-0 bg-bg-1 border-r border-border-structural flex flex-col h-full">
        <div class="p-3.5 border-b border-border-structural space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-node-queue text-[18px]">route</span>
              <h1 class="font-headline-sm text-[15px] text-text-1">Traces &amp; Replay</h1>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-bg-3 text-text-2 font-code-sm text-[11px]">
              {{ visibleTraces().length }} traces
            </span>
          </div>

          <div class="relative flex items-center">
            <span class="material-symbols-outlined absolute left-2.5 text-text-3 text-[16px] pointer-events-none">
              search
            </span>
            <input
              type="text"
              [ngModel]="localSearch()"
              (ngModelChange)="localSearch.set($event)"
              placeholder="Filter trace id or node…"
              class="w-full h-8 pl-8 pr-3 rounded-lg bg-bg-3 border border-border-structural text-xs text-text-1 placeholder:text-text-3 focus:outline-none focus:border-node-queue"
            />
          </div>

          <div class="flex items-center gap-1 p-0.5 rounded-lg bg-bg-2 border border-border-structural">
            @for (tab of statusTabs; track tab.id) {
              <button
                type="button"
                (click)="statusFilter.set(tab.id)"
                class="flex-1 py-1 rounded-md text-[11px] font-medium transition-colors"
                [class.bg-bg-3]="statusFilter() === tab.id"
                [class.text-text-1]="statusFilter() === tab.id"
                [class.text-text-3]="statusFilter() !== tab.id"
              >
                {{ tab.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex-1 overflow-y-auto p-2.5 space-y-2">
          @if (visibleTraces().length === 0) {
            <div class="p-6 text-center space-y-2">
              <span class="material-symbols-outlined text-text-3 text-[28px]">hourglass_empty</span>
              <p class="text-xs text-text-3">No traces recorded yet. Start Demo or send events to inspect &amp; replay.</p>
              <button
                type="button"
                (click)="store.toggleDemo()"
                class="px-3 py-1.5 rounded-lg bg-node-queue/15 border border-node-queue/40 text-node-queue text-xs font-medium"
              >
                {{ store.demoRunning() ? 'Demo Running' : 'Start Demo Traffic' }}
              </button>
            </div>
          }

          @for (trace of visibleTraces(); track trace.id) {
            <button
              type="button"
              (click)="selectTrace(trace)"
              class="w-full text-left p-3 rounded-xl border transition-all"
              [class.bg-bg-2]="selectedTraceId() === trace.id"
              [class.border-node-queue/60]="selectedTraceId() === trace.id"
              [class.shadow-[0_0_16px_rgba(34,211,238,0.12)]="selectedTraceId() === trace.id"
              [class.bg-bg-1]="selectedTraceId() !== trace.id"
              [class.border-transparent]="selectedTraceId() !== trace.id"
              [class.hover:bg-bg-2]="selectedTraceId() !== trace.id"
            >
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2 min-w-0">
                  <span
                    class="w-2 h-2 rounded-full shrink-0"
                    [class.bg-status-error]="trace.status === 'error'"
                    [class.bg-status-ok]="trace.status !== 'error'"
                  ></span>
                  <span class="font-code-sm text-xs font-medium text-text-1 truncate">
                    {{ trace.id }}
                  </span>
                </div>
                <span
                  class="font-code-sm text-[11px] px-1.5 py-0.5 rounded shrink-0"
                  [class.text-status-error]="trace.status === 'error'"
                  [class.bg-status-error/10]="trace.status === 'error'"
                  [class.text-status-ok]="trace.status !== 'error'"
                  [class.bg-status-ok/10]="trace.status !== 'error'"
                >
                  {{ trace.eventCount }} hops
                </span>
              </div>

              <div class="flex items-center justify-between text-[11px] font-code-sm text-text-3">
                <span class="truncate">{{ trace.lastNode || 'ingress' }}</span>
                <span>{{ formatTime(trace.lastEventAt) }}</span>
              </div>
            </button>
          }
        </div>
      </aside>

      <!-- CENTER COLUMN: REPLAY DIAGRAM CANVAS & TIMELINE SCRUBBER -->
      <section class="relative flex-1 h-full bg-bg-0 overflow-hidden flex flex-col select-none">
        <div
          class="absolute inset-0 pointer-events-none opacity-40"
          style="background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px); background-size: 24px 24px;"
        ></div>

        <!-- Top Replay Status Overlay -->
        <div class="absolute top-4 left-5 right-5 flex items-center justify-between z-20 pointer-events-none">
          <div class="flex items-center gap-3 bg-bg-1/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border-structural shadow-xl pointer-events-auto">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-node-queue text-[18px]">replay</span>
              <span class="text-xs text-text-2">Replaying Trace:</span>
              <span class="font-code-sm text-xs text-text-1 font-semibold">
                {{ activeDetail()?.summary?.id || 'Select a trace' }}
              </span>
            </div>
            @if (activeDetail()) {
              <button
                type="button"
                (click)="copyTraceId()"
                class="text-text-3 hover:text-text-1 flex items-center transition-colors"
                title="Copy Trace ID"
              >
                <span class="material-symbols-outlined text-[15px]">
                  {{ copiedId() ? 'check' : 'content_copy' }}
                </span>
              </button>
              <div class="h-3.5 w-px bg-border-structural"></div>
              <div class="flex items-center gap-2 font-code-sm text-xs">
                <span class="text-text-3">Duration:</span>
                <span class="text-node-queue font-semibold">{{ totalDurationMs() }}ms</span>
                @if (activeDetail()?.summary?.status === 'error') {
                  <span class="px-1.5 py-0.5 rounded bg-status-error/15 text-status-error text-[10px] font-medium">
                    ERROR
                  </span>
                }
              </div>
            }
          </div>

          <div class="flex items-center gap-1 bg-bg-1/85 backdrop-blur-md p-1 rounded-xl border border-border-structural shadow-xl pointer-events-auto">
            <button
              type="button"
              (click)="zoom.set(Math.min(1.6, zoom() + 0.15))"
              class="w-8 h-8 rounded-lg text-text-2 hover:text-text-1 hover:bg-bg-2 flex items-center justify-center"
              title="Zoom in"
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
            <span class="font-code-sm text-[11px] text-text-3 px-1">{{ Math.round(zoom() * 100) }}%</span>
            <button
              type="button"
              (click)="zoom.set(Math.max(0.5, zoom() - 0.15))"
              class="w-8 h-8 rounded-lg text-text-2 hover:text-text-1 hover:bg-bg-2 flex items-center justify-center"
              title="Zoom out"
            >
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <div class="h-4 w-px bg-border-structural"></div>
            <button
              type="button"
              (click)="zoom.set(1)"
              class="w-8 h-8 rounded-lg text-text-2 hover:text-text-1 hover:bg-bg-2 flex items-center justify-center"
              title="Reset zoom"
            >
              <span class="material-symbols-outlined text-[18px]">crop_free</span>
            </button>
          </div>
        </div>

        <!-- Graph Stage -->
        <div class="relative flex-1 overflow-auto flex items-center justify-center p-10 pb-36">
          <div
            class="relative origin-center transition-transform duration-150"
            [style.width.px]="stageBounds().width"
            [style.height.px]="stageBounds().height"
            [style.transform]="'scale(' + zoom() + ')'"
          >
            <!-- SVG Edges & Traveling Replay Token -->
            <svg
              class="absolute inset-0 w-full h-full pointer-events-none z-0"
              [attr.viewBox]="'0 0 ' + stageBounds().width + ' ' + stageBounds().height"
            >
              <defs>
                <linearGradient id="replayConduitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#22D3EE" />
                  <stop offset="100%" stop-color="#8B5CF6" />
                </linearGradient>
                <filter id="replayGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              @for (edge of store.diagram().edges; track edge.id) {
                <path
                  [attr.d]="edgePath(edge)"
                  fill="none"
                  [attr.stroke]="isEdgeTraversed(edge) ? 'url(#replayConduitGrad)' : '#343C4F'"
                  [attr.stroke-width]="isEdgeTraversed(edge) ? 3 : 2"
                  [attr.stroke-dasharray]="isEdgeTraversed(edge) ? null : '5 4'"
                  [attr.opacity]="isEdgeTraversed(edge) ? 1 : 0.4"
                  [attr.filter]="isEdgeTraversed(edge) ? 'url(#replayGlow)' : null"
                />
              }

              @for (token of replayTokens(); track token.id) {
                <g>
                  <circle
                    [attr.cx]="token.x"
                    [attr.cy]="token.y"
                    r="11"
                    [attr.fill]="token.status === 'error' ? 'rgba(244,63,94,0.3)' : 'rgba(34,211,238,0.32)'"
                    filter="url(#replayGlow)"
                  />
                  <circle
                    [attr.cx]="token.x"
                    [attr.cy]="token.y"
                    r="5.5"
                    [attr.fill]="token.status === 'error' ? '#F43F5E' : '#22D3EE'"
                    stroke="#0B0D12"
                    stroke-width="2"
                  />
                </g>
              }
            </svg>

            <!-- Nodes -->
            @for (node of store.diagram().nodes; track node.key) {
              @let vis = resolveVisual(node);
              @let isCurrent = currentHopNodeKey() === node.key;
              @let isVisited = visitedNodeKeys().has(node.key);
              @let isErrorNode = isCurrent && currentHopEvent()?.type === 'error';
              <div
                class="absolute rounded-[14px] p-3 flex items-center gap-3 bg-bg-2 transition-all duration-200 border"
                [style.left.px]="node.x"
                [style.top.px]="node.y"
                [style.width.px]="cardWidth()"
                [style.height.px]="cardHeight()"
                [class.border-status-error]="isErrorNode"
                [class.border-2]="isCurrent"
                [class.border-node-queue]="isCurrent && !isErrorNode"
                [class.border-border-strong]="!isCurrent && isVisited"
                [class.border-border-structural]="!isCurrent && !isVisited"
                [class.opacity-60]="!isCurrent && !isVisited"
                [class.shadow-[0_0_24px_rgba(34,211,238,0.28)]="isCurrent && !isErrorNode"
                [class.shadow-[0_0_24px_rgba(244,63,94,0.32)]="isErrorNode"
              >
                <div
                  class="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
                  [style.background]="vis.accentBg"
                >
                  <span class="material-symbols-outlined text-[21px]" [style.color]="vis.accentColor">
                    {{ vis.icon }}
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-body-node-label text-xs text-text-1 truncate">{{ node.label }}</span>
                    @if (isCurrent) {
                      <span
                        class="px-1.5 py-0.5 rounded text-[9px] font-code-sm font-bold"
                        [class.bg-status-error/20]="isErrorNode"
                        [class.text-status-error]="isErrorNode"
                        [class.bg-node-queue/20]="!isErrorNode"
                        [class.text-node-queue]="!isErrorNode"
                      >
                        {{ isErrorNode ? 'ERR' : 'ACTIVE' }}
                      </span>
                    }
                  </div>
                  <div class="font-code-sm text-[11px] text-text-3 truncate">{{ node.key }}</div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- FLOATING TIMELINE SCRUBBER TOOLBAR -->
        <div class="absolute bottom-5 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl z-30 pointer-events-auto">
          <div class="bg-bg-1/90 backdrop-blur-md border border-border-structural rounded-2xl p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-3">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  (click)="stepBack()"
                  [disabled]="hopEvents().length === 0"
                  class="w-8 h-8 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 flex items-center justify-center disabled:opacity-40"
                  title="Step Back 1 Hop"
                >
                  <span class="material-symbols-outlined text-[18px]">skip_previous</span>
                </button>
                <button
                  type="button"
                  (click)="togglePlayback()"
                  [disabled]="hopEvents().length === 0"
                  class="w-9 h-9 rounded-lg bg-gradient-to-br from-node-queue to-node-service text-bg-0 flex items-center justify-center font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] hover:brightness-110 disabled:opacity-40"
                  [title]="playing() ? 'Pause Replay' : 'Play Replay'"
                >
                  <span class="material-symbols-outlined text-[20px]">
                    {{ playing() ? 'pause' : 'play_arrow' }}
                  </span>
                </button>
                <button
                  type="button"
                  (click)="stepForward()"
                  [disabled]="hopEvents().length === 0"
                  class="w-8 h-8 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 flex items-center justify-center disabled:opacity-40"
                  title="Step Forward 1 Hop"
                >
                  <span class="material-symbols-outlined text-[18px]">skip_next</span>
                </button>

                <div class="h-4 w-px bg-border-structural mx-1"></div>

                <button
                  type="button"
                  (click)="cycleSpeed()"
                  class="flex items-center bg-bg-2 border border-border-structural rounded-lg px-2.5 py-1 gap-1 text-xs font-code-sm text-node-queue hover:border-border-strong"
                  title="Replay Speed"
                >
                  <span>{{ replaySpeed() }}×</span>
                </button>

                <button
                  type="button"
                  (click)="loopReplay.set(!loopReplay())"
                  class="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-code-sm transition-colors"
                  [class.bg-bg-3]="loopReplay()"
                  [class.border-node-queue/50]="loopReplay()"
                  [class.text-node-queue]="loopReplay()"
                  [class.bg-bg-2]="!loopReplay()"
                  [class.border-border-structural]="!loopReplay()"
                  [class.text-text-3]="!loopReplay()"
                >
                  <span class="material-symbols-outlined text-[14px]">repeat</span>
                  <span>Loop</span>
                </button>
              </div>

              <div class="flex items-center gap-2 font-code-sm text-xs">
                <span class="text-node-queue font-semibold">Hop {{ activeHopIndex() + 1 }}</span>
                <span class="text-text-3">/</span>
                <span class="text-text-3">{{ hopEvents().length || 0 }}</span>
              </div>
            </div>

            <!-- Hop Markers Bar -->
            <div class="relative w-full pt-1 pb-3 px-2">
              <div class="relative w-full h-2 bg-bg-3 rounded-full overflow-hidden">
                <div
                  class="h-full bg-gradient-to-r from-node-queue to-node-service rounded-full transition-all duration-200"
                  [style.width.%]="progressPercent()"
                ></div>
              </div>
              @if (hopEvents().length > 0) {
                <div class="relative flex justify-between mt-2">
                  @for (ev of hopEvents(); track ev.id; let idx = $index) {
                    <button
                      type="button"
                      (click)="jumpToHop(idx)"
                      class="flex flex-col items-center gap-1 group"
                      [title]="ev.node"
                    >
                      <span
                        class="w-3 h-3 rounded-full border-2 border-bg-1 transition-transform group-hover:scale-125"
                        [class.bg-status-error]="ev.type === 'error'"
                        [class.bg-node-queue]="ev.type !== 'error' && idx <= activeHopIndex()"
                        [class.bg-border-strong]="ev.type !== 'error' && idx > activeHopIndex()"
                      ></span>
                      <span
                        class="font-code-sm text-[10px] max-w-[72px] truncate"
                        [class.text-node-queue]="idx === activeHopIndex()"
                        [class.text-text-3]="idx !== activeHopIndex()"
                      >
                        {{ ev.node }}
                      </span>
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </section>

      <!-- RIGHT COLUMN: TRACE INSPECTOR DRAWER -->
      <aside class="w-[360px] shrink-0 bg-bg-1 border-l border-border-structural flex flex-col h-full overflow-hidden">
        <div class="p-3 border-b border-border-structural flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-node-queue text-[18px]">dock_to_left</span>
            <span class="font-headline-sm text-[15px] text-text-1">Trace Inspector</span>
          </div>
          <button
            type="button"
            (click)="copyJson()"
            class="h-7 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 font-code-sm text-[11px] flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[13px]">code</span>
            <span>{{ copiedJson() ? 'Copied' : 'JSON' }}</span>
          </button>
        </div>

        @if (activeDetail(); as detail) {
          <div class="flex-1 overflow-y-auto p-3 space-y-4">
            <!-- Verdict Card -->
            <div class="bg-bg-2 border border-border-structural rounded-xl p-3.5 space-y-3">
              <div class="flex items-center justify-between border-b border-border-structural pb-2.5">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-text-3">Overall Verdict</div>
                  <div
                    class="font-code-sm text-xs font-semibold flex items-center gap-1.5 mt-0.5"
                    [class.text-status-error]="detail.summary.status === 'error'"
                    [class.text-status-ok]="detail.summary.status !== 'error'"
                  >
                    <span
                      class="w-2 h-2 rounded-full"
                      [class.bg-status-error]="detail.summary.status === 'error'"
                      [class.bg-status-ok]="detail.summary.status !== 'error'"
                    ></span>
                    {{ detail.summary.status === 'error' ? 'ERROR / FAILED' : 'HEALTHY (OK)' }}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] uppercase tracking-wider text-text-3">Total Duration</div>
                  <div class="font-code-sm text-xs text-text-1 font-semibold mt-0.5">{{ totalDurationMs() }}ms</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 text-xs font-code-sm">
                <div>
                  <span class="text-text-3 block text-[10px] uppercase">Replay Progress</span>
                  <span class="text-node-queue font-medium">
                    Hop {{ activeHopIndex() + 1 }} of {{ hopEvents().length }}
                  </span>
                </div>
                <div>
                  <span class="text-text-3 block text-[10px] uppercase">Started</span>
                  <span class="text-text-2">{{ formatTime(detail.summary.startedAt) }}</span>
                </div>
              </div>
            </div>

            <!-- Hop Chronology -->
            <div class="space-y-2">
              <div class="flex items-center justify-between px-1">
                <span class="text-[11px] uppercase tracking-wider text-text-3 font-semibold">Hop Chronology</span>
                <span class="font-code-sm text-[11px] text-node-queue">{{ hopEvents().length }} events</span>
              </div>

              <div class="relative pl-5 space-y-2.5 before:absolute before:left-[9px] before:top-3 before:bottom-3 before:w-[2px] before:bg-border-structural">
                @for (ev of hopEvents(); track ev.id; let idx = $index) {
                  <button
                    type="button"
                    (click)="jumpToHop(idx)"
                    class="relative w-full text-left rounded-xl p-2.5 border transition-all"
                    [class.bg-bg-2]="true"
                    [class.border-node-queue]="idx === activeHopIndex() && ev.type !== 'error'"
                    [class.border-status-error]="ev.type === 'error' && idx === activeHopIndex()"
                    [class.border-border-structural]="idx !== activeHopIndex()"
                  >
                    <span
                      class="absolute -left-[20px] top-3.5 w-3 h-3 rounded-full border-2 border-bg-1"
                      [class.bg-status-error]="ev.type === 'error'"
                      [class.bg-node-queue]="ev.type !== 'error' && idx <= activeHopIndex()"
                      [class.bg-border-strong]="ev.type !== 'error' && idx > activeHopIndex()"
                    ></span>
                    <div class="flex items-center justify-between">
                      <span class="font-body-node-label text-xs text-text-1 font-semibold">
                        {{ idx + 1 }}. {{ ev.node }}
                      </span>
                      <span
                        class="font-code-sm text-[10px] px-1.5 py-0.5 rounded"
                        [class.bg-status-error/15]="ev.type === 'error'"
                        [class.text-status-error]="ev.type === 'error'"
                        [class.bg-bg-3]="ev.type !== 'error'"
                        [class.text-text-2]="ev.type !== 'error'"
                      >
                        {{ ev.type.toUpperCase() }}
                      </span>
                    </div>
                    <div class="font-code-sm text-[11px] text-text-3 mt-0.5">
                      {{ ev.fromNode ? ev.fromNode + ' → ' + ev.node : 'entry' }}
                    </div>
                  </button>
                }
              </div>
            </div>

            <!-- Active Hop Attributes -->
            @if (currentHopEvent(); as activeEv) {
              <div class="space-y-2 pt-2 border-t border-border-structural">
                <span class="text-[11px] uppercase tracking-wider text-text-3 font-semibold block px-1">
                  Hop Attributes
                </span>
                <div class="bg-bg-0 border border-border-structural rounded-xl p-3 font-code-sm text-[11px] space-y-1.5">
                  <div class="flex justify-between gap-2">
                    <span class="text-text-3">trace.id</span>
                    <span class="text-text-1 truncate select-all">{{ activeEv.traceId }}</span>
                  </div>
                  <div class="flex justify-between gap-2">
                    <span class="text-text-3">branch</span>
                    <span class="text-node-queue">{{ activeEv.branch }}</span>
                  </div>
                  @for (entry of attributeEntries(activeEv.attrs); track entry[0]) {
                    <div class="flex justify-between gap-2">
                      <span class="text-text-3">{{ entry[0] }}</span>
                      <span class="text-text-2 truncate">{{ entry[1] }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <div class="flex-1 flex items-center justify-center p-6 text-center text-xs text-text-3">
            Select a trace from the left panel to inspect its hops and replay it step-by-step.
          </div>
        }
      </aside>
    </div>
  `,
})
export class TracesReplayPageComponent implements OnInit, OnDestroy {
  public readonly store = inject(FlowSessionStore);
  protected readonly Math = Math;

  public readonly localSearch = signal('');
  public readonly statusFilter = signal<'all' | 'ok' | 'error'>('all');
  public readonly selectedTraceId = signal<string | null>(null);
  public readonly activeHopIndex = signal(0);
  public readonly playing = signal(true);
  public readonly replaySpeed = signal(1);
  public readonly loopReplay = signal(true);
  public readonly zoom = signal(1);
  public readonly copiedId = signal(false);
  public readonly copiedJson = signal(false);

  public readonly statusTabs: Array<{ id: 'all' | 'ok' | 'error'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'ok', label: 'OK' },
    { id: 'error', label: 'Errors' },
  ];

  private readonly replayEngine = new AnimationEngine();
  public readonly replayTokens = signal<ActiveToken[]>([]);
  private rafId: number | null = null;
  private stepTimer: ReturnType<typeof setInterval> | null = null;

  public readonly cardWidth = computed(() => this.store.templateProfile().cardWidth);
  public readonly cardHeight = computed(() => this.store.templateProfile().cardHeight);

  public readonly visibleTraces = computed(() => {
    const q = this.localSearch().trim().toLowerCase();
    const status = this.statusFilter();
    return this.store.recentTraces().filter((t) => {
      if (status === 'error' && t.status !== 'error') return false;
      if (status === 'ok' && t.status === 'error') return false;
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        (t.lastNode ?? '').toLowerCase().includes(q)
      );
    });
  });

  public readonly activeDetail = computed(() => this.store.selectedTraceDetail());

  public readonly hopEvents = computed<TraceEventRecord[]>(() => {
    return this.activeDetail()?.events ?? [];
  });

  public readonly currentHopEvent = computed<TraceEventRecord | null>(() => {
    const events = this.hopEvents();
    if (!events.length) return null;
    const idx = Math.max(0, Math.min(this.activeHopIndex(), events.length - 1));
    return events[idx];
  });

  public readonly currentHopNodeKey = computed(() => this.currentHopEvent()?.node ?? null);

  public readonly visitedNodeKeys = computed(() => {
    const events = this.hopEvents();
    const limit = this.activeHopIndex();
    const set = new Set<string>();
    for (let i = 0; i <= limit && i < events.length; i++) {
      set.add(events[i].node);
    }
    return set;
  });

  public readonly progressPercent = computed(() => {
    const len = this.hopEvents().length;
    if (len <= 1) return len === 1 ? 100 : 0;
    return Math.round((this.activeHopIndex() / (len - 1)) * 100);
  });

  public readonly totalDurationMs = computed(() => {
    const events = this.hopEvents();
    if (events.length < 2) return 12;
    const first = Date.parse(events[0].serverTs);
    const last = Date.parse(events[events.length - 1].serverTs);
    if (Number.isNaN(first) || Number.isNaN(last)) return events.length * 18;
    return Math.max(12, last - first);
  });

  public readonly stageBounds = computed(() => {
    const nodes = this.store.diagram().nodes;
    const cw = this.cardWidth();
    const ch = this.cardHeight();
    let maxX = 760;
    let maxY = 520;
    for (const n of nodes) {
      maxX = Math.max(maxX, n.x + cw + 64);
      maxY = Math.max(maxY, n.y + ch + 64);
    }
    return { width: maxX, height: maxY };
  });

  constructor() {
    effect(() => {
      const graph = this.store.diagram();
      this.replayEngine.cardWidth = this.cardWidth();
      this.replayEngine.cardHeight = this.cardHeight();
      this.replayEngine.setGraph(graph);
    });

    effect(() => {
      const detail = this.store.selectedTraceDetail();
      if (detail && !this.selectedTraceId()) {
        this.selectedTraceId.set(detail.summary.id);
      }
    });
  }

  public ngOnInit(): void {
    this.startReplayLoop();
    this.restartStepTimer();
  }

  public ngOnDestroy(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
    }
  }

  public async selectTrace(trace: TraceSummary): Promise<void> {
    this.selectedTraceId.set(trace.id);
    this.activeHopIndex.set(0);
    this.replayEngine.clearAll();
    await this.store.inspectTrace(trace.id);
    this.emitHopAnimation(0);
  }

  public resolveVisual(node: DiagramNode) {
    const profile = resolveTemplateProfile(this.store.activeTemplateId());
    const block = profile.nodeTypeVisuals[node.type] ?? profile.nodeTypeVisuals.service;
    return {
      icon: resolveNodeIcon(this.store.activeTemplateId(), node.key, node.type, node.icon),
      accentColor: block.accentHex,
      accentBg: `${block.accentHex}24`,
    };
  }

  public edgePath(edge: DiagramEdge): string {
    const nodes = this.store.diagram().nodes;
    const from = nodes.find((n) => n.key === edge.from);
    const to = nodes.find((n) => n.key === edge.to);
    if (!from || !to) return '';
    const cw = this.cardWidth();
    const ch = this.cardHeight();
    const x1 = from.x + cw / 2;
    const y1 = from.y + ch;
    const x2 = to.x + cw / 2;
    const y2 = to.y;
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  }

  public isEdgeTraversed(edge: DiagramEdge): boolean {
    const visited = this.visitedNodeKeys();
    return visited.has(edge.from) && visited.has(edge.to);
  }

  public togglePlayback(): void {
    this.playing.set(!this.playing());
    this.restartStepTimer();
  }

  public stepForward(): void {
    const len = this.hopEvents().length;
    if (!len) return;
    const next = this.activeHopIndex() + 1;
    if (next >= len) {
      if (this.loopReplay()) {
        this.jumpToHop(0);
      } else {
        this.playing.set(false);
      }
      return;
    }
    this.jumpToHop(next);
  }

  public stepBack(): void {
    const len = this.hopEvents().length;
    if (!len) return;
    const prev = Math.max(0, this.activeHopIndex() - 1);
    this.jumpToHop(prev);
  }

  public jumpToHop(idx: number): void {
    this.activeHopIndex.set(idx);
    this.emitHopAnimation(idx);
  }

  public cycleSpeed(): void {
    const speeds = [0.5, 1, 2];
    const next = speeds[(speeds.indexOf(this.replaySpeed()) + 1) % speeds.length];
    this.replaySpeed.set(next);
    this.replayEngine.speedMultiplier = next;
    this.restartStepTimer();
  }

  public attributeEntries(attrs: Record<string, unknown> | undefined): Array<[string, string]> {
    if (!attrs) return [];
    return Object.entries(attrs)
      .slice(0, 8)
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
  }

  public formatTime(iso: string | undefined): string {
    if (!iso) return '--:--:--';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(11, 19);
  }

  public async copyTraceId(): Promise<void> {
    const id = this.activeDetail()?.summary?.id;
    if (!id || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(id);
    this.copiedId.set(true);
    setTimeout(() => this.copiedId.set(false), 1500);
  }

  public async copyJson(): Promise<void> {
    const detail = this.activeDetail();
    if (!detail || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(JSON.stringify(detail, null, 2));
    this.copiedJson.set(true);
    setTimeout(() => this.copiedJson.set(false), 1500);
  }

  private emitHopAnimation(idx: number): void {
    const events = this.hopEvents();
    const ev = events[idx];
    if (!ev) return;
    const now = Date.now();
    if (idx === 0 || !ev.fromNode) {
      this.replayEngine.enqueueSpawn(
        {
          t: 'spawn',
          traceId: ev.traceId,
          branch: ev.branch,
          node: ev.node,
          ts: now,
          status: ev.type === 'error' ? 'error' : 'ok',
        },
        now
      );
    } else {
      this.replayEngine.enqueueHop(
        {
          t: 'hop',
          traceId: ev.traceId,
          branch: ev.branch,
          from: ev.fromNode,
          to: ev.node,
          ts: now,
          status: ev.type === 'error' ? 'error' : 'ok',
          unmapped: false,
        },
        now
      );
    }
  }

  private startReplayLoop(): void {
    if (typeof requestAnimationFrame === 'undefined') return;
    const loop = () => {
      this.replayEngine.step(Date.now());
      this.replayTokens.set(this.replayEngine.getTokens());
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private restartStepTimer(): void {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (!this.playing()) return;
    const intervalMs = Math.round(900 / this.replaySpeed());
    this.stepTimer = setInterval(() => {
      if (this.hopEvents().length > 0 && this.playing()) {
        this.stepForward();
      }
    }, intervalMs);
  }
}
