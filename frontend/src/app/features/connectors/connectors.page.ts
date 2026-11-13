import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { ConnectorConfig, ConnectorType, WebhookMapping } from '../../core/models';

@Component({
  selector: 'app-connectors-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Shop &amp; Webhook Connectors</h1>
            <p class="text-sm text-text-3 mt-1">
              Connect Shopify, WooCommerce, Stripe, or any JSON webhook directly into your FlowTrace topology.
            </p>
          </div>
          <div class="flex items-center gap-2 bg-bg-2 border border-border-structural p-1 rounded-xl">
            <button
              type="button"
              (click)="wizardStep.set(1)"
              class="px-3 py-1 rounded-lg text-xs font-medium"
              [class.bg-bg-3]="wizardStep() === 1"
              [class.text-node-queue]="wizardStep() === 1"
              [class.text-text-3]="wizardStep() !== 1"
            >
              1. Choose Platform
            </button>
            <button
              type="button"
              (click)="wizardStep.set(2)"
              class="px-3 py-1 rounded-lg text-xs font-medium"
              [class.bg-bg-3]="wizardStep() === 2"
              [class.text-node-queue]="wizardStep() === 2"
              [class.text-text-3]="wizardStep() !== 2"
            >
              2. Map Your Data
            </button>
          </div>
        </div>

        <!-- Step 1: Choose Platform -->
        @if (wizardStep() === 1) {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            @for (p of platforms; track p.type) {
              @let selected = selectedType() === p.type;
              <button
                type="button"
                (click)="selectPlatform(p.type, p.defaultName)"
                class="text-left p-5 rounded-2xl bg-bg-2 border transition-all space-y-3"
                [class.border-node-queue]="selected"
                [class.shadow-[0_0_20px_rgba(34,211,238,0.18)]="selected"
                [class.border-border-structural]="!selected"
              >
                <div class="w-10 h-10 rounded-xl bg-bg-1 border border-border-structural flex items-center justify-center">
                  <span class="material-symbols-outlined text-[22px]" [style.color]="p.color">{{ p.icon }}</span>
                </div>
                <div>
                  <h3 class="text-sm font-semibold text-text-1">{{ p.title }}</h3>
                  <p class="text-xs text-text-3 mt-1">{{ p.description }}</p>
                </div>
              </button>
            }
          </div>

          <div class="flex justify-end">
            <button
              type="button"
              (click)="wizardStep.set(2)"
              class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold flex items-center gap-1.5"
            >
              <span>Configure Data Mapping</span>
              <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        }

        <!-- Step 2: Map Your Data -->
        @if (wizardStep() === 2) {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div class="lg:col-span-7 bg-bg-1 border border-border-structural rounded-2xl p-6 space-y-4">
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Webhook Mapping</h2>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="sm:col-span-2">
                  <label class="block text-text-2 mb-1">Connector Name</label>
                  <input
                    type="text"
                    [ngModel]="connectorName()"
                    (ngModelChange)="connectorName.set($event)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-text-1"
                  />
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Trace ID JSONPath</label>
                  <input
                    type="text"
                    [ngModel]="mapping().traceIdPath"
                    (ngModelChange)="patchMapping('traceIdPath', $event)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural font-code-sm text-text-1"
                  />
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Default Funnel Node</label>
                  <input
                    type="text"
                    [ngModel]="mapping().defaultNode"
                    (ngModelChange)="patchMapping('defaultNode', $event)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural font-code-sm text-text-1"
                  />
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Customer Name Path</label>
                  <input
                    type="text"
                    [ngModel]="mapping().entityNamePath"
                    (ngModelChange)="patchMapping('entityNamePath', $event)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural font-code-sm text-text-1"
                  />
                </div>
                <div>
                  <label class="block text-text-2 mb-1">Order Amount Path</label>
                  <input
                    type="text"
                    [ngModel]="mapping().amountPath"
                    (ngModelChange)="patchMapping('amountPath', $event)"
                    class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural font-code-sm text-text-1"
                  />
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  (click)="wizardStep.set(1)"
                  class="px-4 py-2 rounded-xl bg-bg-2 border border-border-structural text-xs text-text-2"
                >
                  Back
                </button>
                <button
                  type="button"
                  [disabled]="saving()"
                  (click)="createConnector()"
                  class="px-5 py-2 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold disabled:opacity-50"
                >
                  {{ saving() ? 'Creating…' : 'Create Connector' }}
                </button>
              </div>
            </div>

            <div class="lg:col-span-5 bg-bg-2 border border-border-structural rounded-2xl p-5 space-y-3">
              <h3 class="text-sm font-semibold text-text-1">Created Secret &amp; Endpoint</h3>
              @if (createdSecret()) {
                <div class="p-3 rounded-xl bg-status-ok/10 border border-status-ok/30 space-y-1.5 text-xs">
                  <div class="text-status-ok font-semibold">Connector ready! Save your webhook secret:</div>
                  <code class="block font-code-sm text-text-1 break-all select-all">{{ createdSecret() }}</code>
                </div>
              } @else {
                <p class="text-xs text-text-3">
                  Once created, FlowTrace generates a dedicated webhook ingestion token and URL for your storefront.
                </p>
              }
            </div>
          </div>
        }

        <!-- Active Connectors List -->
        <div class="space-y-3">
          <h2 class="font-headline-sm text-base font-semibold text-text-1">Active Project Connectors</h2>
          @if (connectors().length === 0) {
            <div class="p-6 rounded-xl bg-bg-1 border border-border-structural text-xs text-text-3">
              No connectors configured yet.
            </div>
          } @else {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (c of connectors(); track c.id) {
                <div class="p-4 rounded-xl bg-bg-2 border border-border-structural flex items-center justify-between gap-4">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-semibold text-text-1 truncate">{{ c.name }}</span>
                      <span class="px-2 py-0.5 rounded bg-bg-3 font-code-sm text-[10px] text-node-queue">
                        {{ c.type }}
                      </span>
                    </div>
                    <div class="text-xs font-code-sm text-text-3 mt-1">
                      {{ c.tokenPrefix }}•••• · {{ c.totalEvents }} events
                    </div>
                  </div>
                  <button
                    type="button"
                    (click)="deleteConnector(c.id)"
                    class="w-8 h-8 rounded-lg bg-bg-3 text-text-3 hover:text-status-error flex items-center justify-center"
                    title="Delete connector"
                  >
                    <span class="material-symbols-outlined text-[17px]">delete</span>
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ConnectorsPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  private readonly api = inject(FlowTraceApiService);

  public readonly wizardStep = signal<1 | 2>(1);
  public readonly selectedType = signal<ConnectorType>('SHOPIFY_WEBHOOK');
  public readonly connectorName = signal('Shopify Production Store');
  public readonly mapping = signal<WebhookMapping>({
    traceIdPath: '$.checkout_token',
    defaultNode: 'checkout',
    entityNamePath: '$.customer.first_name',
    amountPath: '$.total_price',
    currencyPath: '$.currency',
  });
  public readonly connectors = signal<ConnectorConfig[]>([]);
  public readonly createdSecret = signal<string | null>(null);
  public readonly saving = signal(false);

  public readonly platforms: Array<{
    type: ConnectorType;
    title: string;
    defaultName: string;
    description: string;
    icon: string;
    color: string;
  }> = [
    {
      type: 'SHOPIFY_WEBHOOK',
      title: 'Shopify',
      defaultName: 'Shopify Production Store',
      description: 'Order, cart, and checkout webhooks mapped to e-commerce funnel nodes.',
      icon: 'shopping_bag',
      color: '#34D399',
    },
    {
      type: 'STRIPE_WEBHOOK',
      title: 'Stripe',
      defaultName: 'Stripe Checkout Events',
      description: 'Payment intent succeeded, failed, and refund webhook events.',
      icon: 'credit_card',
      color: '#8B5CF6',
    },
    {
      type: 'WOOCOMMERCE_WEBHOOK',
      title: 'WooCommerce',
      defaultName: 'WooCommerce Store',
      description: 'WordPress WooCommerce order lifecycle hooks.',
      icon: 'storefront',
      color: '#60A5FA',
    },
    {
      type: 'GENERIC_WEBHOOK',
      title: 'Generic JSON Webhook',
      defaultName: 'Custom Webhook Ingest',
      description: 'Map any custom JSON payload with JSONPath expressions.',
      icon: 'webhook',
      color: '#22D3EE',
    },
  ];

  constructor() {
    effect(() => {
      const pid = this.store.selectedProjectId();
      if (pid) void this.loadConnectors(pid);
    });
  }

  public async ngOnInit(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (pid) await this.loadConnectors(pid);
  }

  public selectPlatform(type: ConnectorType, defaultName: string): void {
    this.selectedType.set(type);
    this.connectorName.set(defaultName);
  }

  public patchMapping(field: keyof WebhookMapping, value: string): void {
    this.mapping.update((m) => ({ ...m, [field]: value }));
  }

  public async createConnector(): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid || !this.connectorName().trim()) return;
    this.saving.set(true);
    try {
      const res = await this.api.createConnector(pid, {
        name: this.connectorName().trim(),
        type: this.selectedType(),
        mapping: this.mapping(),
      });
      this.createdSecret.set(res.secretToken);
      await this.loadConnectors(pid);
    } finally {
      this.saving.set(false);
    }
  }

  public async deleteConnector(id: string): Promise<void> {
    const pid = this.store.selectedProjectId();
    if (!pid) return;
    await this.api.deleteConnector(pid, id);
    this.connectors.update((list) => list.filter((c) => c.id !== id));
  }

  private async loadConnectors(projectId: string): Promise<void> {
    try {
      const list = await this.api.listConnectors(projectId);
      this.connectors.set(list);
    } catch {
      // Ignore transient errors
    }
  }
}
