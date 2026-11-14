import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { OrganizationUsage, Project } from '../../core/models';

type ProjectSort = 'recent' | 'name' | 'retention';

@Component({
  selector: 'app-projects-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-[#0B0E14] text-[#F1F5F9] flex">
      <!-- Left Workspace Sidebar (Stitch Architecture) -->
      <aside class="hidden lg:flex w-60 shrink-0 flex-col justify-between bg-[#080B10] border-r border-white/[0.07] py-5 px-3 select-none">
        <div class="space-y-1">
          <div class="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            Workspace
          </div>
          <a
            routerLink="/projects"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium bg-[#131926] text-[#F1F5F9] border border-cyan-400/25 shadow-[0_0_20px_rgba(34,211,238,0.08)]"
          >
            <span class="material-symbols-outlined text-[18px] text-cyan-400">folder_open</span>
            <span>Projects</span>
          </a>
          <a
            routerLink="/templates"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">grid_view</span>
            <span>Templates</span>
          </a>
          <a
            routerLink="/alerts"
            class="flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[18px]">notifications</span>
              <span>Alerts</span>
            </span>
            <span class="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono text-[10px] font-semibold">
              2
            </span>
          </a>
          <a
            routerLink="/billing"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">credit_card</span>
            <span>Billing</span>
          </a>
          <a
            routerLink="/team"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">group</span>
            <span>Team</span>
          </a>
          <a
            routerLink="/docs"
            class="flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="flex items-center gap-3">
              <span class="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Docs</span>
            </span>
            <span class="material-symbols-outlined text-[14px] text-[#64748B]">open_in_new</span>
          </a>
        </div>

        <div class="space-y-3 pt-4 border-t border-white/[0.06]">
          <div class="px-3 py-2.5 rounded-lg bg-[#0E131D] border border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
            <span class="flex items-center gap-2 text-[#94A3B8] truncate">
              <span
                class="w-2 h-2 rounded-full shrink-0"
                [class.bg-emerald-400]="store.backendOnline()"
                [class.bg-amber-400]="!store.backendOnline()"
              ></span>
              <span class="truncate">{{ store.activeProject()?.name || 'flowtrace-local' }}</span>
            </span>
            <span class="text-emerald-400 shrink-0">{{ store.wsConnected() ? 'LIVE' : 'READY' }}</span>
          </div>
          <a
            routerLink="/settings"
            class="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.04] transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">settings</span>
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <!-- Main Workspace Area -->
      <main class="flex-1 min-w-0 px-6 lg:px-10 py-8">
        <div class="max-w-[1380px] mx-auto space-y-7">
          <!-- Header & Controls -->
          <div class="flex flex-col xl:flex-row xl:items-end justify-between gap-5">
            <div>
              <div class="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.16em] text-[#64748B]">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                <span>Overview / Workspace</span>
              </div>
              <div class="flex items-center gap-3 mt-1.5">
                <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F5F9]">Projects</h1>
                <span class="px-2.5 py-0.5 rounded-full bg-[#131926] border border-white/[0.08] font-mono text-[11px] text-[#94A3B8]">
                  {{ store.projects().length }} active
                </span>
              </div>
              <p class="text-sm text-[#94A3B8] mt-1.5 max-w-xl">
                Real-time telemetry networks and distributed architecture topologies.
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <div class="relative flex-1 sm:flex-none sm:w-60">
                <span class="material-symbols-outlined text-[17px] text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2">
                  search
                </span>
                <input
                  type="text"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="searchQuery.set($event)"
                  placeholder="Filter projects..."
                  class="w-full h-9 pl-9 pr-3 rounded-lg bg-[#111622] border border-white/[0.08] text-xs text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-cyan-400/60"
                />
              </div>

              <select
                [ngModel]="sortBy()"
                (ngModelChange)="sortBy.set($event)"
                class="h-9 px-3 rounded-lg bg-[#111622] border border-white/[0.08] text-xs text-[#CBD5E1] focus:outline-none focus:border-cyan-400/60"
              >
                <option value="recent">Last active</option>
                <option value="name">Name (A–Z)</option>
                <option value="retention">Retention days</option>
              </select>

              <button
                type="button"
                (click)="createModalOpen.set(true)"
                class="h-9 px-4 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_24px_rgba(34,211,238,0.28)] hover:brightness-110 transition"
              >
                <span class="material-symbols-outlined text-[17px]">add</span>
                <span>New project</span>
              </button>
            </div>
          </div>

          <!-- Content Grid: Projects (8 cols) + Right Rail (4 cols) -->
          <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <!-- Projects Grid -->
            <div class="xl:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              @for (project of filteredProjects(); track project.id; let idx = $index) {
                @let isActive = project.id === store.selectedProjectId();
                <article
                  class="group flex flex-col bg-[#111622] border rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(0,0,0,0.5)]"
                  [class.border-cyan-400/60]="isActive"
                  [class.border-white/[0.08]]="!isActive"
                >
                  <!-- Card Status Bar -->
                  <div class="flex items-center justify-between px-4 py-2.5 bg-[#0D111A] border-b border-white/[0.06]">
                    <div class="flex items-center gap-2">
                      <span class="relative flex h-2 w-2">
                        @if (isActive && store.wsConnected()) {
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                        } @else {
                          <span
                            class="relative inline-flex rounded-full h-2 w-2"
                            [class.bg-emerald-400]="isActive"
                            [class.bg-amber-400]="!isActive && !project.autoDiscover"
                            [class.bg-cyan-400]="!isActive && project.autoDiscover"
                          ></span>
                        }
                      </span>
                      <span
                        class="font-mono text-[11px] font-medium"
                        [class.text-emerald-400]="isActive"
                        [class.text-[#94A3B8]]="!isActive"
                      >
                        {{ isActive && store.wsConnected() ? 'Live' : isActive ? 'Active Workspace' : 'Ready' }}
                      </span>
                    </div>
                    <span class="font-mono text-[11px] text-[#64748B]">
                      {{ formatCreatedDate(project.createdAt) }}
                    </span>
                  </div>

                  <!-- Mini Animated SVG Topology Thumbnail -->
                  <div class="relative h-[142px] bg-[#0B0F17] border-b border-white/[0.06] overflow-hidden">
                    <div
                      class="absolute inset-0 opacity-35"
                      style="background-image: radial-gradient(rgba(148,163,184,0.22) 1px, transparent 1px); background-size: 16px 16px;"
                    ></div>
                    <svg class="w-full h-full relative z-10" viewBox="0 0 340 142" fill="none">
                      <path d="M 52 72 C 84 72, 92 38, 120 38" stroke="#262F42" stroke-width="1.8" />
                      <path d="M 164 38 C 188 38, 194 90, 214 90" stroke="#262F42" stroke-width="1.8" />
                      <path d="M 268 90 C 284 90, 288 54, 302 54" stroke="#262F42" stroke-width="1.8" />
                      <path
                        d="M 52 72 C 84 72, 92 38, 120 38"
                        stroke="#22D3EE"
                        stroke-dasharray="4 4"
                        stroke-width="1.5"
                        opacity="0.75"
                      />
                      <path
                        d="M 164 38 C 188 38, 194 90, 214 90"
                        stroke="#8B5CF6"
                        stroke-dasharray="4 4"
                        stroke-width="1.5"
                        opacity="0.75"
                      />
                      <circle r="3.2" fill="#22D3EE">
                        <animateMotion
                          [attr.dur]="2 + (idx % 3) * 0.4 + 's'"
                          repeatCount="indefinite"
                          path="M 52 72 C 84 72, 92 38, 120 38"
                        />
                      </circle>
                      <circle r="3.2" fill="#8B5CF6">
                        <animateMotion
                          begin="0.6s"
                          [attr.dur]="2.4 + (idx % 2) * 0.5 + 's'"
                          repeatCount="indefinite"
                          path="M 164 38 C 188 38, 194 90, 214 90"
                        />
                      </circle>
                      <g transform="translate(10,58)">
                        <rect width="46" height="28" rx="6" fill="#151C2B" stroke="#2B354B" />
                        <text x="23" y="17.5" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="Inter, sans-serif">
                          Ingress
                        </text>
                      </g>
                      <g transform="translate(116,24)">
                        <rect width="52" height="28" rx="6" fill="#151C2B" stroke="#22D3EE" stroke-opacity="0.65" />
                        <text x="26" y="17.5" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="Inter, sans-serif">
                          Gateway
                        </text>
                      </g>
                      <g transform="translate(206,76)">
                        <rect width="64" height="28" rx="6" fill="#151C2B" stroke="#8B5CF6" stroke-opacity="0.85" />
                        <text x="32" y="17.5" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="Inter, sans-serif">
                          Service
                        </text>
                      </g>
                      <g transform="translate(292,40)">
                        <rect width="40" height="28" rx="6" fill="#151C2B" stroke="#34D399" stroke-opacity="0.6" />
                        <text x="20" y="17.5" text-anchor="middle" fill="#34D399" font-size="8" font-family="Inter, sans-serif">
                          Store
                        </text>
                      </g>
                    </svg>
                  </div>

                  <!-- Card Body -->
                  <div class="p-4 flex flex-col gap-3.5 flex-1 justify-between">
                    <div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[15px] font-semibold text-[#F1F5F9] truncate">
                          {{ project.name }}
                        </span>
                        <span
                          class="px-2 py-0.5 rounded-full text-[10px] font-mono border shrink-0"
                          [class.bg-cyan-400/10]="project.autoDiscover"
                          [class.text-cyan-300]="project.autoDiscover"
                          [class.border-cyan-400/30]="project.autoDiscover"
                          [class.bg-violet-500/10]="!project.autoDiscover"
                          [class.text-violet-300]="!project.autoDiscover"
                          [class.border-violet-500/30]="!project.autoDiscover"
                        >
                          {{ project.autoDiscover ? 'Auto-Discover' : 'Strict Schema' }}
                        </span>
                      </div>
                      <p class="font-mono text-[11px] text-[#64748B] mt-1 truncate">
                        {{ isActive ? store.templateProfile().displayName : project.id }}
                      </p>
                    </div>

                    <!-- Metrics Sub-bar -->
                    <div class="grid grid-cols-3 gap-2 px-3 py-2 rounded-lg bg-[#0D111A] border border-white/[0.05]">
                      <div>
                        <div class="text-[9px] font-mono uppercase tracking-wider text-[#64748B]">Retention</div>
                        <div class="text-xs font-mono text-[#E2E8F0] mt-0.5">{{ project.retentionDays }}d</div>
                      </div>
                      <div>
                        <div class="text-[9px] font-mono uppercase tracking-wider text-[#64748B]">Topology</div>
                        <div class="text-xs font-mono text-[#E2E8F0] mt-0.5">
                          {{ isActive ? store.diagram().nodes.length + ' nodes' : 'Configured' }}
                        </div>
                      </div>
                      <div>
                        <div class="text-[9px] font-mono uppercase tracking-wider text-[#64748B]">Stream</div>
                        <div
                          class="text-xs font-mono mt-0.5"
                          [class.text-emerald-400]="isActive && store.wsConnected()"
                          [class.text-cyan-400]="!(isActive && store.wsConnected())"
                        >
                          {{ isActive && store.wsConnected() ? 'WS Open' : 'Standby' }}
                        </div>
                      </div>
                    </div>

                    <!-- Card Footer Actions -->
                    <div class="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        (click)="openProjectLive(project)"
                        class="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <span>Open Live View</span>
                        <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
                      </button>

                      <div class="flex items-center gap-1">
                        <a
                          [routerLink]="['/projects', project.id, 'editor']"
                          class="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-cyan-400 hover:bg-white/[0.05] transition-colors"
                          title="Open Diagram Editor"
                          aria-label="Open Diagram Editor"
                        >
                          <span class="material-symbols-outlined text-[16px]">draw</span>
                        </a>
                        <button
                          type="button"
                          (click)="openProjectOnboarding(project)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-cyan-400 hover:bg-white/[0.05] transition-colors"
                          title="Run onboarding setup"
                        >
                          <span class="material-symbols-outlined text-[16px]">rocket_launch</span>
                        </button>
                        <button
                          type="button"
                          (click)="openProjectSettings(project)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/[0.05] transition-colors"
                          title="Project settings"
                        >
                          <span class="material-symbols-outlined text-[16px]">settings</span>
                        </button>
                        @if (store.projects().length > 1) {
                          <button
                            type="button"
                            (click)="deleteProject(project)"
                            class="w-7 h-7 flex items-center justify-center rounded-lg text-[#64748B] hover:text-rose-400 hover:bg-white/[0.05] transition-colors"
                            title="Delete project"
                          >
                            <span class="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                </article>
              } @empty {
                <div class="md:col-span-2 bg-[#111622] border border-white/[0.08] rounded-xl p-10 text-center space-y-3">
                  <span class="material-symbols-outlined text-[32px] text-[#64748B]">search_off</span>
                  <div class="text-sm font-medium text-[#E2E8F0]">No projects match "{{ searchQuery() }}"</div>
                  <button
                    type="button"
                    (click)="searchQuery.set('')"
                    class="px-3.5 py-1.5 rounded-lg bg-[#192234] text-xs text-cyan-300 hover:bg-[#1F2A40]"
                  >
                    Clear filter
                  </button>
                </div>
              }
            </div>

            <!-- Right Rail: Ingestion Budget & Quickstart SDKs -->
            <aside class="xl:col-span-4 flex flex-col gap-5">
              <!-- Ingestion Budget Card -->
              <div class="bg-[#111622] border border-white/[0.08] rounded-xl p-5 space-y-4">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-semibold text-[#CBD5E1]">Ingestion Budget</span>
                  <span class="px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-[11px] font-mono text-cyan-300">
                    {{ usage()?.planTier || 'FREE' }} Plan
                  </span>
                </div>

                <div>
                  <span class="text-xs text-[#94A3B8]">Events this billing cycle</span>
                  <div class="flex items-baseline gap-2 mt-1">
                    <span class="font-mono text-3xl font-bold text-[#F1F5F9] tracking-tight">
                      {{ (usage()?.totalEventsThisMonth ?? 0).toLocaleString() }}
                    </span>
                    <span class="font-mono text-xs text-[#64748B]">
                      / {{ (usage()?.monthlyQuota ?? 100000).toLocaleString() }} inc.
                    </span>
                  </div>
                </div>

                <div class="space-y-1.5">
                  <div class="w-full h-2 rounded-full bg-[#1B2335] overflow-hidden">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all"
                      [style.width.%]="usagePercent()"
                    ></div>
                  </div>
                  <div class="flex justify-between text-[11px] font-mono">
                    <span class="text-[#94A3B8]">{{ usagePercent() }}% consumed</span>
                    <span [class.text-emerald-400]="!usage()?.isQuotaExceeded" [class.text-rose-400]="usage()?.isQuotaExceeded">
                      {{ usage()?.isQuotaExceeded ? 'Quota reached' : 'Optimal health' }}
                    </span>
                  </div>
                </div>

                <div class="pt-3 border-t border-white/[0.06] space-y-2.5 text-xs">
                  <div class="flex items-center justify-between text-[#94A3B8]">
                    <span class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[15px] text-cyan-400">speed</span>
                      <span>Active projects</span>
                    </span>
                    <span class="font-mono text-[#F1F5F9]">{{ store.projects().length }}</span>
                  </div>
                  <div class="flex items-center justify-between text-[#94A3B8]">
                    <span class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[15px] text-violet-400">history</span>
                      <span>Default retention</span>
                    </span>
                    <span class="font-mono text-[#F1F5F9]">{{ store.activeProject()?.retentionDays ?? 7 }} days</span>
                  </div>
                  <div class="flex items-center justify-between text-[#94A3B8]">
                    <span class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[15px] text-amber-400">hub</span>
                      <span>Active template</span>
                    </span>
                    <span class="font-mono text-cyan-300">{{ store.templateProfile().displayName }}</span>
                  </div>
                </div>

                <div class="p-3 rounded-lg bg-[#0D111A] border border-white/[0.06] space-y-1">
                  <div class="flex items-center justify-between text-xs">
                    <span class="font-semibold text-[#F1F5F9]">{{ usage()?.planTier || 'Starter' }} Tier</span>
                    <span class="font-mono text-[11px] text-emerald-400">Active</span>
                  </div>
                  <p class="text-[11px] text-[#64748B] leading-relaxed">
                    Ingest via HTTP, UDP, or TCP. Upgrade for extended trace retention and higher burst limits.
                  </p>
                </div>

                <a
                  routerLink="/billing"
                  class="w-full h-9 rounded-lg bg-[#161D2C] hover:bg-[#1D263A] border border-white/[0.08] text-xs font-medium text-[#E2E8F0] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Upgrade tier plan</span>
                  <span class="material-symbols-outlined text-[15px]">north_east</span>
                </a>
              </div>

              <!-- Quickstart SDKs Card -->
              <div class="bg-[#111622] border border-white/[0.08] rounded-xl p-5 space-y-3.5">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-[#F1F5F9]">Quickstart SDKs</span>
                  <a routerLink="/connectors" class="text-[11px] font-mono text-cyan-400 hover:underline">
                    All endpoints
                  </a>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <a
                    routerLink="/onboarding"
                    class="p-2.5 rounded-lg bg-[#0D111A] border border-white/[0.06] hover:border-cyan-400/40 text-center transition-colors"
                  >
                    <div class="text-xs font-semibold text-[#F1F5F9]">Node.js</div>
                    <div class="text-[10px] font-mono text-[#64748B] mt-0.5">HTTP / Fetch</div>
                  </a>
                  <a
                    routerLink="/onboarding"
                    class="p-2.5 rounded-lg bg-[#0D111A] border border-white/[0.06] hover:border-cyan-400/40 text-center transition-colors"
                  >
                    <div class="text-xs font-semibold text-[#F1F5F9]">Python</div>
                    <div class="text-[10px] font-mono text-[#64748B] mt-0.5">Requests</div>
                  </a>
                  <a
                    routerLink="/onboarding"
                    class="p-2.5 rounded-lg bg-[#0D111A] border border-white/[0.06] hover:border-cyan-400/40 text-center transition-colors"
                  >
                    <div class="text-xs font-semibold text-[#F1F5F9]">cURL</div>
                    <div class="text-[10px] font-mono text-[#64748B] mt-0.5">REST / UDP</div>
                  </a>
                </div>
                <div class="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                  <span class="flex items-center gap-1.5 text-[#94A3B8]">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Ingestion Pipeline</span>
                  </span>
                  <a routerLink="/docs" class="font-mono text-[#64748B] hover:text-cyan-300">
                    Read SDK docs →
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <!-- Create Project Modal (starts Onboarding Wizard) -->
      @if (createModalOpen()) {
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md rounded-2xl bg-[#111622] border border-white/[0.12] p-6 space-y-5 shadow-2xl">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-400">New Telemetry Workspace</div>
                <h2 class="text-base font-semibold text-[#F1F5F9] mt-0.5">Create New Project</h2>
              </div>
              <button
                type="button"
                (click)="createModalOpen.set(false)"
                class="w-8 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#F1F5F9] hover:bg-white/[0.05]"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div class="space-y-3.5">
              <div>
                <label class="block text-xs text-[#94A3B8] mb-1.5">Project Name</label>
                <input
                  type="text"
                  [ngModel]="newProjectName()"
                  (ngModelChange)="newProjectName.set($event)"
                  (keyup.enter)="submitCreateProject()"
                  placeholder="e.g. checkout-production"
                  class="w-full h-9 px-3 rounded-lg bg-[#0B0E14] border border-white/[0.1] text-sm text-[#F1F5F9] placeholder-[#64748B] focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div class="flex items-center justify-between py-1">
                <div>
                  <div class="text-xs font-medium text-[#E2E8F0]">Auto-discover new nodes &amp; edges</div>
                  <div class="text-[11px] text-[#64748B]">Dynamically expand topology from incoming spans</div>
                </div>
                <input
                  type="checkbox"
                  [ngModel]="newProjectAutoDiscover()"
                  (ngModelChange)="newProjectAutoDiscover.set($event)"
                  class="accent-cyan-400 w-4 h-4"
                />
              </div>

              <div>
                <label class="block text-xs text-[#94A3B8] mb-1.5">Trace Retention (days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  [ngModel]="newProjectRetention()"
                  (ngModelChange)="newProjectRetention.set(+$event || 7)"
                  class="w-full h-9 px-3 rounded-lg bg-[#0B0E14] border border-white/[0.1] text-sm text-[#F1F5F9] focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-white/[0.06]">
              <span class="text-[11px] font-mono text-[#64748B]">Continues to 3-step onboarding</span>
              <div class="flex gap-2">
                <button
                  type="button"
                  (click)="createModalOpen.set(false)"
                  class="px-3.5 py-1.5 rounded-lg bg-[#161D2C] border border-white/[0.08] text-xs text-[#94A3B8] hover:text-[#F1F5F9]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  [disabled]="!newProjectName().trim() || creating()"
                  (click)="submitCreateProject()"
                  class="px-4 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-xs font-semibold disabled:opacity-50"
                >
                  {{ creating() ? 'Creating…' : 'Create & Setup →' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectsHomePageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly api = inject(FlowTraceApiService);
  private readonly router = inject(Router);

  public readonly usage = signal<OrganizationUsage | null>(null);
  public readonly searchQuery = signal('');
  public readonly sortBy = signal<ProjectSort>('recent');
  public readonly createModalOpen = signal(false);
  public readonly creating = signal(false);
  public readonly newProjectName = signal('');
  public readonly newProjectAutoDiscover = signal(true);
  public readonly newProjectRetention = signal(7);

  public readonly filteredProjects = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.store.projects().filter((p) => {
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
    });
    const sort = this.sortBy();
    return [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'retention') return b.retentionDays - a.retentionDays;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  public readonly usagePercent = computed(() => {
    const pct = this.usage()?.percentUsed ?? 0;
    return Math.min(100, Math.round(pct * 10) / 10);
  });

  public async ngOnInit(): Promise<void> {
    await this.store.init();
    try {
      const orgs = await this.api.listOrganizations();
      if (orgs.length > 0) {
        const orgUsage = await this.api.getOrganizationUsage(orgs[0].organization.id);
        this.usage.set(orgUsage);
      }
    } catch {
      // Non-fatal if organization endpoint has no active data yet
    }
  }

  public formatCreatedDate(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  public async openProjectLive(project: Project): Promise<void> {
    await this.store.selectProject(project.id);
    await this.router.navigateByUrl('/');
  }

  public async openProjectSettings(project: Project): Promise<void> {
    await this.store.selectProject(project.id);
    await this.router.navigateByUrl('/settings');
  }

  public async openProjectOnboarding(project: Project): Promise<void> {
    await this.store.selectProject(project.id);
    await this.router.navigateByUrl('/onboarding');
  }

  public async deleteProject(project: Project): Promise<void> {
    await this.store.deleteProject(project.id);
  }

  public async submitCreateProject(): Promise<void> {
    const name = this.newProjectName().trim();
    if (!name || this.creating()) return;
    this.creating.set(true);
    try {
      const created = await this.store.createProject(
        name,
        this.newProjectAutoDiscover(),
        this.newProjectRetention()
      );
      if (created) {
        this.newProjectName.set('');
        this.createModalOpen.set(false);
        await this.router.navigateByUrl('/onboarding');
      }
    } finally {
      this.creating.set(false);
    }
  }
}
