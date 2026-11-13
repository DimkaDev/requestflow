import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { ApiKey } from '../../core/models';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Project Settings &amp; API Keys</h1>
          <p class="text-sm text-text-3 mt-1">
            Configure ingestion discovery, retention, and manage project-scoped API keys.
          </p>
        </div>

        <!-- General Project Settings -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-border-structural pb-3">
            <h2 class="font-headline-sm text-base font-semibold text-text-1">General Configuration</h2>
            @if (savedNotice()) {
              <span class="text-xs text-status-ok font-code-sm">Saved!</span>
            }
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block text-text-2 mb-1">Project Name</label>
              <input
                type="text"
                [ngModel]="projectName()"
                (ngModelChange)="projectName.set($event)"
                class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1"
              />
            </div>
            <div>
              <label class="block text-text-2 mb-1">Retention (days)</label>
              <input
                type="number"
                min="1"
                max="90"
                [ngModel]="retentionDays()"
                (ngModelChange)="retentionDays.set(+$event || 7)"
                class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1"
              />
            </div>
            <div class="flex items-end">
              <label class="flex items-center gap-2 h-9 px-3 rounded-lg bg-bg-2 border border-border-structural w-full cursor-pointer">
                <input
                  type="checkbox"
                  [ngModel]="autoDiscover()"
                  (ngModelChange)="autoDiscover.set($event)"
                  class="accent-node-queue"
                />
                <span class="text-text-1">Auto-discover new hops</span>
              </label>
            </div>
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              [disabled]="savingProject()"
              (click)="saveProject()"
              class="px-4 py-2 rounded-xl bg-node-queue text-bg-0 text-xs font-semibold disabled:opacity-50"
            >
              {{ savingProject() ? 'Saving…' : 'Save Settings' }}
            </button>
          </div>
        </section>

        <!-- API Keys Management -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-structural pb-3">
            <div>
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Ingestion API Keys</h2>
              <p class="text-xs text-text-3">Use <code class="text-node-queue">X-API-Key</code> header for HTTP, UDP, or TCP ingest.</p>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                [ngModel]="newKeyName()"
                (ngModelChange)="newKeyName.set($event)"
                placeholder="Key name (e.g. prod-cluster)"
                class="h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-xs text-text-1"
              />
              <button
                type="button"
                [disabled]="!newKeyName().trim() || creatingKey()"
                (click)="createKey()"
                class="h-9 px-3.5 rounded-lg bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold shrink-0 disabled:opacity-50"
              >
                + Generate Key
              </button>
            </div>
          </div>

          @if (revealedKey()) {
            <div class="p-4 rounded-xl bg-status-ok/10 border border-status-ok/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-0.5 min-w-0">
                <div class="text-xs font-semibold text-status-ok">New API key generated — copy it now (shown once):</div>
                <code class="block font-code-sm text-xs text-text-1 break-all select-all">{{ revealedKey() }}</code>
              </div>
              <button
                type="button"
                (click)="copyKey()"
                class="px-3 py-1.5 rounded-lg bg-status-ok text-bg-0 text-xs font-semibold shrink-0"
              >
                {{ copied() ? 'Copied' : 'Copy Key' }}
              </button>
            </div>
          }

          <div class="space-y-2.5">
            @for (k of keys(); track k.id) {
              <div class="p-4 rounded-xl bg-bg-2 border border-border-structural flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-text-1">{{ k.name }}</span>
                    <span class="px-2 py-0.5 rounded bg-bg-3 font-code-sm text-[11px] text-node-queue">
                      {{ k.keyPrefix }}••••
                    </span>
                    @if (k.revokedAt) {
                      <span class="px-2 py-0.5 rounded bg-status-error/15 text-status-error text-[10px] font-semibold">
                        REVOKED
                      </span>
                    }
                  </div>
                  <div class="text-[11px] font-code-sm text-text-3">
                    Rate limit: {{ k.rateLimitPerS }} ev/s · Scopes: {{ k.scopes || 'ingest' }}
                  </div>
                </div>

                @if (!k.revokedAt) {
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="rotateKey(k.id)"
                      class="px-3 py-1.5 rounded-lg bg-bg-3 border border-border-structural text-xs text-text-2 hover:text-text-1"
                    >
                      Rotate (24h grace)
                    </button>
                    <button
                      type="button"
                      (click)="revokeKey(k.id)"
                      class="px-3 py-1.5 rounded-lg bg-status-error/10 border border-status-error/30 text-xs text-status-error"
                    >
                      Revoke
                    </button>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class SettingsPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly api = inject(FlowTraceApiService);

  public readonly projectName = signal('');
  public readonly autoDiscover = signal(true);
  public readonly retentionDays = signal(7);
  public readonly savingProject = signal(false);
  public readonly savedNotice = signal(false);

  public readonly keys = signal<ApiKey[]>([]);
  public readonly newKeyName = signal('');
  public readonly creatingKey = signal(false);
  public readonly revealedKey = signal<string | null>(null);
  public readonly copied = signal(false);

  constructor() {
    effect(() => {
      const proj = this.store.activeProject();
      if (proj) {
        this.projectName.set(proj.name);
        this.autoDiscover.set(proj.autoDiscover);
        this.retentionDays.set(proj.retentionDays);
        void this.loadKeys(proj.id);
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (pid) await this.loadKeys(pid);
  }

  public async saveProject(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    this.savingProject.set(true);
    try {
      const updated = await this.api.updateProject(pid, {
        name: this.projectName().trim(),
        autoDiscover: this.autoDiscover(),
        retentionDays: this.retentionDays(),
      });
      this.store.projects.update((list) => list.map((p) => (p.id === pid ? updated : p)));
      this.savedNotice.set(true);
      setTimeout(() => this.savedNotice.set(false), 1800);
    } finally {
      this.savingProject.set(false);
    }
  }

  public async createKey(): Promise<void> {
    const pid = this.store.selectedProjectId();
    const name = this.newKeyName().trim();
    if (!pid || !name) return;
    this.creatingKey.set(true);
    try {
      const res = await this.api.createKey(pid, name, 1000, 'ingest');
      this.revealedKey.set(res.fullKey);
      this.newKeyName.set('');
      await this.loadKeys(pid);
    } finally {
      this.creatingKey.set(false);
    }
  }

  public async rotateKey(keyId: string): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    const res = await this.api.rotateKey(pid, keyId, 24);
    this.revealedKey.set(res.fullKey);
    await this.loadKeys(pid);
  }

  public async revokeKey(keyId: string): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    await this.api.revokeKey(pid, keyId);
    await this.loadKeys(pid);
  }

  public async copyKey(): Promise<void> {
    const key = this.revealedKey();
    if (!key || typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(key);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  private async loadKeys(projectId: string): Promise<void> {
    try {
      this.keys.set(await this.api.listKeys(projectId));
    } catch {
      // Ignore transient errors
    }
  }
}
