import { Routes } from '@angular/router';
import { LiveViewPageComponent } from './features/live-view/live-view.page';

export const routes: Routes = [
  { path: '', component: LiveViewPageComponent },
  { path: '**', redirectTo: '' },
];
