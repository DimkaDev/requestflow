import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';
import { FlowTemplateId, resolveTemplateProfile } from '../../core/template-visuals';

type SnippetLang = 'java' | 'node' | 'python' | 'curl' | 'udp';
type OnboardingTemplateChoice = FlowTemplateId | 'blank';

interface OnboardingTemplateCard {
  id: OnboardingTemplateChoice;
  name: string;
  tagline: string;
  icon: string;
  accent: string;
  nodeSummary: string;
  protocol: string;
  variant: 'mesh' | 'shop' | 'queue' | 'rag' | 'blank';
}

@Component({
  selector: 'app-onboarding-wizard-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="pt-14 min-h-screen bg-[#0B0E14] text-[#F1F5F9] flex flex-col justify-between">
      <div>
        <!-- Wizard Top Stepper Bar (Stitch Setup Header) -->
        <div class="bg-[#080B10]/95 border-b border-white/[0.07] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-[#64748B]">
              Setup / <span class="text-[#E2E8F0]">{{ store.activeProject()?.name || 'New Project' }}</span>
            </span>
            <span
              class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider border"
              [class.bg-emerald-400/10]="step() === 3 && eventReceived()"
              [class.border-emerald-400/30]="step() === 3 && eventReceived()"
              [class.text-emerald-400]="step() === 3 && eventReceived()"
              [class.bg-cyan-400/10]="!(step() === 3 && eventReceived())"
              [class.border-cyan-400/30]="!(step() === 3 && eventReceived())"
              [class.text-cyan-300]="!(step() === 3 && eventReceived())"
            >
              {{ step() === 3 && eventReceived() ? 'STREAM ACTIVATED' : 'ONBOARDING MODE' }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 bg-[#111622] border border-white/[0.08] p-1 rounded-xl">
            @for (s of steps; track s.num) {
              <button
                type="button"
                (click)="step.set(s.num)"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                [class.bg-[#1A2233]]="step() === s.num"
                [class.text-cyan-300]="step() === s.num"
                [class.text-emerald-400]="step() > s.num"
                [class.text-[#64748B]]="step() < s.num"
              >
                @if (step() > s.num || (s.num === 3 && eventReceived())) {
                  <span class="material-symbols-outlined text-[15px] text-emerald-400">check_circle</span>
                } @else {
                  <span
                    class="w-4 h-4 rounded-full text-[10px] font-mono inline-flex items-center justify-center border"
                    [class.border-cyan-400]="step() === s.num"
                    [class.text-cyan-300]="step() === s.num"
                    [class.border-white/15]="step() !== s.num"
                  >
                    {{ s.num }}
                  </span>
                }
                <span>{{ s.label }}</span>
              </button>
            }
          </div>

          <div class="flex items-center gap-3">
            <a
              routerLink="/docs"
              class="text-xs text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1 transition-colors"
            >
              <span class="material-symbols-outlined text-[15px]">help</span>
              <span>Docs</span>
            </a>
            <a
              routerLink="/"
              class="px-2.5 py-1 rounded-lg bg-[#111622] border border-white/[0.08] text-xs text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1 transition-colors"
            >
              <span class="material-symbols-outlined text-[14px]">close</span>
              <span>Exit</span>
            </a>
          </div>
        </div>

        <!-- Progress Hairline -->
        <div class="h-0.5 w-full bg-white/[0.05]">
          <div
            class="h-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300"
            [style.width.%]="step() === 1 ? 33.3 : step() === 2 ? 66.6 : 100"
          ></div>
        </div>

        <!-- ================================================================ -->
        <!-- STEP 1: CHOOSE A TEMPLATE                                        -->
        <!-- ================================================================ -->
        @if (step() === 1) {
          <div class="max-w-6xl w-full mx-auto px-6 py-9 space-y-7">
            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-[0.14em]">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>Step 1 of 3 · Get Started</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F5F9]">
                  What do you want to watch?
                </h1>
                <p class="text-sm text-[#94A3B8] max-w-2xl">
                  Choose a pre-configured architecture template to initialize an instant live topology map, or start
                  clean with automatic node discovery.
                </p>
              </div>
              <span class="px-3 py-1 rounded-lg bg-[#111622] border border-white/[0.08] font-mono text-[11px] text-[#94A3B8] shrink-0">
                {{ templateCards.length }} architectures available
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" role="radiogroup">
              @for (tpl of templateCards; track tpl.id) {
                @let selected = selectedTemplate() === tpl.id;
                <button
                  type="button"
                  role="radio"
                  [attr.aria-checked]="selected"
                  (click)="selectedTemplate.set(tpl.id)"
                  class="relative text-left flex flex-col justify-between p-4 rounded-xl bg-[#111622] border transition-all duration-150 hover:-translate-y-0.5"
                  [class.border-cyan-400]="selected"
                  [class.shadow-[0_0_28px_rgba(34,211,238,0.18)]]="selected"
                  [class.border-white/[0.08]]="!selected"
                  [class.hover:border-white/20]="!selected"
                >
                  @if (selected) {
                    <span class="absolute -top-2.5 right-3 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-[10px] font-bold uppercase tracking-wider shadow">
                      ✓ Selected
                    </span>
                  }

                  <div class="space-y-3.5">
                    <!-- Mini Animated SVG Preview -->
                    <div class="relative w-full h-32 rounded-lg bg-[#090D14] border border-white/[0.06] overflow-hidden">
                      <div
                        class="absolute inset-0 opacity-30"
                        style="background-image: radial-gradient(rgba(148,163,184,0.22) 1px, transparent 1px); background-size: 14px 14px;"
                      ></div>
                      <svg class="w-full h-full relative z-10" viewBox="0 0 260 112" fill="none">
                        @if (tpl.variant === 'blank') {
                          <circle cx="130" cy="56" r="34" stroke="#1E293B" stroke-dasharray="4 4" />
                          <rect x="112" y="38" width="36" height="36" rx="10" fill="#131926" stroke="#334155" />
                          <path d="M130 49 V63 M123 56 H137" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" />
                        } @else if (tpl.variant === 'shop') {
                          <path d="M 46 56 L 106 56 L 168 56 L 222 56" stroke="#243045" stroke-width="2" />
                          <circle r="3.5" fill="#34D399">
                            <animateMotion dur="2.1s" repeatCount="indefinite" path="M 46 56 L 222 56" />
                          </circle>
                          <rect x="20" y="42" width="36" height="28" rx="6" fill="#141B29" stroke="#2E3A52" />
                          <text x="38" y="59" text-anchor="middle" fill="#CBD5E1" font-size="8" font-family="monospace">Shop</text>
                          <rect x="86" y="42" width="40" height="28" rx="6" fill="#141B29" stroke="#22D3EE" stroke-opacity="0.7" />
                          <text x="106" y="59" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="monospace">cart</text>
                          <rect x="148" y="42" width="42" height="28" rx="6" fill="#141B29" stroke="#F59E0B" stroke-opacity="0.7" />
                          <text x="169" y="59" text-anchor="middle" fill="#FDE68A" font-size="8" font-family="monospace">chkout</text>
                          <rect x="208" y="42" width="36" height="28" rx="6" fill="#0F2922" stroke="#34D399" />
                          <text x="226" y="59" text-anchor="middle" fill="#34D399" font-size="8" font-family="monospace">PAID</text>
                        } @else if (tpl.variant === 'queue') {
                          <path d="M 52 56 H 112" stroke="#243045" stroke-width="2" />
                          <path d="M 142 56 C 168 56, 174 34, 198 34" stroke="#22D3EE" stroke-width="1.6" />
                          <path d="M 142 56 C 168 56, 174 78, 198 78" stroke="#F59E0B" stroke-width="1.6" />
                          <circle r="3" fill="#22D3EE">
                            <animateMotion dur="1.9s" repeatCount="indefinite" path="M 52 56 H 112 C 168 56, 174 34, 198 34" />
                          </circle>
                          <circle cx="42" cy="56" r="14" fill="#141B29" stroke="#22D3EE" />
                          <rect x="104" y="40" width="40" height="32" rx="7" fill="#141B29" stroke="#334155" />
                          <rect x="194" y="20" width="44" height="26" rx="6" fill="#141B29" stroke="#22D3EE" />
                          <text x="216" y="36" text-anchor="middle" fill="#CBD5E1" font-size="8" font-family="monospace">wrk-1</text>
                          <rect x="194" y="64" width="44" height="26" rx="6" fill="#141B29" stroke="#F59E0B" />
                          <text x="216" y="80" text-anchor="middle" fill="#FDE68A" font-size="8" font-family="monospace">wrk-2</text>
                        } @else if (tpl.variant === 'rag') {
                          <path d="M 48 56 H 114" stroke="#243045" stroke-width="2" />
                          <path d="M 146 56 C 170 56, 174 34, 198 34" stroke="#8B5CF6" stroke-dasharray="3 3" stroke-width="1.6" />
                          <path d="M 146 56 C 170 56, 174 78, 198 78" stroke="#F59E0B" stroke-dasharray="3 3" stroke-width="1.6" />
                          <circle r="3" fill="#F59E0B">
                            <animateMotion dur="2s" repeatCount="indefinite" path="M 48 56 H 146 C 170 56, 174 34, 198 34" />
                          </circle>
                          <rect x="22" y="42" width="32" height="28" rx="6" fill="#141B29" stroke="#2E3A52" />
                          <circle cx="130" cy="56" r="18" fill="#17142B" stroke="#8B5CF6" stroke-width="1.8" />
                          <circle cx="130" cy="56" r="6" fill="#A78BFA" />
                          <rect x="194" y="21" width="46" height="24" rx="6" fill="#141B29" stroke="#22D3EE" />
                          <text x="217" y="36" text-anchor="middle" fill="#A5F3FC" font-size="7.5" font-family="monospace">VECTR</text>
                          <rect x="194" y="66" width="46" height="24" rx="6" fill="#141B29" stroke="#F59E0B" />
                          <text x="217" y="81" text-anchor="middle" fill="#FDE68A" font-size="7.5" font-family="monospace">TOOLS</text>
                        } @else {
                          <path d="M 52 56 C 84 56, 86 32, 114 32 C 154 32, 166 56, 198 56" stroke="#22D3EE" stroke-width="1.8" />
                          <path d="M 52 56 C 84 56, 86 80, 114 80 C 154 80, 166 56, 198 56" stroke="#8B5CF6" stroke-width="1.8" />
                          <circle r="3.2" fill="#22D3EE">
                            <animateMotion dur="2s" repeatCount="indefinite" path="M 52 56 C 84 56, 86 32, 114 32 C 154 32, 166 56, 198 56" />
                          </circle>
                          <circle cx="40" cy="56" r="14" fill="#141B29" stroke="#22D3EE" />
                          <rect x="108" y="18" width="54" height="24" rx="6" fill="#141B29" stroke="#2E3A52" />
                          <text x="135" y="33" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="monospace">orders</text>
                          <rect x="108" y="68" width="54" height="24" rx="6" fill="#141B29" stroke="#2E3A52" />
                          <text x="135" y="83" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="monospace">billing</text>
                          <circle cx="212" cy="56" r="14" fill="#0F2922" stroke="#34D399" />
                        }
                      </svg>
                    </div>

                    <div>
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[15px] font-semibold text-[#F1F5F9]">{{ tpl.name }}</span>
                        <span class="material-symbols-outlined text-[18px]" [style.color]="tpl.accent">{{ tpl.icon }}</span>
                      </div>
                      <p class="text-xs text-[#94A3B8] mt-1.5 line-clamp-2 leading-relaxed">{{ tpl.tagline }}</p>
                    </div>
                  </div>

                  <div class="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono">
                    <span class="px-2 py-0.5 rounded bg-[#0D111A] border border-white/[0.06] text-[#94A3B8]">
                      {{ tpl.nodeSummary }}
                    </span>
                    <span [style.color]="tpl.accent">{{ tpl.protocol }}</span>
                  </div>
                </button>
              }
            </div>

            <div class="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-white/[0.06]">
              <button
                type="button"
                (click)="skipToBlank()"
                class="text-xs text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1 transition-colors"
              >
                <span>Skip template and start blank</span>
                <span class="material-symbols-outlined text-[15px]">chevron_right</span>
              </button>

              <button
                type="button"
                [disabled]="busy()"
                (click)="applyAndContinue()"
                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-sm font-semibold flex items-center gap-2 shadow-[0_0_24px_rgba(34,211,238,0.28)] hover:brightness-110 disabled:opacity-50"
              >
                <span>{{ busy() ? 'Applying Template…' : 'Continue' }}</span>
                <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        }

        <!-- ================================================================ -->
        <!-- STEP 2: SEND YOUR FIRST EVENT                                    -->
        <!-- ================================================================ -->
        @if (step() === 2) {
          <div class="max-w-6xl w-full mx-auto px-6 py-9 space-y-6">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 text-[11px] font-mono text-cyan-400 uppercase tracking-[0.14em]">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span>Step 2 of 3 · Instrumentation</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F5F9]">Send your first event</h1>
                <p class="text-sm text-[#94A3B8] max-w-2xl">
                  Paste this snippet into your application to initialize telemetry, or fire a test payload directly.
                </p>
              </div>

              <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#111622] border border-white/[0.08]">
                <span class="material-symbols-outlined text-violet-400 text-[20px]">hub</span>
                <div>
                  <div class="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">Active Pattern</div>
                  <div class="text-xs font-semibold text-[#F1F5F9]">{{ store.templateProfile().displayName }}</div>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <!-- Left Column: Language Selector, Install Bar, Code Block, Quick Shell Ping -->
              <div class="lg:col-span-7 space-y-4">
                <!-- Language Tabs -->
                <div class="bg-[#111622] p-1.5 rounded-xl border border-white/[0.08] flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-1 flex-wrap">
                    @for (l of langs; track l.id) {
                      <button
                        type="button"
                        (click)="lang.set(l.id)"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        [class.bg-[#1A2233]]="lang() === l.id"
                        [class.text-cyan-300]="lang() === l.id"
                        [class.text-[#94A3B8]]="lang() !== l.id"
                      >
                        {{ l.label }}
                      </button>
                    }
                  </div>
                  <span class="font-mono text-[11px] text-[#64748B] px-2">HTTP / UDP Ingest</span>
                </div>

                <!-- Install / Endpoint Hint Bar -->
                <div class="px-4 py-2.5 rounded-xl bg-[#0D111A] border border-white/[0.08] flex items-center justify-between gap-3">
                  <span class="font-mono text-xs text-cyan-300 truncate">{{ installHint() }}</span>
                  <button
                    type="button"
                    (click)="copyText(installHint(), 'install')"
                    class="px-2.5 py-1 rounded-md bg-[#161D2C] hover:bg-[#1D263A] text-[11px] text-[#CBD5E1] flex items-center gap-1 shrink-0"
                  >
                    <span class="material-symbols-outlined text-[13px]">
                      {{ copiedInstall() ? 'check' : 'content_copy' }}
                    </span>
                    <span>{{ copiedInstall() ? 'Copied' : 'Copy' }}</span>
                  </button>
                </div>

                <!-- Code Window -->
                <div class="bg-[#0B0F17] border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
                  <div class="h-10 px-4 bg-[#111622] border-b border-white/[0.07] flex items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                      <span class="flex items-center gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-rose-500/70"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-400/70"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400/70"></span>
                      </span>
                      <span class="font-mono text-xs text-[#94A3B8]">{{ currentFileName() }}</span>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        (click)="revealKey.set(!revealKey())"
                        class="px-2.5 py-1 rounded-md bg-[#0B0F17] border border-white/[0.08] font-mono text-[11px] text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1.5"
                      >
                        <span>API Key: {{ revealKey() ? activeApiKey() : maskedApiKey() }}</span>
                        <span class="material-symbols-outlined text-[13px]">
                          {{ revealKey() ? 'visibility_off' : 'visibility' }}
                        </span>
                      </button>
                      <button
                        type="button"
                        (click)="copySnippet()"
                        class="flex items-center gap-1 text-xs text-[#CBD5E1] hover:text-[#F1F5F9] px-2.5 py-1 rounded-md bg-[#161D2C] hover:bg-[#1D263A]"
                      >
                        <span class="material-symbols-outlined text-[14px]">
                          {{ copiedSnippet() ? 'check' : 'content_copy' }}
                        </span>
                        <span>{{ copiedSnippet() ? 'Copied' : 'Copy Snippet' }}</span>
                      </button>
                    </div>
                  </div>
                  <pre class="p-5 font-mono text-xs text-[#E2E8F0] overflow-x-auto leading-relaxed">{{ currentSnippet() }}</pre>
                </div>

                <!-- Quick Verification via Browser / Shell -->
                <div class="p-4 rounded-xl bg-[#111622] border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="space-y-1 min-w-0">
                    <div class="flex items-center gap-2 text-xs font-semibold text-[#F1F5F9]">
                      <span class="material-symbols-outlined text-[16px] text-cyan-400">terminal</span>
                      <span>Quick verification via browser</span>
                    </div>
                    <p class="text-xs text-[#94A3B8]">
                      Fire an immediate 3-hop test trace directly to <code class="text-cyan-300">/api/v1/events</code>.
                    </p>
                  </div>

                  <button
                    type="button"
                    [disabled]="busy()"
                    (click)="fireTestTraceAndListen()"
                    class="px-4 py-2 rounded-lg bg-[#162235] border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/15 text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <span class="material-symbols-outlined text-[15px]">send</span>
                    <span>{{ busy() ? 'Sending…' : 'Send Test Ping' }}</span>
                  </button>
                </div>

                @if (testSendError()) {
                  <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300">
                    {{ testSendError() }}
                  </div>
                }

                <div class="flex items-center justify-between text-[11px] font-mono text-[#64748B] px-1">
                  <span>Ingest Host: {{ api.apiBaseUrl }}/events</span>
                  <span class="flex items-center gap-1.5 text-emerald-400">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>INGESTION READY</span>
                  </span>
                </div>
              </div>

              <!-- Right Column: Topology Live Preview -->
              <div class="lg:col-span-5 bg-[#111622] border border-white/[0.08] rounded-xl p-5 space-y-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[18px] text-cyan-400">account_tree</span>
                    <span class="text-sm font-semibold text-[#F1F5F9]">Topology Live Preview</span>
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full bg-[#0D111A] border border-white/[0.08] text-[10px] font-mono text-cyan-300 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                    <span>WebSocket Listening</span>
                  </span>
                </div>

                <!-- Vertical Awaiting Topology Preview -->
                <div class="relative rounded-xl bg-[#090D14] border border-white/[0.06] p-5 space-y-3 overflow-hidden">
                  <div
                    class="absolute inset-0 opacity-25"
                    style="background-image: radial-gradient(rgba(148,163,184,0.2) 1px, transparent 1px); background-size: 16px 16px;"
                  ></div>
                  <div class="relative z-10 flex flex-col items-center gap-2.5">
                    @for (node of previewNodes(); track node.key; let first = $first; let last = $last) {
                      <div
                        class="w-full max-w-[270px] px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all"
                        [class.bg-[#131C2B]]="first"
                        [class.border-cyan-400/70]="first"
                        [class.shadow-[0_0_24px_rgba(34,211,238,0.2)]]="first"
                        [class.bg-[#0E131D]]="!first"
                        [class.border-white/[0.07]]="!first"
                        [class.opacity-60]="!first"
                      >
                        <div class="flex items-center gap-2.5 min-w-0">
                          <div
                            class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            [class.bg-cyan-400/15]="first"
                            [class.text-cyan-300]="first"
                            [class.bg-white/[0.05]]="!first"
                            [class.text-[#64748B]]="!first"
                          >
                            <span class="material-symbols-outlined text-[16px]">
                              {{ first ? 'language' : 'dns' }}
                            </span>
                          </div>
                          <div class="min-w-0">
                            <div class="text-xs font-semibold text-[#F1F5F9] truncate">{{ node.label }}</div>
                            <div class="text-[10px] font-mono text-[#64748B] truncate">{{ node.key }}</div>
                          </div>
                        </div>

                        @if (first) {
                          <span class="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/35 text-[9px] font-mono font-semibold text-amber-300 shrink-0">
                            AWAITING
                          </span>
                        } @else {
                          <span class="material-symbols-outlined text-[14px] text-[#475569]">lock_clock</span>
                        }
                      </div>

                      @if (!last) {
                        <div class="w-px h-4 bg-gradient-to-b from-cyan-400/50 to-white/10"></div>
                      }
                    }
                  </div>
                </div>

                <div class="p-3.5 rounded-xl bg-[#0D111A] border border-white/[0.06] flex items-start gap-2.5">
                  <span class="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 shrink-0 animate-pulse"></span>
                  <div class="text-xs leading-relaxed">
                    <div class="font-medium text-[#F1F5F9]">
                      Waiting for first event from <code class="text-cyan-300">{{ firstNodeKey() }}</code>…
                    </div>
                    <div class="text-[#64748B] mt-0.5">
                      The topology illuminates automatically once your first checkpoint arrives.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Step 2 Footer Bar -->
            <div class="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 rounded-xl bg-[#111622] border border-white/[0.08]">
              <button
                type="button"
                (click)="step.set(1)"
                class="px-4 py-2 rounded-lg bg-[#161D2C] border border-white/[0.08] text-xs font-medium text-[#CBD5E1] hover:text-[#F1F5F9] flex items-center gap-1.5"
              >
                <span class="material-symbols-outlined text-[15px]">arrow_back</span>
                <span>Back to Templates</span>
              </button>

              <button
                type="button"
                (click)="showDemoTraffic()"
                class="text-xs text-[#64748B] hover:text-[#CBD5E1] transition-colors"
              >
                I'll do this later — show me the demo traffic →
              </button>

              <button
                type="button"
                (click)="step.set(3)"
                class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:brightness-110"
              >
                <span>Continue to Verification</span>
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        }

        <!-- ================================================================ -->
        <!-- STEP 3: WAITING & SUCCESS / ZEN CELEBRATION & ACTIVATION HUB     -->
        <!-- ================================================================ -->
        @if (step() === 3) {
          <div class="max-w-5xl w-full mx-auto px-6 py-10 space-y-6">
            @if (!eventReceived()) {
              <!-- STATE A: WAITING FOR FIRST EVENT (Stitch Step 3 Waiting State) -->
              <div class="space-y-1.5">
                <div class="text-[11px] font-mono text-cyan-400 uppercase tracking-[0.14em]">
                  Step 3 of 3 / Verification &amp; Activation
                </div>
                <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F5F9]">
                  Verify live stream connection
                </h1>
                <p class="text-sm text-[#94A3B8]">
                  See your architecture awaken the moment the first checkpoint arrives from your SDK or test probe.
                </p>
              </div>

              <div class="bg-[#111622] border border-white/[0.08] rounded-2xl p-6 space-y-5 shadow-2xl">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <span class="px-2.5 py-1 rounded-md bg-amber-400/10 border border-amber-400/30 font-mono text-[11px] text-amber-300 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                    <span>STATE A: AWAITING INGESTION</span>
                  </span>
                  <span class="font-mono text-xs text-[#94A3B8]">
                    Listening on WebSocket · Waiting for first event…
                  </span>
                </div>

                <!-- Waiting Topology Canvas -->
                <div class="relative rounded-xl bg-[#090D14] border border-white/[0.06] py-10 px-6 overflow-hidden">
                  <div
                    class="absolute inset-0 opacity-30"
                    style="background-image: radial-gradient(rgba(148,163,184,0.22) 1px, transparent 1px); background-size: 16px 16px;"
                  ></div>
                  <div class="relative z-10 flex flex-wrap items-center justify-center gap-4">
                    @for (node of previewNodes(); track node.key; let first = $first; let last = $last) {
                      <div
                        class="px-4 py-3 rounded-xl border min-w-[155px] transition-all"
                        [class.bg-[#201A12]]="first"
                        [class.border-amber-400/50]="first"
                        [class.shadow-[0_0_28px_rgba(245,158,11,0.16)]]="first"
                        [class.bg-[#0E131D]]="!first"
                        [class.border-white/[0.07]]="!first"
                        [class.opacity-50]="!first"
                      >
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-xs font-semibold text-[#F1F5F9]">{{ node.label }}</span>
                          @if (first) {
                            <span class="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-[9px]">
                              AWAITING
                            </span>
                          } @else {
                            <span class="font-mono text-[9px] text-[#64748B]">IDLE</span>
                          }
                        </div>
                        <div class="font-mono text-[10px] text-[#64748B] mt-1">{{ node.key }}</div>
                      </div>
                      @if (!last) {
                        <span class="hidden sm:inline-block w-8 border-t border-dashed border-white/15"></span>
                      }
                    }
                  </div>
                </div>

                @if (testSendError()) {
                  <div class="p-3 rounded-lg bg-rose-500/10 border border-rose-500/35 text-xs text-rose-300">
                    {{ testSendError() }}
                  </div>
                }

                <div class="p-3.5 rounded-xl bg-[#0D111A] border border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
                  <div class="font-mono text-xs text-[#94A3B8] truncate">
                    <span class="text-[#64748B]">INGEST URL:</span> {{ api.apiBaseUrl }}/events
                  </div>
                  <span class="px-2 py-0.5 rounded bg-[#161D2C] font-mono text-[10px] text-[#94A3B8]">
                    SOCKET READY
                  </span>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    (click)="step.set(2)"
                    class="px-4 py-2 rounded-xl bg-[#161D2C] border border-white/[0.08] text-xs font-medium text-[#CBD5E1] hover:text-[#F1F5F9]"
                  >
                    ← Back to Snippet
                  </button>

                  <button
                    type="button"
                    [disabled]="busy()"
                    (click)="fireTestTraceAndListen()"
                    class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-xs font-semibold flex items-center gap-2 shadow-[0_0_24px_rgba(34,211,238,0.28)] hover:brightness-110 disabled:opacity-50"
                  >
                    <span class="material-symbols-outlined text-[16px]">bolt</span>
                    <span>{{ busy() ? 'Sending Test Event…' : 'Send a test event' }}</span>
                  </button>
                </div>
              </div>
            } @else {
              <!-- STATE B: ZEN CELEBRATION & ACTIVATION HUB (Stitch Step 3 Zen Celebration) -->
              <div class="relative bg-[#0E131D] border border-white/[0.1] rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.65)]">
                <!-- Top Spectrum Accent Bar -->
                <div class="h-1 w-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500"></div>

                <div class="p-7 sm:p-9 space-y-7">
                  <!-- Celebration Header -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                    <div class="flex items-start gap-4">
                      <div class="w-14 h-14 rounded-2xl bg-emerald-400/10 border border-emerald-400/35 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(52,211,153,0.2)]">
                        <span class="material-symbols-outlined text-emerald-400 text-[30px]">verified</span>
                      </div>
                      <div class="space-y-1.5">
                        <div class="flex items-center gap-2.5">
                          <span class="px-2.5 py-0.5 rounded-full bg-emerald-400/15 border border-emerald-400/30 font-mono text-[10px] font-semibold text-emerald-400">
                            ● TELEMETRY HANDSHAKE VERIFIED
                          </span>
                          <span class="font-mono text-[11px] text-[#64748B]">Live</span>
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F5F9]">
                          Your Architecture Is Live!
                        </h1>
                        <p class="text-sm text-[#94A3B8] max-w-xl">
                          First telemetry span arrived. FlowTrace has mapped
                          <span class="text-[#F1F5F9] font-medium">{{ store.diagram().nodes.length || 3 }} services</span>
                          and established real-time tracing.
                        </p>
                      </div>
                    </div>

                    <div class="sm:text-right sm:border-l sm:border-white/[0.07] sm:pl-6 shrink-0">
                      <div class="text-[10px] font-mono uppercase tracking-wider text-[#64748B]">Nodes Mapped</div>
                      <div class="font-mono text-2xl font-bold text-[#F1F5F9] mt-0.5">
                        {{ store.diagram().nodes.length }}
                      </div>
                      <div class="font-mono text-[11px] text-emerald-400">⚡ Ready</div>
                    </div>
                  </div>

                  <!-- Side-by-Side Comparison: Initial Awaiting State vs Verified Production Stream -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Initial Awaiting State Card -->
                    <div class="p-4 rounded-xl bg-[#090D14] border border-white/[0.06] space-y-3 opacity-80">
                      <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-2 text-[#94A3B8]">
                          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                          <span>Initial Awaiting State</span>
                        </span>
                        <span class="px-2 py-0.5 rounded bg-[#141B29] font-mono text-[10px] text-[#64748B]">T - 30s</span>
                      </div>
                      <div class="h-24 rounded-lg bg-[#0B0F17] border border-white/[0.05] flex items-center justify-center px-4">
                        <div class="flex items-center gap-3 text-[11px] font-mono">
                          <span class="px-2.5 py-1 rounded border border-amber-400/50 bg-amber-400/10 text-amber-300">
                            {{ firstNodeKey() }}
                          </span>
                          <span class="text-[#475569]">----</span>
                          <span class="px-2.5 py-1 rounded border border-white/10 text-[#475569]">
                            {{ store.diagram().nodes[1]?.key || 'service' }}
                          </span>
                        </div>
                      </div>
                      <div class="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                        <span>Idle Pulse</span>
                        <span class="text-amber-400">0 events/sec</span>
                      </div>
                    </div>

                    <!-- Verified Production Stream Card -->
                    <div class="p-4 rounded-xl bg-[#090D14] border border-emerald-400/35 space-y-3 shadow-[0_0_24px_rgba(34,211,238,0.08)]">
                      <div class="flex items-center justify-between text-xs">
                        <span class="flex items-center gap-2 font-medium text-[#F1F5F9]">
                          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                          <span>Verified Production Stream</span>
                        </span>
                        <span class="px-2 py-0.5 rounded bg-emerald-400/15 border border-emerald-400/30 font-mono text-[10px] text-emerald-300">
                          ⚡ 200 OK
                        </span>
                      </div>
                      <div class="h-24 rounded-lg bg-[#0B0F17] border border-white/[0.05] overflow-hidden">
                        <svg class="w-full h-full" viewBox="0 0 320 96" fill="none">
                          <path d="M 52 48 H 130 C 170 48, 178 28, 214 28 H 268" stroke="#22D3EE" stroke-width="1.6" />
                          <path d="M 130 48 C 170 48, 178 68, 214 68 H 268" stroke="#8B5CF6" stroke-width="1.6" />
                          <circle r="3.5" fill="#22D3EE">
                            <animateMotion dur="1.6s" repeatCount="indefinite" path="M 52 48 H 130 C 170 48, 178 28, 214 28 H 268" />
                          </circle>
                          <circle r="3.5" fill="#34D399">
                            <animateMotion begin="0.5s" dur="1.8s" repeatCount="indefinite" path="M 52 48 H 130 C 170 48, 178 68, 214 68 H 268" />
                          </circle>
                          <rect x="16" y="34" width="66" height="28" rx="6" fill="#111A2B" stroke="#22D3EE" />
                          <text x="49" y="51" text-anchor="middle" fill="#E2E8F0" font-size="8" font-family="monospace">
                            {{ firstNodeKey().slice(0, 10) }}
                          </text>
                          <rect x="108" y="34" width="48" height="28" rx="6" fill="#111A2B" stroke="#38BDF8" />
                          <text x="132" y="51" text-anchor="middle" fill="#A5F3FC" font-size="8" font-family="monospace">hop</text>
                          <rect x="188" y="16" width="58" height="24" rx="6" fill="#111A2B" stroke="#8B5CF6" />
                          <text x="217" y="31" text-anchor="middle" fill="#DDD6FE" font-size="8" font-family="monospace">worker</text>
                          <rect x="188" y="56" width="58" height="24" rx="6" fill="#111A2B" stroke="#34D399" />
                          <text x="217" y="71" text-anchor="middle" fill="#A7F3D0" font-size="8" font-family="monospace">store</text>
                        </svg>
                      </div>
                      <div class="flex items-center justify-between text-[11px] font-mono">
                        <span class="text-emerald-400">✓ Live Telemetry Flowing</span>
                        <span class="text-[#94A3B8]">Real-time WebSocket</span>
                      </div>
                    </div>
                  </div>

                  <!-- Telemetry Summary Strip -->
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 rounded-xl bg-[#090D14] border border-white/[0.06] text-[11px] font-mono">
                    <div>
                      <span class="text-[#64748B]">PROTOCOL:</span>
                      <span class="ml-1.5 text-[#E2E8F0]">HTTP / WS</span>
                    </div>
                    <div>
                      <span class="text-[#64748B]">INGEST NODE:</span>
                      <span class="ml-1.5 text-cyan-300">{{ firstNodeKey() }}</span>
                    </div>
                    <div>
                      <span class="text-[#64748B]">TEMPLATE:</span>
                      <span class="ml-1.5 text-[#E2E8F0]">{{ store.templateProfile().displayName }}</span>
                    </div>
                    <div>
                      <span class="text-[#64748B]">BUFFER HEALTH:</span>
                      <span class="ml-1.5 text-emerald-400">● 100%</span>
                    </div>
                  </div>

                  <!-- Action Footer -->
                  <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div class="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        [disabled]="busy()"
                        (click)="fireTestTraceAndListen()"
                        class="px-4 py-2 rounded-xl bg-[#161D2C] border border-white/[0.08] text-xs font-medium text-[#CBD5E1] hover:text-[#F1F5F9] flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <span class="material-symbols-outlined text-[15px]">refresh</span>
                        <span>Send Another Test</span>
                      </button>
                      <a
                        routerLink="/traces"
                        class="px-4 py-2 rounded-xl bg-transparent text-xs font-medium text-[#94A3B8] hover:text-[#F1F5F9] flex items-center gap-1.5"
                      >
                        <span class="material-symbols-outlined text-[15px]">data_object</span>
                        <span>Inspect Traces</span>
                      </a>
                    </div>

                    <button
                      type="button"
                      (click)="finishOnboarding()"
                      class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 text-[#070B12] text-sm font-semibold flex items-center gap-2 shadow-[0_0_28px_rgba(34,211,238,0.3)] hover:brightness-110"
                    >
                      <span>Launch Live View Dashboard</span>
                      <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Subtle Daemon Status Footer -->
      <footer class="border-t border-white/[0.06] bg-[#080B10] px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#64748B]">
        <span class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>FlowTrace Ingestion Pipeline · {{ store.backendOnline() ? 'Connected' : 'Standby' }}</span>
        </span>
        <span>System Engine: {{ store.wsConnected() ? 'Live Stream Active' : 'Ready' }}</span>
      </footer>
    </div>
  `,
})
export class OnboardingWizardPageComponent implements OnInit {
  public readonly store = inject(FlowSessionStore);
  public readonly api = inject(FlowTraceApiService);
  private readonly router = inject(Router);

  public readonly step = signal<1 | 2 | 3>(1);
  public readonly selectedTemplate = signal<OnboardingTemplateChoice>('microservices');
  public readonly lang = signal<SnippetLang>('node');
  public readonly busy = signal(false);
  public readonly activeApiKey = signal<string>('ft_live_onboarding_key');
  public readonly revealKey = signal(false);
  public readonly copiedSnippet = signal(false);
  public readonly copiedInstall = signal(false);
  public readonly testSendError = signal<string | null>(null);
  public readonly eventReceived = signal(false);

  public readonly steps: Array<{ num: 1 | 2 | 3; label: string }> = [
    { num: 1, label: 'Template' },
    { num: 2, label: 'Connect telemetry' },
    { num: 3, label: 'Verify live stream' },
  ];

  public readonly langs: Array<{ id: SnippetLang; label: string }> = [
    { id: 'java', label: 'Java' },
    { id: 'node', label: 'Node.js' },
    { id: 'python', label: 'Python' },
    { id: 'curl', label: 'cURL' },
    { id: 'udp', label: 'UDP (netcat)' },
  ];

  public readonly templateCards: OnboardingTemplateCard[] = [
    ...(['microservices', 'online-shop', 'queue-worker', 'ai-rag'] as FlowTemplateId[]).map((id) => {
      const p = resolveTemplateProfile(id);
      const icons: Record<FlowTemplateId, string> = {
        microservices: 'hub',
        'online-shop': 'storefront',
        'queue-worker': 'stream',
        'ai-rag': 'psychology',
      };
      const accents: Record<FlowTemplateId, string> = {
        microservices: '#22D3EE',
        'online-shop': '#34D399',
        'queue-worker': '#F59E0B',
        'ai-rag': '#8B5CF6',
      };
      const summaries: Record<FlowTemplateId, string> = {
        microservices: '7 nodes · Mesh topology',
        'online-shop': '8 nodes · E-commerce',
        'queue-worker': '5 nodes · Async',
        'ai-rag': '6 nodes · RAG pipeline',
      };
      const protocols: Record<FlowTemplateId, string> = {
        microservices: 'gRPC / HTTP',
        'online-shop': 'Webhooks',
        'queue-worker': 'AMQP / Kafka',
        'ai-rag': 'SSE / Vector',
      };
      const variants: Record<FlowTemplateId, OnboardingTemplateCard['variant']> = {
        microservices: 'mesh',
        'online-shop': 'shop',
        'queue-worker': 'queue',
        'ai-rag': 'rag',
      };
      return {
        id,
        name: p.displayName,
        tagline: p.tagline,
        icon: icons[id],
        accent: accents[id],
        nodeSummary: summaries[id],
        protocol: protocols[id],
        variant: variants[id],
      };
    }),
    {
      id: 'blank',
      name: 'Blank canvas',
      tagline: 'Start with an empty workspace. Nodes and connection edges auto-discover on first trace.',
      icon: 'add_box',
      accent: '#F59E0B',
      nodeSummary: '0 nodes · Auto-discovery',
      protocol: 'Dynamic mode',
      variant: 'blank',
    },
  ];

  public readonly previewNodes = computed(() => {
    const nodes = this.store.diagram().nodes;
    if (nodes.length > 0) return nodes.slice(0, 4);
    return [
      { key: 'web_ingress_01', label: 'Website Edge' },
      { key: 'api_gateway', label: 'API Gateway' },
      { key: 'core_service', label: 'Core Service' },
    ];
  });

  public readonly firstNodeKey = computed(() => this.previewNodes()[0]?.key || 'web_ingress_01');

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
    await this.store.init();
    this.selectedTemplate.set(this.store.activeTemplateId());
    await this.ensureApiKey();
  }

  public async skipToBlank(): Promise<void> {
    this.selectedTemplate.set('blank');
    await this.ensureApiKey();
    this.step.set(2);
  }

  public async applyAndContinue(): Promise<void> {
    this.busy.set(true);
    try {
      const chosen = this.selectedTemplate();
      if (chosen !== 'blank') {
        await this.store.applyTemplate(chosen);
      }
      await this.ensureApiKey();
      this.step.set(2);
    } finally {
      this.busy.set(false);
    }
  }

  public async showDemoTraffic(): Promise<void> {
    if (!this.store.demoRunning()) {
      await this.store.toggleDemo();
    }
    await this.router.navigateByUrl('/');
  }

  public installHint(): string {
    switch (this.lang()) {
      case 'node':
        return `POST ${this.api.apiBaseUrl}/events  (native fetch, Node 18+)`;
      case 'java':
        return `java.net.http.HttpClient -> ${this.api.apiBaseUrl}/events`;
      case 'python':
        return 'pip install requests';
      case 'curl':
        return `curl -X POST ${this.api.apiBaseUrl}/events`;
      case 'udp':
        return 'nc -u -w1 localhost 9999  (fire-and-forget UDP)';
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
    const firstNode = this.firstNodeKey();
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
    await this.copyText(this.currentSnippet(), 'snippet');
  }

  public async copyText(value: string, target: 'snippet' | 'install'): Promise<void> {
    if (typeof navigator === 'undefined') return;
    await navigator.clipboard?.writeText(value);
    if (target === 'snippet') {
      this.copiedSnippet.set(true);
      setTimeout(() => this.copiedSnippet.set(false), 1500);
    } else {
      this.copiedInstall.set(true);
      setTimeout(() => this.copiedInstall.set(false), 1500);
    }
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
