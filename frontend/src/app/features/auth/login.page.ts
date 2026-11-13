import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FlowTraceApiService } from '../../core/api.service';
import { FlowSessionStore } from '../../core/flow-session.store';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1 flex items-center justify-center p-6">
      <div class="w-full max-w-md rounded-2xl bg-bg-1 border border-border-structural p-8 space-y-6 shadow-2xl">
        <div class="text-center space-y-2">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-node-service to-node-queue flex items-center justify-center">
            <svg class="w-6 h-6 text-bg-0" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24">
              <path d="M4 18c4-4 4-8 8-8s4 4 8 0"></path>
            </svg>
          </div>
          <h1 class="font-headline-md text-xl font-semibold text-text-1">
            {{ mode() === 'signin' ? 'Sign in to FlowTrace' : 'Create your FlowTrace workspace' }}
          </h1>
          <p class="text-xs text-text-3">Real-time topology &amp; request flow observability</p>
        </div>

        <div class="flex p-1 rounded-xl bg-bg-2 border border-border-structural">
          <button
            type="button"
            (click)="mode.set('signin')"
            class="flex-1 py-1.5 rounded-lg text-xs font-medium"
            [class.bg-bg-3]="mode() === 'signin'"
            [class.text-text-1]="mode() === 'signin'"
            [class.text-text-3]="mode() !== 'signin'"
          >
            Sign In
          </button>
          <button
            type="button"
            (click)="mode.set('signup')"
            class="flex-1 py-1.5 rounded-lg text-xs font-medium"
            [class.bg-bg-3]="mode() === 'signup'"
            [class.text-text-1]="mode() === 'signup'"
            [class.text-text-3]="mode() !== 'signup'"
          >
            Sign Up
          </button>
        </div>

        <form (ngSubmit)="submit()" class="space-y-4 text-xs">
          <div>
            <label class="block text-text-2 mb-1">Work Email</label>
            <input
              type="email"
              required
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
              name="email"
              placeholder="dev@flowtrace.local"
              class="w-full h-10 px-3 rounded-xl bg-bg-2 border border-border-structural text-text-1 focus:outline-none focus:border-node-queue"
            />
          </div>

          <div>
            <label class="block text-text-2 mb-1">Workspace Token / Password</label>
            <input
              type="password"
              [ngModel]="token()"
              (ngModelChange)="token.set($event)"
              name="token"
              placeholder="local-dev-user"
              class="w-full h-10 px-3 rounded-xl bg-bg-2 border border-border-structural text-text-1 focus:outline-none focus:border-node-queue"
            />
          </div>

          <button
            type="submit"
            class="w-full h-10 rounded-xl bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold hover:opacity-95"
          >
            {{ mode() === 'signin' ? 'Continue to Live Canvas' : 'Create Workspace & Start' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class LoginPageComponent {
  private readonly api = inject(FlowTraceApiService);
  private readonly store = inject(FlowSessionStore);
  private readonly router = inject(Router);

  public readonly mode = signal<'signin' | 'signup'>('signin');
  public readonly email = signal('dev@flowtrace.local');
  public readonly token = signal('local-dev-user');

  public async submit(): Promise<void> {
    const cleanEmail = this.email().trim() || 'dev@flowtrace.local';
    const cleanToken = this.token().trim() || cleanEmail;
    this.api.authUserEmail.set(cleanEmail);
    this.api.authToken.set(cleanToken);
    await this.store.init();
    await this.router.navigateByUrl(this.mode() === 'signup' ? '/onboarding' : '/');
  }
}
