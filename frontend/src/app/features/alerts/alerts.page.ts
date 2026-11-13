import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { AlertRule } from '../../core/models';

@Component({
  selector: 'app-alerts-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Alerts &amp; Webhooks</h1>
            <p class="text-sm text-text-3 mt-1">
              Monitor error spikes, latency regressions, and silent pipelines across your live topology.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1.5 rounded-xl bg-bg-2 border border-border-structural text-xs font-code-sm text-text-2">
              {{ rules().length }} rules configured
            </span>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <!-- LEFT 8 COLS: Rules Stream -->
          <div class="xl:col-span-8 space-y-4">
            <!-- Active Incident Strip -->
            @if (firingCount() > 0) {
              <div class="bg-bg-2/90 border border-status-warn/40 p-4 rounded-xl flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-status-warn/15 border border-status-warn/30 flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-status-warn text-[20px]">warning</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-semibold text-text-1">{{ firingCount() }} alert rule(s) triggered recently</span>
                    <span class="px-2 py-0.5 rounded bg-status-error/15 text-status-error text-[10px] font-semibold uppercase">
                      Active
                    </span>
                  </div>
                  <p class="text-xs text-text-2 mt-0.5">
                    Inspect live traffic or test webhook delivery directly below.
                  </p>
                </div>
                <a
                  routerLink="/"
                  class="px-3 py-1.5 rounded-lg bg-status-warn/15 border border-status-warn/30 text-status-warn text-xs font-medium shrink-0"
                >
                  View Live Flow
                </a>
              </div>
            }

            <!-- Search & Filters -->
            <div class="bg-bg-1 p-3 rounded-xl border border-border-structural flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2 bg-bg-2 px-3 py-1.5 rounded-lg border border-border-structural flex-1 min-w-[220px]">
                <span class="material-symbols-outlined text-[17px] text-text-3">search</span>
                <input
                  type="text"
                  [ngModel]="search()"
                  (ngModelChange)="search.set($event)"
                  placeholder="Filter rules by name, metric, or node…"
                  class="bg-transparent border-none outline-none text-xs text-text-1 placeholder:text-text-3 w-full"
                />
              </div>

              <div class="flex items-center bg-bg-2 border border-border-structural rounded-lg p-0.5">
                @for (tab of filterTabs; track tab.id) {
                  <button
                    type="button"
                    (click)="statusFilter.set(tab.id)"
                    class="px-2.5 py-1 text-[11px] rounded font-medium transition-colors"
                    [class.bg-bg-3]="statusFilter() === tab.id"
                    [class.text-text-1]="statusFilter() === tab.id"
                    [class.text-text-3]="statusFilter() !== tab.id"
                  >
                    {{ tab.label }}
                  </button>
                }
              </div>
            </div>

            <!-- Rules Cards -->
            @if (filteredRules().length === 0) {
              <div class="bg-bg-1 border border-border-structural rounded-xl p-10 text-center space-y-2">
                <span class="material-symbols-outlined text-text-3 text-[30px]">notifications_off</span>
                <p class="text-sm text-text-2">No alert rules yet for this project.</p>
                <p class="text-xs text-text-3">Use the Rule Builder on the right to create your first alert &amp; webhook target.</p>
              </div>
            }

            <div class="space-y-3">
              @for (rule of filteredRules(); track rule.id) {
                <div
                  class="bg-bg-2 rounded-xl p-4 border transition-all relative overflow-hidden space-y-3"
                  [class.border-status-error/50]="rule.severity === 'CRITICAL' && rule.enabled"
                  [class.border-border-structural]="rule.severity !== 'CRITICAL' || !rule.enabled"
                >
                  <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-3 min-w-0">
                      <button
                        type="button"
                        (click)="toggleEnabled(rule)"
                        class="mt-0.5 w-9 h-5 rounded-full border p-0.5 flex items-center transition-colors shrink-0"
                        [class.bg-node-queue/20]="rule.enabled"
                        [class.border-node-queue]="rule.enabled"
                        [class.justify-end]="rule.enabled"
                        [class.bg-bg-3]="!rule.enabled"
                        [class.border-border-strong]="!rule.enabled"
                        [class.justify-start]="!rule.enabled"
                        title="Toggle rule enabled"
                      >
                        <span
                          class="w-3.5 h-3.5 rounded-full"
                          [class.bg-node-queue]="rule.enabled"
                          [class.bg-text-3]="!rule.enabled"
                        ></span>
                      </button>

                      <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <h3 class="text-sm font-semibold text-text-1 truncate">{{ rule.name }}</h3>
                          <span
                            class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border"
                            [class.bg-status-error/15]="rule.severity === 'CRITICAL'"
                            [class.text-status-error]="rule.severity === 'CRITICAL'"
                            [class.border-status-error/30]="rule.severity === 'CRITICAL'"
                            [class.bg-status-warn/15]="rule.severity === 'WARNING'"
                            [class.text-status-warn]="rule.severity === 'WARNING'"
                            [class.border-status-warn/30]="rule.severity === 'WARNING'"
                            [class.bg-node-queue/15]="rule.severity === 'INFO'"
                            [class.text-node-queue]="rule.severity === 'INFO'"
                            [class.border-node-queue/30]="rule.severity === 'INFO'"
                          >
                            {{ rule.severity }}
                          </span>
                          @if (isMuted(rule)) {
                            <span class="px-2 py-0.5 rounded-full bg-bg-3 text-text-3 text-[10px] font-code-sm">
                              MUTED
                            </span>
                          }
                        </div>

                        <div class="flex items-center gap-2 text-[11px] font-code-sm text-text-3">
                          <span>Target: <strong class="text-text-1">{{ rule.targetNode || 'All Nodes' }}</strong></span>
                          <span>·</span>
                          <span>Window: {{ rule.windowSeconds }}s</span>
                          <span>·</span>
                          <span>Fired: {{ rule.fireCount }}×</span>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        (click)="testRule(rule)"
                        class="h-8 px-2.5 rounded-lg bg-bg-3 border border-border-structural text-node-queue hover:border-node-queue/50 text-xs font-medium"
                      >
                        Test Fire
                      </button>
                      <button
                        type="button"
                        (click)="muteRule(rule)"
                        class="h-8 px-2.5 rounded-lg bg-bg-3 border border-border-structural text-text-2 hover:text-text-1 text-xs"
                      >
                        {{ isMuted(rule) ? 'Unmute' : 'Mute 1h' }}
                      </button>
                      <button
                        type="button"
                        (click)="deleteRule(rule)"
                        class="w-8 h-8 rounded-lg bg-bg-3 border border-border-structural text-text-3 hover:text-status-error flex items-center justify-center"
                        title="Delete rule"
                      >
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div class="bg-bg-0 p-2.5 rounded-lg border border-border-structural flex items-center justify-between font-code-sm text-xs">
                    <span class="text-text-2">
                      expr: <span class="text-node-queue">{{ rule.metric }}</span> &gt; <span class="text-status-warn font-semibold">{{ rule.threshold }}</span>
                    </span>
                    <span class="text-text-3">
                      {{ rule.channelType }}: <span class="text-text-1">{{ rule.channelTarget }}</span>
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- RIGHT 4 COLS: Rule Builder -->
          <aside class="xl:col-span-4 bg-bg-1 border border-border-structural rounded-2xl p-5 space-y-4">
            <div class="flex items-center gap-2 border-b border-border-structural pb-3">
              <span class="material-symbols-outlined text-node-queue text-[20px]">add_alert</span>
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Create Alert Rule</h2>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <label class="block text-text-2 mb-1">Rule Name</label>
                <input
                  type="text"
                  [ngModel]="formName()"
                  (ngModelChange)="formName.set($event)"
                  placeholder="e.g. Checkout Error Spike > 5%"
                  class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1 focus:outline-none focus:border-node-queue"
                />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-text-2 mb-1">Severity</label>
                  <select
                    [ngModel]="formSeverity()"
                    (ngModelChange)="formSeverity.set($event)"
                    class="w-full h-9 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="WARNING">WARNING</option>
                    <option value="INFO">INFO</option>
                  </select>
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Metric</label>
                  <select
                    [ngModel]="formMetric()"
                    (ngModelChange)="formMetric.set($event)"
                    class="w-full h-9 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  >
                    <option value="error_rate">Error Rate (%)</option>
                    <option value="latency_p95">Latency P95 (ms)</option>
                    <option value="rps_drop">Silent Pipeline (min)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-text-2 mb-1">Threshold</label>
                  <input
                    type="number"
                    [ngModel]="formThreshold()"
                    (ngModelChange)="formThreshold.set(+$event || 5)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  />
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Target Node</label>
                  <select
                    [ngModel]="formTargetNode()"
                    (ngModelChange)="formTargetNode.set($event)"
                    class="w-full h-9 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  >
                    <option value="">All Nodes</option>
                    @for (n of store.diagram().nodes; track n.key) {
                      <option [value]="n.key">{{ n.label }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div>
                  <label class="block text-text-2 mb-1">Channel</label>
                  <select
                    [ngModel]="formChannelType()"
                    (ngModelChange)="formChannelType.set($event)"
                    class="w-full h-9 px-2 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  >
                    <option value="WEBHOOK">Webhook</option>
                    <option value="SLACK">Slack</option>
                    <option value="PAGERDUTY">PagerDuty</option>
                  </select>
                </div>
                <div class="col-span-2">
                  <label class="block text-text-2 mb-1">Destination / URL</label>
                  <input
                    type="text"
                    [ngModel]="formChannelTarget()"
                    (ngModelChange)="formChannelTarget.set($event)"
                    placeholder="https://hooks.slack.com/..."
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  />
                </div>
              </div>

              <button
                type="button"
                [disabled]="!formName().trim() || saving()"
                (click)="submitCreate()"
                class="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold hover:opacity-95 disabled:opacity-50"
              >
                {{ saving() ? 'Saving Rule…' : 'Create Alert Rule' }}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `,
})
export class AlertsPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly api = inject(FlowTraceApiService);

  public readonly rules = signal<AlertRule[]>([]);
  public readonly search = signal('');
  public readonly statusFilter = signal<'all' | 'active' | 'muted'>('all');
  public readonly saving = signal(false);

  public readonly formName = signal('');
  public readonly formSeverity = signal('CRITICAL');
  public readonly formMetric = signal('error_rate');
  public readonly formThreshold = signal(5);
  public readonly formTargetNode = signal('');
  public readonly formChannelType = signal('WEBHOOK');
  public readonly formChannelTarget = signal('https://hooks.example.com/flowtrace');

  public readonly filterTabs: Array<{ id: 'all' | 'active' | 'muted'; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'muted', label: 'Muted' },
  ];

  public readonly firingCount = computed(() =>
    this.rules().filter((r) => r.enabled && r.fireCount > 0).length
  );

  public readonly filteredRules = computed(() => {
    const q = this.search().trim().toLowerCase();
    const filter = this.statusFilter();
    return this.rules().filter((r) => {
      if (filter === 'active' && !r.enabled) return false;
      if (filter === 'muted' && !this.isMuted(r)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.metric.toLowerCase().includes(q) ||
        (r.targetNode ?? '').toLowerCase().includes(q)
      );
    });
  });

  constructor() {
    effect(() => {
      const pid = this.store.selectedProjectId();
      if (pid) {
        void this.loadRules(pid);
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (pid) {
      await this.loadRules(pid);
    }
  }

  public isMuted(rule: AlertRule): boolean {
    if (!rule.mutedUntil) return false;
    return Date.parse(rule.mutedUntil) > Date.now();
  }

  public async submitCreate(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid || !this.formName().trim()) return;
    this.saving.set(true);
    try {
      const created = await this.api.createAlert(pid, {
        name: this.formName().trim(),
        severity: this.formSeverity(),
        metric: this.formMetric(),
        threshold: this.formThreshold(),
        windowSeconds: 300,
        targetNode: this.formTargetNode() || undefined,
        channelType: this.formChannelType(),
        channelTarget: this.formChannelTarget(),
      });
      this.rules.update((list) => [created, ...list]);
      this.formName.set('');
    } finally {
      this.saving.set(false);
    }
  }

  public async toggleEnabled(rule: AlertRule): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    const updated = await this.api.updateAlert(pid, rule.id, { enabled: !rule.enabled });
    this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r)));
  }

  public async muteRule(rule: AlertRule): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    const muteMinutes = this.isMuted(rule) ? 0 : 60;
    const updated = await this.api.updateAlert(pid, rule.id, { muteMinutes });
    this.rules.update((list) => list.map((r) => (r.id === rule.id ? updated : r)));
  }

  public async testRule(rule: AlertRule): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    const res = await this.api.testAlert(pid, rule.id);
    if (res?.rule) {
      this.rules.update((list) => list.map((r) => (r.id === rule.id ? res.rule : r)));
    }
  }

  public async deleteRule(rule: AlertRule): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    await this.api.deleteAlert(pid, rule.id);
    this.rules.update((list) => list.filter((r) => r.id !== rule.id));
  }

  private async loadRules(projectId: string): Promise<void> {
    try {
      const list = await this.api.listAlerts(projectId);
      this.rules.set(list);
    } catch {
      // Ignore transient errors
    }
  }
}
