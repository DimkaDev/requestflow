import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlowTraceApiService } from '../../core/api.service';
import { Invitation, OrgRole, OrganizationMember, OrganizationView } from '../../core/models';

@Component({
  selector: 'app-team-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pt-14 min-h-screen bg-bg-0 text-text-1">
      <div class="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 class="font-headline-lg text-2xl font-semibold text-text-1">Team Members &amp; Access</h1>
            <p class="text-sm text-text-3 mt-1">
              {{ activeOrg()?.organization?.name || 'Organization' }} · Manage roles and pending invitations.
            </p>
          </div>
          <span class="px-3 py-1 rounded-full bg-bg-2 border border-border-structural text-xs font-code-sm text-node-queue">
            Your role: {{ activeOrg()?.myRole || 'OWNER' }}
          </span>
        </div>

        <!-- Invite Form -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl p-5 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div class="flex-1">
            <label class="block text-xs text-text-2 mb-1">Invite by Email</label>
            <input
              type="email"
              [ngModel]="inviteEmail()"
              (ngModelChange)="inviteEmail.set($event)"
              placeholder="teammate@company.com"
              class="w-full h-9 px-3 rounded-lg bg-bg-2 border border-border-structural text-xs text-text-1"
            />
          </div>
          <div class="w-full sm:w-44">
            <label class="block text-xs text-text-2 mb-1">Role</label>
            <select
              [ngModel]="inviteRole()"
              (ngModelChange)="inviteRole.set($event)"
              class="w-full h-9 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-xs text-text-1"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="MEMBER">MEMBER</option>
              <option value="VIEWER">VIEWER</option>
              <option value="BILLING_ADMIN">BILLING_ADMIN</option>
            </select>
          </div>
          <button
            type="button"
            [disabled]="!inviteEmail().trim() || sendingInvite()"
            (click)="sendInvite()"
            class="h-9 px-4 rounded-lg bg-gradient-to-r from-node-queue to-node-service text-bg-0 text-xs font-semibold shrink-0 disabled:opacity-50"
          >
            {{ sendingInvite() ? 'Sending…' : 'Send Invite' }}
          </button>
        </section>

        <!-- Members Table -->
        <section class="bg-bg-1 border border-border-structural rounded-2xl overflow-hidden">
          <div class="px-5 py-3.5 border-b border-border-structural flex items-center justify-between">
            <h2 class="font-headline-sm text-base font-semibold text-text-1">Active Members ({{ members().length }})</h2>
          </div>
          <div class="divide-y divide-border-structural">
            @for (m of members(); track m.userId) {
              <div class="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div class="text-sm font-medium text-text-1">{{ m.email }}</div>
                  <div class="text-[11px] font-code-sm text-text-3">{{ m.externalId }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <select
                    [ngModel]="m.role"
                    (ngModelChange)="changeRole(m.userId, $event)"
                    [disabled]="m.role === 'OWNER'"
                    class="h-8 px-2.5 rounded-lg bg-bg-2 border border-border-structural text-xs text-text-1 disabled:opacity-60"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="MEMBER">MEMBER</option>
                    <option value="VIEWER">VIEWER</option>
                    <option value="BILLING_ADMIN">BILLING_ADMIN</option>
                  </select>
                  @if (m.role !== 'OWNER') {
                    <button
                      type="button"
                      (click)="removeMember(m.userId)"
                      class="w-8 h-8 rounded-lg bg-bg-2 border border-border-structural text-text-3 hover:text-status-error flex items-center justify-center"
                      title="Remove member"
                    >
                      <span class="material-symbols-outlined text-[16px]">person_remove</span>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Pending Invitations -->
        @if (invitations().length > 0) {
          <section class="bg-bg-1 border border-border-structural rounded-2xl overflow-hidden">
            <div class="px-5 py-3.5 border-b border-border-structural">
              <h2 class="font-headline-sm text-base font-semibold text-text-1">Invitations ({{ invitations().length }})</h2>
            </div>
            <div class="divide-y divide-border-structural">
              @for (inv of invitations(); track inv.id) {
                <div class="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div class="text-sm text-text-1">{{ inv.email }}</div>
                    <div class="text-[11px] font-code-sm text-text-3">{{ inv.role }} · {{ inv.status }}</div>
                  </div>
                  <button
                    type="button"
                    (click)="revokeInvite(inv.id)"
                    class="px-3 py-1 rounded-lg bg-status-error/10 border border-status-error/30 text-xs text-status-error"
                  >
                    Revoke
                  </button>
                </div>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class TeamPageComponent implements OnInit {
  private readonly api = inject(FlowTraceApiService);

  public readonly activeOrg = signal<OrganizationView | null>(null);
  public readonly members = signal<OrganizationMember[]>([]);
  public readonly invitations = signal<Invitation[]>([]);
  public readonly inviteEmail = signal('');
  public readonly inviteRole = signal<OrgRole>('MEMBER');
  public readonly sendingInvite = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const orgs = await this.api.listOrganizations();
      if (orgs.length > 0) {
        this.activeOrg.set(orgs[0]);
        const orgId = orgs[0].organization.id;
        const [members, invitations] = await Promise.all([
          this.api.listOrgMembers(orgId),
          this.api.listInvitations(orgId),
        ]);
        this.members.set(members);
        this.invitations.set(invitations);
      }
    } catch {
      // Ignore transient errors
    }
  }

  public async sendInvite(): Promise<void> {
    const orgId = this.activeOrg()?.organization.id;
    const email = this.inviteEmail().trim();
    if (!orgId || !email) return;
    this.sendingInvite.set(true);
    try {
      const inv = await this.api.createInvitation(orgId, email, this.inviteRole());
      this.invitations.update((list) => [inv, ...list]);
      this.inviteEmail.set('');
    } finally {
      this.sendingInvite.set(false);
    }
  }

  public async changeRole(userId: string, role: OrgRole): Promise<void> {
    const orgId = this.activeOrg()?.organization.id;
    if (!orgId) return;
    const updated = await this.api.updateMemberRole(orgId, userId, role);
    this.members.set(updated);
  }

  public async removeMember(userId: string): Promise<void> {
    const orgId = this.activeOrg()?.organization.id;
    if (!orgId) return;
    await this.api.removeMember(orgId, userId);
    this.members.update((list) => list.filter((m) => m.userId !== userId));
  }

  public async revokeInvite(invId: string): Promise<void> {
    const orgId = this.activeOrg()?.organization.id;
    if (!orgId) return;
    await this.api.revokeInvitation(orgId, invId);
    this.invitations.update((list) => list.filter((i) => i.id !== invId));
  }
}
