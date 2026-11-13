import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowTemplateId, resolveTemplateProfile } from '../../core/template-visuals';

type SnippetLang = 'node' | 'java' | 'python' | 'curl' | 'udp';

@Component({
  selector: 'app-onboarding-wizard-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1 flex flex-col">
      <!-- Wizard Stepper Subheader -->
      <div class="bg-bg-1/90 border-b border-border-structural px-6 py-3 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="px-2.5 py-0.5 rounded-full bg-node-queue/15 border border-node-queue/30 text-node-queue text-[11px] font-code-sm font-semibold">
            ONBOARDING
          </span>
          <span class="text-sm font-medium text-text-2">
            {{ store.activeProject()?.name || 'New Project' }}
          </span>
        </div>

        <div class="flex items-center gap-2 bg-bg-2 border border-border-structural p-1 rounded-xl">
          @for (s of steps; track s.num) {
            <button
              type="button"
              (click)="step.set(s.num)"
              class="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
              [class.bg-bg-3]="step() === s.num"
              [class.text-text-1]="step() === s.num"
              [class.text-status-ok]="step() > s.num"
              [class.text-text-3]="step() < s.num"
            >
              @if (step() > s.num) {
                <span class="material-symbols-outlined text-[15px] text-status-ok">check_circle</span>
              } @else {
                <span class="font-code-sm text-[11px]">{{ s.num }}.</span>
              }
              <span>{{ s.label }}</span>
            </button>
          }
        </div>

        <a
          routerLink="/"
          class="text-xs text-text-3 hover:text-text-1 flex items-center gap-1 transition-colors"
        >
          <span>Skip to Canvas</span>
          <span class="material-symbols-outlined text-[15px]">arrow_forward</span>
        </a>
      </div>

      <!-- STEP 1: CHOOSE A TEMPLATE -->
      @if (step() === 1) {
        <div class="max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
          <div class="space-y-1.5">
            <div class="text-xs font-code-sm text-node-queue uppercase tracking-wider">
              Step 1 of 3 · Choose Architecture
            </div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">What do you want to watch?</h1>
            <p class="text-sm text-text-2 max-w-2xl">
              Choose a pre-configured flow template to initialize your live topology map with animated request hops.
            </p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" role="radiogroup">
            @for (tpl of templateCards; track tpl.id) {
              @let selected = selectedTemplate() === tpl.id;
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="selected"
                (click)="selectedTemplate.set(tpl.id)"
                class="relative text-left flex flex-col justify-between p-4 rounded-xl bg-bg-2 border transition-all"
                [class.border-node-queue]="selected"
                [class.shadow-[0_0_24px_rgba(34,211,238,0.2)]]="selected"
                [class.border-border-structural]="!selected"
                [class.hover:border-border-strong]="!selected"
              >
                @if (selected) {
                  <span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-[10px] font-semibold uppercase">
                    Selected
                  </span>
                }

                <div class="space-y-3">
                  <!-- Mini Animated Flow Preview -->
                  <div class="relative w-full h-28 rounded-lg bg-bg-0 border border-border-structural overflow-hidden flex items-center justify-center">
                    <svg class="w-full h-full" viewBox="0 0 220 96" fill="none">
                      <path d="M 38 48 L 110 48 L 182 48" stroke="#262C3A" stroke-width="2" />
                      <circle r="3.5" [attr.fill]="tpl.accent">
                        <animateMotion dur="1.8s" repeatCount="indefinite" path="M 38 48 L 182 48" />
                      </circle>
                      <rect x="20" y="34" width="32" height="28" rx="7" fill="#171B24" stroke="#343C4F" />
                      <rect x="92" y="34" width="36" height="28" rx="7" fill="#171B24" [attr.stroke]="tpl.accent" />
                      <rect x="168" y="34" width="32" height="28" rx="7" fill="#171B24" stroke="#343C4F" />
                    </svg>
                  </div>

                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-text-1">{{ tpl.name }}</span>
                      <span class="material-symbols-outlined text-[18px]" [style.color]="tpl.accent">{{ tpl.icon }}</span>
                    </div>
                    <p class="text-xs text-text-3 mt-1 line-clamp-2">{{ tpl.tagline }}</p>
                  </div>
                </div>

                <div class="mt-4 pt-2.5 border-t border-border-structural/50 flex items-center justify-between text-[11px] font-code-sm text-text-3">
                  <span>{{ tpl.protocol }}</span>
                  <span class="text-node-queue">{{ tpl.themeLabel }}</span>
                </div>
              </button>
            }
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="button"
              [disabled]="busy()"
              (click)="applyAndContinue()"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-sm font-semibold flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:opacity-95 disabled:opacity-50"
            >
              <span>{{ busy() ? 'Applying Template…' : 'Continue to Instrumentation' }}</span>
              <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>
        </div>
      }

      <!-- STEP 2: SEND YOUR FIRST EVENT -->
      @if (step() === 2) {
        <div class="max-w-6xl w-full mx-auto px-6 py-8 space-y-6">
          <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div class="space-y-1.5">
              <div class="text-xs font-code-sm text-node-queue uppercase tracking-wider">
                Step 2 of 3 · Instrumentation
              </div>
              <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Send your first event</h1>
              <p class="text-sm text-text-2 max-w-2xl">
                Copy this snippet with your project API key, or fire a test multi-hop trace directly from the browser.
              </p>
            </div>

            <div class="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-bg-2 border border-border-structural">
              <span class="material-symbols-outlined text-node-queue text-[18px]">hub</span>
              <div>
                <div class="text-[10px] uppercase text-text-3">Active Template</div>
                <div class="text-xs font-semibold text-text-1">{{ store.templateProfile().displayName }}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div class="lg:col-span-7 space-y-4">
              <!-- Language Tabs -->
              <div class="bg-bg-1 p-1.5 rounded-xl border border-border-structural flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-1">
                  @for (l of langs; track l.id) {
                    <button
                      type="button"
                      (click)="lang.set(l.id)"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      [class.bg-bg-3]="lang() === l.id"
                      [class.text-node-queue]="lang() === l.id"
                      [class.text-text-3]="lang() !== l.id"
                    >
                      {{ l.label }}
                    </button>
                  }
                </div>
                <span class="font-code-sm text-[11px] text-text-3 px-2">
                  Key: {{ maskedApiKey() }}
                </span>
              </div>

              <!-- Code Block -->
              <div class="bg-bg-1 border border-border-structural rounded-2xl overflow-hidden">
                <div class="h-10 px-4 bg-bg-2 border-b border-border-structural flex items-center justify-between">
                  <span class="font-code-sm text-xs text-text-3">{{ currentFileName() }}</span>
                  <button
                    type="button"
                    (click)="copySnippet()"
                    class="flex items-center gap-1 text-xs text-text-2 hover:text-text-1 px-2 py-1 rounded-lg hover:bg-bg-3"
                  >
                    <span class="material-symbols-outlined text-[14px]">{{ copiedSnippet() ? 'check' : 'content_copy' }}</span>
                    <span>{{ copiedSnippet() ? 'Copied' : 'Copy Snippet' }}</span>
                  </button>
                </div>
                <pre class="p-5 font-code-block text-xs text-text-1 overflow-x-auto leading-relaxed">{{ currentSnippet() }}</pre>
              </div>
            </div>

            <!-- Right Panel: Instant Browser Test -->
            <div class="lg:col-span-5 bg-bg-2 border border-border-structural rounded-2xl p-5 space-y-4">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-node-queue text-[20px]">bolt</span>
                <h2 class="text-sm font-semibold text-text-1">Instant Verification</h2>
              </div>
              <p class="text-xs text-text-2 leading-relaxed">
                Don't want to switch to a terminal yet? Fire a real 3-hop trace directly to <code class="text-node-queue">/api/v1/events</code> using your project API key.
              </p>

              @if (testSendError()) {
                <div class="p-2.5 rounded-lg bg-status-error/15 border border-status-error/40 text-xs text-status-error">
                  {{ testSendError() }}
                </div>
              }

              <div class="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  [disabled]="busy()"
                  (click)="fireTestTraceAndListen()"
                  class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50"
                >
                  <span class="material-symbols-outlined text-[17px]">send</span>
                  <span>{{ busy() ? 'Sending Trace…' : 'Send Test Event & Listen' }}</span>
                </button>
                <button
                  type="button"
                  (click)="step.set(3)"
                  class="w-full py-2 px-4 rounded-xl bg-bg-3 border border-border-structural text-xs text-text-2 hover:text-text-1"
                >
                  I already ran the snippet → Listen
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- STEP 3: WAITING / SUCCESS STATE -->
      @if (step() === 3) {
        <div class="max-w-3xl w-full mx-auto px-6 py-12 flex-1 flex flex-col justify-center">
          <div class="bg-bg-1 border border-border-structural rounded-2xl p-8 text-center space-y-6 shadow-2xl">
            @if (eventReceived()) {
              <div class="w-16 h-16 mx-auto rounded-2xl bg-status-ok/15 border border-status-ok/40 flex items-center justify-center">
                <span class="material-symbols-outlined text-status-ok text-[34px]">check_circle</span>
              </div>
              <div class="space-y-2">
                <span class="px-2.5 py-0.5 rounded-full bg-status-ok/15 text-status-ok font-code-sm text-xs">
                  TELEMETRY CONNECTED
                </span>
                <h1 class="font-headline-lg text-2xl font-semibold text-text-1">
                  First trace received and flowing!
                </h1>
                <p class="text-sm text-text-2 max-w-md mx-auto">
                  Your live topology is receiving events over WebSocket. Open the Live Canvas to watch requests travel node-to-node.
                </p>
              </div>
              <div class="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  (click)="finishOnboarding()"
                  class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-sm font-semibold flex items-center gap-2 shadow-[0_0_24px_rgba(34,211,238,0.3)]"
                >
                  <span>Open Live Topology</span>
                  <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            } @else {
              <div class="relative w-16 h-16 mx-auto flex items-center justify-center">
                <span class="absolute inset-0 rounded-full bg-node-queue/20 animate-ping"></span>
                <div class="relative w-14 h-14 rounded-2xl bg-bg-2 border border-node-queue/40 flex items-center justify-center">
                  <span class="material-symbols-outlined text-node-queue text-[28px]">radar</span>
                </div>
              </div>
              <div class="space-y-2">
                <span class="px-2.5 py-0.5 rounded-full bg-node-queue/10 text-node-queue font-code-sm text-xs">
                  LISTENING ON STREAM
                </span>
                <h1 class="font-headline-lg text-2xl font-semibold text-text-1">
                  Waiting for your first event…
                </h1>
                <p class="text-sm text-text-2 max-w-md mx-auto">
                  Send an event with your SDK or click below to trigger a sample trace right now.
                </p>
              </div>
              <div class="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  (click)="step.set(2)"
                  class="px-4 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs text-text-2 hover:text-text-1"
                >
                  Back to Snippet
                </button>
                <button
                  type="button"
                  (click)="fireTestTraceAndListen()"
                  class="px-5 py-2 rounded-xl bg-node-queue text-bg-0 text-xs font-semibold"
                >
                  Simulate Event Now
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class OnboardingWizardPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly api = inject(FlowTraceApiService);
  private readonly router = inject(Router);

  public readonly step = signal<1 | 2 | 3>(1);
  public readonly selectedTemplate = signal<FlowTemplateId>('microservices');
  public readonly lang = signal<SnippetLang>('node');
  public readonly busy = signal(false);
  public readonly activeApiKey = signal<string>('ft_live_onboarding_key');
  public readonly copiedSnippet = signal(false);
  public readonly testSendError = signal<string | null>(null);
  public readonly eventReceived = signal(false);

  public readonly steps: Array<{ num: 1 | 2 | 3; label: string }> = [
    { num: 1, label: 'Template' },
    { num: 2, label: 'Telemetry SDK' },
    { num: 3, label: 'Live Verify' },
  ];

  public readonly langs: Array<{ id: SnippetLang; label: string }> = [
    { id: 'node', label: 'Node.js' },
    { id: 'java', label: 'Java' },
    { id: 'python', label: 'Python' },
    { id: 'curl', label: 'cURL' },
    { id: 'udp', label: 'UDP' },
  ];

  public readonly templateCards = (
    ['microservices', 'online-shop', 'queue-worker', 'ai-rag'] as FlowTemplateId[]
  ).map((id) => {
    const p = resolveTemplateProfile(id);
    const icons: Record<FlowTemplateId, string> = {
      microservices: 'hub',
      'online-shop': 'storefront',
      'queue-worker': 'stream',
      'ai-rag': 'psychology',
    };
    const accents: Record<FlowTemplateId, string> = {
      microservices: '#8B5CF6',
      'online-shop': '#34D399',
      'queue-worker': '#22D3EE',
      'ai-rag': '#F59E0B',
    };
    const protocols: Record<FlowTemplateId, string> = {
      microservices: 'HTTP / gRPC',
      'online-shop': 'Webhooks',
      'queue-worker': 'Kafka / AMQP',
      'ai-rag': 'SSE / Vector',
    };
    return {
      id,
      name: p.displayName,
      tagline: p.tagline,
      icon: icons[id],
      accent: accents[id],
      protocol: protocols[id],
      themeLabel: p.recommendedTheme,
    };
  });

  public readonly maskedApiKey = computed(() => {
    const k = this.activeApiKey();
    if (k.length <= 12) return k;
    return `${k.slice(0, 8)}••••${k.slice(-4)}`;
  });

  constructor() {
    effect(() => {
      if (this.step() === 3 && (this.store.activeTokens().length > 0 || this.store.recentTraces().length > 0)) {
        this.eventReceived.set(true);
      }
    });
  }

  public async ngOnInit(): Promise<void> {
    this.selectedTemplate.set(this.store.activeTemplateId());
    await this.ensureApiKey();
  }

  public async applyAndContinue(): Promise<void> {
    this.busy.set(true);
    try {
      await this.store.applyTemplate(this.selectedTemplate());
      await this.ensureApiKey();
      this.step.set(2);
    } finally {
      this.busy.set(false);
    }
  }

  public currentFileName(): string {
    switch (this.lang()) {
      case 'node':
        return 'tracing.mjs';
      case 'java':
        return 'FlowTraceClient.java';
      case 'python':
        return 'tracing.py';
      case 'curl':
        return 'send-event.sh';
      case 'udp':
        return 'udp-datagram.sh';
    }
  }

  public currentSnippet(): string {
    const key = this.activeApiKey();
    const firstNode = this.store.diagram().nodes[0]?.key || 'ingress';
    const secondNode = this.store.diagram().nodes[1]?.key || 'service';
    switch (this.lang()) {
      case 'node':
        return `await fetch('${this.api.apiBaseUrl}/events', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': '${key}' },
  body: JSON.stringify([
    { traceId: 'tr_init_01', node: '${firstNode}', type: 'enter' },
    { traceId: 'tr_init_01', fromNode: '${firstNode}', node: '${secondNode}', type: 'enter' }
  ])
});`;
      case 'java':
        return `HttpRequest req = HttpRequest.newBuilder()
  .uri(URI.create("${this.api.apiBaseUrl}/events"))
  .header("Content-Type", "application/json")
  .header("X-API-Key", "${key}")
  .POST(HttpRequest.BodyPublishers.ofString(
    "[{\\"traceId\\":\\"tr_init_01\\",\\"node\\":\\"${firstNode}\\",\\"type\\":\\"enter\\"}]"))
  .build();`;
      case 'python':
        return `import requests
requests.post("${this.api.apiBaseUrl}/events",
  headers={"X-API-Key": "${key}"},
  json=[
    {"traceId": "tr_init_01", "node": "${firstNode}", "type": "enter"},
    {"traceId": "tr_init_01", "fromNode": "${firstNode}", "node": "${secondNode}", "type": "enter"}
  ])`;
      case 'curl':
        return `curl -X POST ${this.api.apiBaseUrl}/events \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${key}" \\
  -d '[{"traceId":"tr_init_01","node":"${firstNode}","type":"enter"}]'`;
      case 'udp':
        return `echo '{"k":"${key}","t":"tr_init_01","n":"${firstNode}","e":"enter"}' | nc -u -w1 localhost 9999`;
    }
  }

  public async copySnippet(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(this.currentSnippet());
    this.copiedSnippet.set(true);
    setTimeout(() => this.copiedSnippet.set(false), 1500);
  }

  public async fireTestTraceAndListen(): Promise<void> {
    this.busy.set(true);
    this.testSendError.set(null);
    try {
      await this.ensureApiKey();
      const nodes = this.store.diagram().nodes;
      const n1 = nodes[0]?.key || 'ingress';
      const n2 = nodes[1]?.key || n1;
      const n3 = nodes[2]?.key || n2;
      const traceId = `tr_onboard_${Date.now().toString(36)}`;
      await this.api.sendTestEvents(this.activeApiKey(), [
        { traceId, node: n1, type: 'enter', attrs: { source: 'onboarding-wizard' } },
        { traceId, fromNode: n1, node: n2, type: 'enter', attrs: { latencyMs: 14 } },
        { traceId, fromNode: n2, node: n3, type: 'end', attrs: { status: 'ok' } },
      ]);
      this.step.set(3);
      this.eventReceived.set(true);
    } catch (err) {
      this.testSendError.set(err instanceof Error ? err.message : 'Failed to send test event');
    } finally {
      this.busy.set(false);
    }
  }

  public async finishOnboarding(): Promise<void> {
    await this.router.navigateByUrl('/');
  }

  private async ensureApiKey(): Promise<void> {
    const projectId = this.store.selectedProjectId();
    if (!projectId) return;
    try {
      const keys = await this.api.listKeys(projectId);
      const active = keys.find((k) => !k.revokedAt);
      if (active && this.activeApiKey() === 'ft_live_onboarding_key') {
        const created = await this.api.createKey(projectId, 'Onboarding Wizard Key', 1000, 'ingest');
        this.activeApiKey.set(created.fullKey);
      } else if (!active) {
        const created = await this.api.createKey(projectId, 'Onboarding Wizard Key', 1000, 'ingest');
        this.activeApiKey.set(created.fullKey);
      }
    } catch {
      // Keep placeholder key if backend offline
    }
  }
}
