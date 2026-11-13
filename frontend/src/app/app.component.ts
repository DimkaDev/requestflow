import { Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FlowSessionStore } from './core/flow-session.store';
import { TopHeaderComponent } from './shared/components/top-header.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, TopHeaderComponent],
  template: `
    <app-top-header />
    <router-outlet />
  `,
})
export class AppComponent implements OnDestroy {
  private readonly store = inject(FlowSessionStore);

  public ngOnDestroy(): void {
    this.store.destroy();
  }
}
