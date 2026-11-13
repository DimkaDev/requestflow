import { Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FlowSessionStore } from './core/flow-session.store';
import { QuotaUpgradeModalComponent } from './shared/components/quota-upgrade-modal.component';
import { ShareEmbedModalComponent } from './shared/components/share-embed-modal.component';
import { TopHeaderComponent } from './shared/components/top-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    TopHeaderComponent,
    ShareEmbedModalComponent,
    QuotaUpgradeModalComponent,
  ],
  template: `
    <app-top-header />
    <router-outlet />
    <app-share-embed-modal
      [open]="store.shareModalOpen()"
      [projectId]="store.selectedProjectId()"
      (closed)="store.shareModalOpen.set(false)"
    />
    <app-quota-upgrade-modal
      [open]="store.quotaModalOpen()"
      (closed)="store.quotaModalOpen.set(false)"
    />
  `,
})
export class AppComponent implements OnDestroy {
  public readonly store = inject(FlowSessionStore);

  public ngOnDestroy(): void {
    this.store.destroy();
  }
}
