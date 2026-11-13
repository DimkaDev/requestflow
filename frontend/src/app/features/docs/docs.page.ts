import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';

@Component({
  selector: 'app-docs-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-structural pb-6">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-node-queue/15 text-node-queue font-code-sm text-xs">
              QUICKSTART GUIDE
            </span>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1 mt-2">
              Instrument FlowTrace in 60 seconds
            </h1>
            <p class="text-sm text-text-3 mt-1">
              Stream live request hops over HTTP, UDP, or TCP and watch them animate across your topology.
            </p>
          </div>
          <a
            routerLink="/onboarding"
            class="px-4 py-2 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold shrink-0"
          >
            Interactive Setup Wizard
          </a>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 rounded-xl bg-bg-1 border border-border-structural space-y-1.5">
            <div class="text-xs font-semibold text-node-queue">1. HTTP Ingest</div>
            <div class="font-code-sm text-xs text-text-1">POST /api/v1/events</div>
            <p class="text-xs text-text-3">Best for Node.js, Python, Go, or browser telemetry with batching up to 100 events.</p>
          </div>
          <div class="p-4 rounded-xl bg-bg-1 border border-border-structural space-y-1.5">
            <div class="text-xs font-semibold text-node-service">2. UDP Fire-and-Forget</div>
            <div class="font-code-sm text-xs text-text-1">UDP :9999</div>
            <p class="text-xs text-text-3">Zero-blocking single JSON datagram per hop (&lt; 4KB) for ultra-low latency services.</p>
          </div>
          <div class="p-4 rounded-xl bg-bg-1 border border-border-structural space-y-1.5">
            <div class="text-xs font-semibold text-status-ok">3. TCP NDJSON Stream</div>
            <div class="font-code-sm text-xs text-text-1">TCP :9998</div>
            <p class="text-xs text-text-3">Persistent newline-delimited JSON socket for high-throughput backend workers.</p>
          </div>
        </div>

        <section class="bg-bg-1 border border-border-structural rounded-2xl overflow-hidden">
          <div class="px-5 py-3 bg-bg-2 border-b border-border-structural flex items-center justify-between">
            <span class="font-code-sm text-xs text-text-2">HTTP Batch Example (cURL)</span>
            <button
              type="button"
              (click)="copyCurl()"
              class="text-xs text-node-queue hover:underline"
            >
              {{ copied() ? 'Copied!' : 'Copy' }}
            </button>
          </div>
          <pre class="p-5 font-code-block text-xs text-text-1 overflow-x-auto leading-relaxed">{{ curlExample }}</pre>
        </section>
      </div>
    </div>
  `,
})
export class DocsPageComponent {
  private readonly api = inject(FlowTraceApiService);
  public readonly copied = signal(false);

  public readonly curlExample = `curl -X POST ${this.api.apiBaseUrl}/events \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_PROJECT_API_KEY" \\
  -d '[
    { "traceId": "tr_demo_01", "node": "ingress", "type": "enter" },
    { "traceId": "tr_demo_01", "fromNode": "ingress", "node": "api", "type": "enter" },
    { "traceId": "tr_demo_01", "fromNode": "api", "node": "db", "type": "end" }
  ]'`;

  public async copyCurl(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(this.curlExample);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
