import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-share-embed-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="w-full max-w-lg rounded-2xl bg-bg-1 border border-border-strong shadow-2xl overflow-hidden">
          <div class="px-5 py-4 border-b border-border-structural flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-node-queue text-[20px]">share</span>
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Share &amp; Embed Live View</h2>
            </div>
            <button
              type="button"
              (click)="closed.emit()"
              class="w-7 h-7 rounded-lg text-text-3 hover:text-text-1 hover:bg-bg-2 flex items-center justify-center"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div class="p-5 space-y-5">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-text-2">Direct Live Topology Link</label>
              <div class="flex gap-2">
                <input
                  type="text"
                  readonly
                  [value]="shareUrl()"
                  class="flex-1 h-9 px-3 rounded-lg bg-bg-3 border border-border-structural font-code-sm text-xs text-text-1"
                />
                <button
                  type="button"
                  (click)="copy(shareUrl(), 'link')"
                  class="px-3 h-9 rounded-lg bg-node-queue text-bg-0 text-xs font-semibold shrink-0"
                >
                  {{ copied() === 'link' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-text-2 mb-1">Embed Theme</label>
                <select
                  [ngModel]="embedTheme()"
                  (ngModelChange)="embedTheme.set($event)"
                  class="w-full h-9 px-2.5 rounded-lg bg-bg-3 border border-border-structural text-xs text-text-1"
                >
                  <option value="dark">Dark Neon</option>
                  <option value="light">Light Clean</option>
                  <option value="cozy-light">Cozy Light</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-text-2 mb-1">Height (px)</label>
                <input
                  type="number"
                  min="320"
                  max="1080"
                  [ngModel]="embedHeight()"
                  (ngModelChange)="embedHeight.set(+$event || 520)"
                  class="w-full h-9 px-2.5 rounded-lg bg-bg-3 border border-border-structural text-xs text-text-1"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs font-medium text-text-2">HTML Iframe Snippet</label>
                <button
                  type="button"
                  (click)="copy(iframeSnippet(), 'iframe')"
                  class="text-xs text-node-queue hover:underline"
                >
                  {{ copied() === 'iframe' ? 'Copied!' : 'Copy snippet' }}
                </button>
              </div>
              <pre class="p-3 rounded-xl bg-bg-0 border border-border-structural font-code-sm text-[11px] text-text-2 overflow-x-auto">{{ iframeSnippet() }}</pre>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ShareEmbedModalComponent {
  @Input() public open = false;
  @Input() public projectId = '';
  @Output() public closed = new EventEmitter<void>();

  public readonly embedTheme = signal<'dark' | 'light' | 'cozy-light'>('dark');
  public readonly embedHeight = signal(520);
  public readonly copied = signal<'link' | 'iframe' | null>(null);

  public readonly shareUrl = computed(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.flowtrace.dev';
    return `${origin}/?project=${encodeURIComponent(this.projectId)}&embed=1&theme=${this.embedTheme()}`;
  });

  public readonly iframeSnippet = computed(() => {
    return `<iframe src="${this.shareUrl()}" width="100%" height="${this.embedHeight()}" style="border:0;border-radius:12px;" allow="clipboard-write"></iframe>`;
  });

  public async copy(value: string, kind: 'link' | 'iframe'): Promise<void> {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(value);
    this.copied.set(kind);
    setTimeout(() => this.copied.set(null), 1500);
  }
}
