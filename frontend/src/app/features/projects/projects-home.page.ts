import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { OrganizationUsage, Project } from '../../core/models';

@Component({
  selector: 'app-projects-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <!-- Header Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Projects</h1>
            <p class="text-sm text-text-3 mt-1">
              Manage your live telemetry pipelines, architectures, and ingestion retention.
            </p>
          </div>
          <div class="flex items-center gap-2.5">
            <a
              routerLink="/templates"
              class="px-3.5 py-2 rounded-xl bg-bg-2 border border-border-structural text-text-2 hover:text-text-1 hover:border-border-strong text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <span class="material-symbols-outlined text-[16px] text-node-queue">grid_view</span>
              <span>Browse Templates</span>
            </a>
            <button
              type="button"
              (click)="createModalOpen.set(true)"
              class="px-4 py-2 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:opacity-95 transition-opacity"
            >
              <span class="material-symbols-outlined text-[17px]">add</span>
              <span>New Project</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- Projects Grid -->
          <div class="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-5">
            @for (project of store.projects(); track project.id; let idx = $index) {
              @let isActive = project.id === store.selectedProjectId();
              <article
                class="group flex flex-col bg-bg-2 border rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                [class.border-node-queue/70]="isActive"
                [class.border-border-structural]="!isActive"
              >
                <div class="flex items-center justify-between px-4 py-2.5 bg-bg-1/70 border-b border-border-structural">
                  <div class="flex items-center gap-2">
                    <span class="relative flex h-2 w-2">
                      @if (isActive && store.wsConnected()) {
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-ok opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-status-ok"></span>
                      } @else {
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-text-3"></span>
                      }
                    </span>
                    <span class="font-chip-metric text-[11px]" [class.text-status-ok]="isActive" [class.text-text-3]="!isActive">
                      {{ isActive ? 'Active Workspace' : 'Ready' }}
                    </span>
                  </div>
                  <span class="font-code-sm text-[11px] text-text-3">{{ project.retentionDays }}d retention</span>
                </div>

                <!-- Mini Animated SVG Topology Thumbnail -->
                <div class="relative h-[136px] bg-bg-1 border-b border-border-structural overflow-hidden">
                  <div
                    class="absolute inset-0 opacity-40"
                    style="background-image: radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px); background-size: 16px 16px;"
                  ></div>
                  <svg class="w-full h-full relative z-10" viewBox="0 0 340 136" fill="none">
                    <path d="M 50 68 C 82 68, 92 36, 118 36" stroke="#262C3A" stroke-width="2" />
                    <path d="M 158 36 C 182 36, 188 86, 210 86" stroke="#262C3A" stroke-width="2" />
                    <path d="M 260 86 C 276 86, 282 52, 298 52" stroke="#262C3A" stroke-width="2" />
                    <path d="M 50 68 C 82 68, 92 36, 118 36" stroke="#22D3EE" stroke-dasharray="4 4" stroke-width="1.5" opacity="0.7" />
                    <path d="M 158 36 C 182 36, 188 86, 210 86" stroke="#8B5CF6" stroke-dasharray="4 4" stroke-width="1.5" opacity="0.7" />
                    <circle r="3.5" fill="#22D3EE">
                      <animateMotion dur="2.2s" repeatCount="indefinite" path="M 50 68 C 82 68, 92 36, 118 36" />
                    </circle>
                    <circle r="3.5" fill="#8B5CF6">
                      <animateMotion begin="0.7s" dur="2.6s" repeatCount="indefinite" path="M 158 36 C 182 36, 188 86, 210 86" />
                    </circle>
                    <g transform="translate(10,54)">
                      <rect width="46" height="28" rx="6" fill="#171B24" stroke="#262C3A" />
                      <text x="23" y="18" text-anchor="middle" fill="#E8ECF4" font-size="8" font-family="Inter">Ingress</text>
                    </g>
                    <g transform="translate(114,22)">
                      <rect width="46" height="28" rx="6" fill="#171B24" stroke="#262C3A" />
                      <text x="23" y="18" text-anchor="middle" fill="#E8ECF4" font-size="8" font-family="Inter">Gateway</text>
                    </g>
                    <g transform="translate(200,72)">
                      <rect width="62" height="28" rx="6" fill="#171B24" stroke="#8B5CF6" />
                      <text x="31" y="18" text-anchor="middle" fill="#E8ECF4" font-size="8" font-family="Inter">Service</text>
                    </g>
                    <g transform="translate(290,38)">
                      <rect width="42" height="28" rx="6" fill="#171B24" stroke="#262C3A" />
                      <text x="21" y="18" text-anchor="middle" fill="#34D399" font-size="8" font-family="Inter">Store</text>
                    </g>
                  </svg>
                </div>

                <!-- Card Body -->
                <div class="p-4 flex flex-col gap-3 flex-1 justify-between">
                  <div>
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-body-node-label text-sm font-semibold text-text-1 truncate">
                        {{ project.name }}
                      </span>
                      <span class="px-2 py-0.5 rounded-full bg-node-queue/15 text-node-queue border border-node-queue/30 text-[10px] font-code-sm">
                        {{ project.autoDiscover ? 'Auto-Discover' : 'Strict' }}
                      </span>
                    </div>
                    <p class="font-code-sm text-[11px] text-text-3 mt-1 truncate">{{ project.id }}</p>
                  </div>

                  <div class="flex items-center justify-between pt-2 border-t border-border-structural/60">
                    <button
                      type="button"
                      (click)="openProjectLive(project)"
                      class="inline-flex items-center gap-1 text-xs font-medium text-node-queue hover:text-text-1 transition-colors"
                    >
                      <span>Open Live View</span>
                      <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </button>

                    <div class="flex items-center gap-1">
                      @if (store.projects().length > 1) {
                        <button
                          type="button"
                          (click)="deleteProject(project)"
                          class="w-7 h-7 flex items-center justify-center rounded-lg text-text-3 hover:text-status-error hover:bg-bg-3 transition-colors"
                          title="Delete project"
                        >
                          <span class="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>

          <!-- Right Rail: Usage & Account Insights -->
          <aside class="lg:col-span-4 flex flex-col gap-5">
            <div class="bg-bg-2 border border-border-structural rounded-xl p-5 space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-[11px] uppercase tracking-wider text-text-3 font-semibold">Ingestion Budget</span>
                <span class="px-2 py-0.5 rounded-full bg-bg-3 border border-border-structural text-[11px] font-code-sm text-node-queue">
                  {{ usage()?.planTier || 'FREE' }} Plan
                </span>
              </div>

              <div>
                <span class="text-xs text-text-2">Events this billing cycle</span>
                <div class="flex items-baseline gap-2 mt-1">
                  <span class="font-code-block text-2xl font-semibold text-text-1">
                    {{ (usage()?.totalEventsThisMonth ?? 0).toLocaleString() }}
                  </span>
                  <span class="font-code-sm text-xs text-text-3">
                    / {{ (usage()?.monthlyQuota ?? 100000).toLocaleString() }}
                  </span>
                </div>
              </div>

              <div class="space-y-1.5">
                <div class="w-full h-2 rounded-full bg-bg-3 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-gradient-to-r from-node-queue to-node-service transition-all"
                    [style.width.%]="usagePercent()"
                  ></div>
                </div>
                <div class="flex justify-between text-[11px] font-code-sm text-text-3">
                  <span>{{ usagePercent() }}% consumed</span>
                  <span [class.text-status-ok]="!usage()?.isQuotaExceeded" [class.text-status-error]="usage()?.isQuotaExceeded">
                    {{ usage()?.isQuotaExceeded ? 'Quota reached' : 'Optimal health' }}
                  </span>
                </div>
              </div>

              <div class="pt-3 border-t border-border-structural/60 space-y-2 text-xs">
                <div class="flex items-center justify-between text-text-2">
                  <span>Active projects</span>
                  <span class="font-code-sm text-text-1">{{ store.projects().length }}</span>
                </div>
                <div class="flex items-center justify-between text-text-2">
                  <span>Active template</span>
                  <span class="font-code-sm text-node-queue">{{ store.templateProfile().displayName }}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Create Project Modal -->
      @if (createModalOpen()) {
        <div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="w-full max-w-md rounded-2xl bg-bg-1 border border-border-strong p-6 space-y-4 shadow-2xl">
            <div class="flex items-center justify-between">
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Create New Project</h2>
              <button
                type="button"
                (click)="createModalOpen.set(false)"
                class="text-text-3 hover:text-text-1"
              >
                <span class="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-xs text-text-2 mb-1">Project Name</label>
                <input
                  type="text"
                  [ngModel]="newProjectName()"
                  (ngModelChange)="newProjectName.set($event)"
                  placeholder="e.g. checkout-production"
                  class="w-full h-9 px-3 rounded-lg bg-bg-3 border border-border-structural text-sm text-text-1 focus:outline-none focus:border-node-queue"
                />
              </div>

              <div class="flex items-center justify-between">
                <label class="text-xs text-text-2">Auto-discover new nodes &amp; edges</label>
                <input
                  type="checkbox"
                  [ngModel]="newProjectAutoDiscover()"
                  (ngModelChange)="newProjectAutoDiscover.set($event)"
                  class="accent-node-queue"
                />
              </div>

              <div>
                <label class="block text-xs text-text-2 mb-1">Trace Retention (days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  [ngModel]="newProjectRetention()"
                  (ngModelChange)="newProjectRetention.set(+$event || 7)"
                  class="w-full h-9 px-3 rounded-lg bg-bg-3 border border-border-structural text-sm text-text-1 focus:outline-none focus:border-node-queue"
                />
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                (click)="createModalOpen.set(false)"
                class="px-3.5 py-1.5 rounded-lg bg-bg-2 border border-border-structural text-xs text-text-2"
              >
                Cancel
              </button>
              <button
                type="button"
                [disabled]="!newProjectName().trim() || creating()"
                (click)="submitCreateProject()"
                class="px-4 py-1.5 rounded-lg bg-node-queue text-bg-0 text-xs font-semibold disabled:opacity-50"
              >
                {{ creating() ? 'Creating…' : 'Create Project' }}
              </button>
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
  public readonly createModalOpen = signal(false);
  public readonly creating = signal(false);
  public readonly newProjectName = signal('');
  public readonly newProjectAutoDiscover = signal(true);
  public readonly newProjectRetention = signal(7);

  public readonly usagePercent = computed(() => {
    const pct = this.usage()?.percentUsed ?? 0;
    return Math.min(100, Math.round(pct * 10) / 10);
  });

  public async ngOnInit(): Promise<void> {
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

  public async openProjectLive(project: Project): Promise<void> {
    await this.store.selectProject(project.id);
    await this.router.navigateByUrl('/');
  }

  public async deleteProject(project: Project): Promise<void> {
    await this.store.deleteProject(project.id);
  }

  public async submitCreateProject(): Promise<void> {
    const name = this.newProjectName().trim();
    if (!name) return;
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
        await this.router.navigateByUrl('/');
      }
    } finally {
      this.creating.set(false);
    }
  }
}
